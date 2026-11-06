import 'dart:math';

import 'package:supabase_flutter/supabase_flutter.dart' hide AuthException;
import '../../../../app_config.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/sse_client.dart';
import '../../../../core/utils/token_counter.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';

abstract class ChatRemoteDataSource {
  Future<List<ModelEntity>> getAvailableModels();
  Future<ModelEntity?> getModelById(String modelId);
  Future<List<MessageEntity>> getMessages(String conversationId);
  Future<String> createConversation(String title, String? modelId);
  Future<void> sendMessage(
    String conversationId,
    String message, {
    required void Function(String chunk) onChunk,
  });
  Stream<List<MessageEntity>> messageStream(String conversationId);
  Future<void> updateMessage(String messageId, String content, bool done);
  Future<void> deleteConversation(String conversationId);
}

class ChatRemoteDataSourceImpl implements ChatRemoteDataSource {
  final SupabaseClient supabase;
  final SseClient sseClient;

  ChatRemoteDataSourceImpl(this.supabase, this.sseClient);

  String _newRequestId() {
    final bytes = List<int>.generate(16, (_) => Random.secure().nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((value) => value.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  @override
  Future<List<ModelEntity>> getAvailableModels() async {
    try {
      final results = await Future.wait<dynamic>([
        supabase
            .from('ai_models')
            .select('id,name,provider_id,model_identifier,enabled,priority,context_window,routing_group,allowed_tiers,input_price')
            .eq('enabled', true)
            .order('priority', ascending: false),
        supabase.from('ai_providers_catalog').select('id,name,provider_type'),
      ]);
      final providerById = <int, Map<String, dynamic>>{};
      for (final provider in results[1] as List) {
        providerById[provider['id'] as int] = provider as Map<String, dynamic>;
      }
      return (results[0] as List).map((raw) {
        final json = raw as Map<String, dynamic>;
        final provider = providerById[json['provider_id'] as int];
        final route = json['routing_group'] as String? ?? 'free_race';
        return ModelEntity(
          id: '${json['id']}',
          provider: (provider?['provider_type'] ?? provider?['name'] ?? 'provider').toString(),
          modelName: (json['model_identifier'] ?? json['name']).toString(),
          displayName: (json['name'] ?? json['model_identifier']).toString(),
          category: route == 'free_race' ? 'free' : 'premium',
          status: json['enabled'] == true ? 'active' : 'disabled',
          costPer1kTokens: ((json['input_price'] as num?) ?? 0).round(),
          creditMultiplier: 1.0,
          maxTokens: (json['context_window'] as int?) ?? 32768,
          supportsStreaming: true,
          isRacingEnabled: route == 'free_race',
          routingGroup: route,
          allowedTiers: List<String>.from((json['allowed_tiers'] as List?)?.whereType<String>() ?? const []),
        );
      }).toList();
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<ModelEntity?> getModelById(String modelId) async {
    final models = await getAvailableModels();
    for (final model in models) {
      if (model.id == modelId) return model;
    }
    return null;
  }

  MessageEntity _mapMessage(Map<String, dynamic> json) => MessageEntity(
        id: json['id'].toString(),
        conversationId: json['conversation_id'].toString(),
        role: json['role'].toString(),
        content: json['content']?.toString() ?? '',
        tokenCount: (json['tokens_used'] as int?) ?? 0,
        modelId: json['model_id']?.toString(),
        createdAt: DateTime.parse(json['created_at'].toString()),
      );

  @override
  Future<List<MessageEntity>> getMessages(String conversationId) async {
    try {
      final response = await supabase
          .from('suly_messages')
          .select('id,conversation_id,user_id,model_id,role,content,tokens_used,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', ascending: true);
      return (response as List).map((row) => _mapMessage(row as Map<String, dynamic>)).toList();
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<String> createConversation(String title, String? modelId) async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) throw AuthException(message: 'Not authenticated');
      final response = await supabase.from('suly_conversations').insert({
        'user_id': userId,
        'title': title,
        'model_id': modelId == null ? null : int.tryParse(modelId),
      }).select('id').single();
      return response['id'] as String;
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<void> sendMessage(
    String conversationId,
    String message, {
    required void Function(String chunk) onChunk,
  }) async {
    try {
      final user = supabase.auth.currentUser;
      final accessToken = supabase.auth.currentSession?.accessToken;
      if (user == null || accessToken == null) throw AuthException(message: 'Not authenticated');

      final history = await getMessages(conversationId);
      await supabase.from('suly_messages').insert({
        'conversation_id': conversationId,
        'user_id': user.id,
        'role': 'user',
        'content': message,
        'tokens_used': TokenCounter.count(message),
      });
      await supabase
          .from('suly_conversations')
          .update({'updated_at': DateTime.now().toUtc().toIso8601String()})
          .eq('id', conversationId);

      final messages = [
        ...history.where((item) => item.role == 'user' || item.role == 'assistant').map((item) => {
              'role': item.role,
              'content': item.content,
            }),
        {'role': 'user', 'content': message},
      ];
      final requestId = _newRequestId();
      var receivedText = false;
      var receivedDone = false;
      await for (final event in sseClient.stream(
        url: '${AppConfig.edgeFunctionBaseUrl}/ai-router',
        headers: {
          'Authorization': 'Bearer $accessToken',
          'apikey': AppConfig.supabaseAnonKey,
        },
        body: {
          'conversation_id': conversationId,
          'request_id': requestId,
          'messages': messages,
          'routing_mode': 'auto',
          'stream': true,
        },
      )) {
        if (event is SseChunk && event.text.isNotEmpty) {
          receivedText = true;
          onChunk(event.text);
        } else if (event is SseDone) {
          receivedDone = true;
        } else if (event is SseError) {
          throw ServerException(message: event.message);
        }
      }
      if (!receivedText) throw ServerException(message: 'The router returned no model response.');
      if (!receivedDone) throw ServerException(message: 'The response stream ended unexpectedly. Please try again.');
    } catch (e) {
      if (e is AppException) rethrow;
      throw ServerException(message: e.toString());
    }
  }

  @override
  Stream<List<MessageEntity>> messageStream(String conversationId) {
    return supabase
        .from('suly_messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .map((rows) => rows.map((row) => _mapMessage(row)).toList());
  }

  @override
  Future<void> updateMessage(String messageId, String content, bool done) async {
    try {
      await supabase.from('suly_messages').update({
        'content': content,
        'tokens_used': TokenCounter.count(content),
      }).eq('id', messageId);
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    try {
      await supabase.from('suly_conversations').delete().eq('id', conversationId);
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }
}
