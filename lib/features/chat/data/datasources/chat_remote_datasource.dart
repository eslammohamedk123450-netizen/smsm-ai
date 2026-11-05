import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/network/sse_client.dart';
import '../../../core/errors/exceptions.dart';
import '../../../core/utils/token_counter.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';

abstract class ChatRemoteDataSource {
  Future<List<ModelEntity>> getAvailableModels();
  Future<ModelEntity?> getModelById(String modelId);
  Future<List<MessageEntity>> getMessages(String conversationId);
  Future<String> createConversation(String title, String? modelId);
  Future<void> sendMessage(String conversationId, String message, String modelId);
  Stream<List<MessageEntity>> messageStream(String conversationId);
  Future<void> updateMessage(String messageId, String content, bool done);
  Future<void> deleteConversation(String conversationId);
}

class ChatRemoteDataSourceImpl implements ChatRemoteDataSource {
  final SupabaseClient supabase;
  final SseClient sseClient;

  ChatRemoteDataSourceImpl(this.supabase, this.sseClient);

  @override
  Future<List<ModelEntity>> getAvailableModels() async {
    try {
      final response = await supabase
          .from('ai_models')
          .select('*')
          .eq('status', 'active')
          .order('category')
          .order('display_name');

      return (response as List).map((json) => ModelEntity(
        id: json['id'],
        provider: json['provider'],
        modelName: json['model_name'],
        displayName: json['display_name'],
        category: json['category'],
        status: json['status'],
        costPer1kTokens: json['cost_per_1k_tokens'] as int? ?? 0,
        creditMultiplier: (json['credit_multiplier'] as num?)?.toDouble() ?? 1.0,
        maxTokens: json['max_tokens'] as int? ?? 4096,
        supportsStreaming: json['supports_streaming'] as bool? ?? true,
        isRacingEnabled: json['is_racing_enabled'] as bool? ?? false,
      )).toList();
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<ModelEntity?> getModelById(String modelId) async {
    try {
      final response = await supabase
          .from('ai_models')
          .select('*')
          .eq('id', modelId)
          .single();

      return ModelEntity(
        id: response['id'],
        provider: response['provider'],
        modelName: response['model_name'],
        displayName: response['display_name'],
        category: response['category'],
        status: response['status'],
        costPer1kTokens: response['cost_per_1k_tokens'] as int? ?? 0,
        creditMultiplier: (response['credit_multiplier'] as num?)?.toDouble() ?? 1.0,
        maxTokens: response['max_tokens'] as int? ?? 4096,
        supportsStreaming: response['supports_streaming'] as bool? ?? true,
        isRacingEnabled: response['is_racing_enabled'] as bool? ?? false,
      );
    } catch (e) {
      return null;
    }
  }

  @override
  Future<List<MessageEntity>> getMessages(String conversationId) async {
    try {
      final response = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', ascending: true);

      return (response as List).map((json) => MessageEntity(
        id: json['id'],
        conversationId: json['conversation_id'],
        role: json['role'],
        content: json['content'],
        tokenCount: json['token_count'] as int? ?? 0,
        modelId: json['model_id'],
        createdAt: DateTime.parse(json['created_at']),
      )).toList();
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<String> createConversation(String title, String? modelId) async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) throw AuthException(message: 'Not authenticated');

      final response = await supabase
          .from('conversations')
          .insert({'user_id': userId, 'title': title, 'model_id': modelId})
          .select('id')
          .single();

      return response['id'] as String;
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<void> sendMessage(String conversationId, String message, String modelId) async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) throw AuthException(message: 'Not authenticated');

      await supabase.from('messages').insert({
        'conversation_id': conversationId,
        'role': 'user',
        'content': message,
        'user_id': userId,
      });

      await supabase
          .from('conversations')
          .update({'updated_at': DateTime.now().toIso8601String()})
          .eq('id', conversationId);
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Stream<List<MessageEntity>> messageStream(String conversationId) {
    return supabase
        .from('messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .map((data) {
          return (data as List).map((json) => MessageEntity(
            id: json['id'],
            conversationId: json['conversation_id'],
            role: json['role'],
            content: json['content'],
            tokenCount: json['token_count'] as int? ?? 0,
            modelId: json['model_id'],
            createdAt: DateTime.parse(json['created_at']),
          )).toList();
        });
  }

  @override
  Future<void> updateMessage(String messageId, String content, bool done) async {
    try {
      await supabase
          .from('messages')
          .update({'content': content, 'token_count': TokenCounter.count(content)})
          .eq('id', messageId);
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    try {
      await supabase.from('conversations').delete().eq('id', conversationId);
    } catch (e) {
      throw ServerException(message: e.toString());
    }
  }