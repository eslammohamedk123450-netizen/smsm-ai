import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/services/credit_service.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import 'chat_state.dart';

class ChatCubit extends Cubit<ChatState> {
  final ChatRepository _chatRepository;
  final CreditService? _creditService;

  ChatCubit(this._chatRepository, {CreditService? creditService})
      : _creditService = creditService,
        super(const ChatInitial());

  String _currentAssistantContent = '';
  String? _currentMessageId;
  String? _currentConversationId;
  int _creditBalance = 0;
  List<ModelEntity> _models = const [];

  Future<void> _refreshCreditBalance() async {
    try {
      final service = _creditService;
      if (service != null) _creditBalance = await service.getCurrentUserCredits();
    } catch (_) {
      // A balance refresh failure must not interrupt message delivery.
    }
  }

  Future<void> initialize() async {
    final currentModel = state.currentModel;
    emit(ChatLoading(
      messages: state.messages,
      models: _models,
      conversationId: _currentConversationId,
      currentModel: currentModel,
      creditBalance: _creditBalance,
    ));
    try {
      _models = await _chatRepository.getAvailableModels();
      await _refreshCreditBalance();
      emit(ChatLoaded(
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: currentModel,
        creditBalance: _creditBalance,
      ));
    } catch (error) {
      emit(ChatError(
        message: error.toString(),
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: currentModel,
        creditBalance: _creditBalance,
      ));
    }
  }

  Future<void> createNewConversation() async {
    final selectedModel = state.currentModel;
    _currentAssistantContent = '';
    _currentMessageId = null;
    _currentConversationId = null;
    await startNewConversation(selectedModel);
  }

  Future<void> startNewConversation([String? modelId]) async {
    _currentAssistantContent = '';
    _currentMessageId = null;
    try {
      await _refreshCreditBalance();
      final conversationId = await _chatRepository.createConversation('New Conversation', modelId);
      _currentConversationId = conversationId;
      emit(ChatLoaded(
        messages: const [],
        conversationId: conversationId,
        currentModel: modelId,
        models: _models,
        creditBalance: _creditBalance,
      ));
    } catch (error) {
      emit(ChatError(
        message: error.toString(),
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: state.currentModel,
        creditBalance: _creditBalance,
      ));
    }
  }

  Future<void> loadConversation(String conversationId) async {
    final currentModel = state.currentModel;
    emit(ChatLoading(
      models: _models,
      conversationId: _currentConversationId,
      currentModel: currentModel,
      creditBalance: _creditBalance,
    ));
    try {
      final messages = await _chatRepository.getMessages(conversationId);
      await _refreshCreditBalance();
      _currentConversationId = conversationId;
      emit(ChatLoaded(
        messages: messages,
        conversationId: conversationId,
        currentModel: currentModel,
        models: _models,
        creditBalance: _creditBalance,
      ));
    } catch (error) {
      emit(ChatError(
        message: error.toString(),
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: currentModel,
        creditBalance: _creditBalance,
      ));
    }
  }

  Future<void> sendMessage(String message, [String? modelId]) async {
    final currentModel = modelId ?? state.currentModel;
    if (_currentConversationId == null) await startNewConversation(currentModel);
    final conversationId = _currentConversationId;
    if (conversationId == null || isClosed) return;

    await _refreshCreditBalance();
    final existingMessages = state.messages;
    final userMessage = MessageEntity(
      id: 'local_user_${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'user',
      content: message,
      status: 'sent',
      createdAt: DateTime.now(),
    );
    final assistantMessage = MessageEntity(
      id: 'local_assistant_${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      isStreaming: true,
      createdAt: DateTime.now(),
    );
    _currentMessageId = assistantMessage.id;
    _currentAssistantContent = '';
    emit(ChatLoaded(
      messages: [...existingMessages, userMessage, assistantMessage],
      models: _models,
      conversationId: conversationId,
      currentModel: currentModel,
      creditBalance: _creditBalance,
      isStreaming: true,
    ));

    try {
      await _chatRepository.sendMessage(
        conversationId,
        message,
        onChunk: onStreamChunk,
      );
      await onStreamComplete();
    } catch (error) {
      await _refreshCreditBalance();
      onStreamError('Failed to connect: ${error.toString()}');
    }
  }

  void onStreamChunk(String chunk) {
    _currentAssistantContent += chunk;
    final updatedMessages = state.messages.map((message) {
      if (message.id != _currentMessageId) return message;
      return message.copyWith(
        content: _currentAssistantContent,
        streamedContent: _currentAssistantContent,
        status: 'streaming',
        isStreaming: true,
      );
    }).toList();
    emit(ChatStreaming(
      partialContent: _currentAssistantContent,
      messages: updatedMessages,
      models: state.models.isEmpty ? _models : state.models,
      conversationId: _currentConversationId,
      currentModel: state.currentModel,
      creditBalance: _creditBalance,
    ));
  }

  Future<void> onStreamComplete() async {
    await _refreshCreditBalance();
    final updatedMessages = state.messages.map((message) {
      if (message.id != _currentMessageId) return message;
      return message.copyWith(
        content: _currentAssistantContent,
        streamedContent: _currentAssistantContent,
        status: 'completed',
        isStreaming: false,
      );
    }).toList();
    emit(ChatLoaded(
      messages: updatedMessages,
      models: state.models.isEmpty ? _models : state.models,
      conversationId: _currentConversationId,
      currentModel: state.currentModel,
      creditBalance: _creditBalance,
    ));
    _currentAssistantContent = '';
    _currentMessageId = null;
  }

  void onStreamError(String error) {
    final messageId = _currentMessageId;
    final updatedMessages = state.messages.map((message) {
      if (message.id != messageId) return message;
      return message.copyWith(status: 'error', isStreaming: false);
    }).toList();
    emit(ChatError(
      message: error,
      messages: updatedMessages,
      models: state.models.isEmpty ? _models : state.models,
      conversationId: _currentConversationId,
      currentModel: state.currentModel,
      creditBalance: _creditBalance,
    ));
    _currentAssistantContent = '';
    _currentMessageId = null;
  }

  void selectModel(String modelId) {
    final currentState = state;
    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(currentModel: modelId));
    } else if (currentState is ChatStreaming) {
      emit(currentState.copyWith(currentModel: modelId));
    } else if (currentState is ChatError) {
      emit(currentState.copyWith(currentModel: modelId));
    }
  }
}
