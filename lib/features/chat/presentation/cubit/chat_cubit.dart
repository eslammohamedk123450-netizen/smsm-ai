import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import 'chat_state.dart';

class ChatCubit extends Cubit<ChatState> {
  final ChatRepository _chatRepository;

  ChatCubit(this._chatRepository) : super(const ChatInitial());

  String _currentAssistantContent = '';
  String? _currentMessageId;
  String? _currentConversationId;
  int _creditBalance = 0;
  List<ModelEntity> _models = const [];

  Future<void> initialize() async {
    emit(const ChatLoading());
    try {
      _models = await _chatRepository.getAvailableModels();
      emit(ChatLoaded(
        messages: const [],
        models: _models,
        conversationId: null,
        currentModel: null,
        creditBalance: _creditBalance,
      ));
    } catch (e) {
      emit(ChatError(
        message: e.toString(),
        messages: const [],
        models: _models,
        conversationId: null,
        currentModel: null,
      ));
    }
  }

  Future<void> startNewConversation([String? modelId]) async {
    _currentAssistantContent = '';
    _currentMessageId = null;
    try {
      final conversationId = await _chatRepository.createConversation('New Conversation', modelId);
      _currentConversationId = conversationId;
      emit(ChatLoaded(
        messages: const [],
        conversationId: conversationId,
        currentModel: modelId,
        models: _models,
        creditBalance: _creditBalance,
      ));
    } catch (e) {
      emit(ChatError(
        message: e.toString(),
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: state.currentModel,
      ));
    }
  }

  Future<void> loadConversation(String conversationId) async {
    final currentModel = state.currentModel;
    emit(const ChatLoading());
    try {
      final messages = await _chatRepository.getMessages(conversationId);
      _currentConversationId = conversationId;
      emit(ChatLoaded(
        messages: messages,
        conversationId: conversationId,
        currentModel: currentModel,
        models: _models,
        creditBalance: _creditBalance,
      ));
    } catch (e) {
      emit(ChatError(
        message: e.toString(),
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: state.currentModel,
      ));
    }
  }

  Future<void> sendMessage(String message, [String? modelId]) async {
    final currentModel = modelId ?? state.currentModel;
    if (_currentConversationId == null) await startNewConversation(currentModel);
    final conversationId = _currentConversationId;
    if (conversationId == null) return;

    final currentState = state;
    final existingMessages = (currentState is ChatLoaded ||
            currentState is ChatError ||
            currentState is ChatStreaming)
        ? currentState.messages
        : <MessageEntity>[];
    final creditBalance = currentState is ChatLoaded ? currentState.creditBalance : _creditBalance;
    final userMessage = MessageEntity(
      id: 'local_user_${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'user',
      content: message,
      status: MessageStatus.sent,
      createdAt: DateTime.now(),
    );
    final assistantMessage = MessageEntity(
      id: 'local_assistant_${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'assistant',
      content: '',
      status: MessageStatus.streaming,
      isStreaming: true,
      createdAt: DateTime.now(),
    );
    _currentMessageId = assistantMessage.id;
    _currentAssistantContent = '';
    emit(ChatLoaded(
      messages: [...existingMessages, userMessage, assistantMessage],
      conversationId: conversationId,
      currentModel: currentModel,
      creditBalance: creditBalance,
    ));

    try {
      await _chatRepository.sendMessage(
        conversationId,
        message,
        onChunk: onStreamChunk,
      );
      onStreamComplete();
    } catch (e) {
      onStreamError(e.toString());
    }
  }

  void onStreamChunk(String chunk) {
    _currentAssistantContent += chunk;
    final currentState = state;
    final existingMessages = (currentState is ChatLoaded ||
            currentState is ChatError ||
            currentState is ChatStreaming)
        ? currentState.messages
        : <MessageEntity>[];
    final currentModels = currentState is ChatLoaded ? currentState.models : _models;
    final updatedMessages = existingMessages.map((message) {
      if (message.id != _currentMessageId) return message;
      return message.copyWith(
        content: _currentAssistantContent,
        streamedContent: _currentAssistantContent,
        status: MessageStatus.streaming,
        isStreaming: true,
      );
    }).toList();
    emit(ChatStreaming(
      partialContent: _currentAssistantContent,
      messages: updatedMessages,
      models: currentModels,
      conversationId: _currentConversationId,
      currentModel: state.currentModel,
    ));
  }

  void onStreamComplete() {
    final currentState = state;
    final existingMessages = (currentState is ChatLoaded ||
            currentState is ChatError ||
            currentState is ChatStreaming)
        ? currentState.messages
        : <MessageEntity>[];
    final currentModels = currentState is ChatLoaded ? currentState.models : _models;
    final updatedMessages = existingMessages.map((message) {
      if (message.id != _currentMessageId) return message;
      return message.copyWith(
        content: _currentAssistantContent,
        streamedContent: _currentAssistantContent,
        status: MessageStatus.completed,
        isStreaming: false,
      );
    }).toList();
    emit(ChatLoaded(
      messages: updatedMessages,
      models: currentModels,
      conversationId: _currentConversationId,
      currentModel: state.currentModel,
      creditBalance: _creditBalance,
    ));
    _currentAssistantContent = '';
    _currentMessageId = null;
  }

  void onStreamError(String error) {
    final currentState = state;
    final existingMessages = (currentState is ChatLoaded ||
            currentState is ChatError ||
            currentState is ChatStreaming)
        ? currentState.messages
        : <MessageEntity>[];
    final currentModels = currentState is ChatLoaded ? currentState.models : _models;
    final messageId = _currentMessageId;
    _currentAssistantContent = '';
    _currentMessageId = null;
    final updatedMessages = existingMessages.map((message) {
      if (message.id != messageId) return message;
      return message.copyWith(status: MessageStatus.error, isStreaming: false);
    }).toList();
    emit(ChatError(
      message: error,
      messages: updatedMessages,
      models: currentModels,
      conversationId: _currentConversationId,
      currentModel: state.currentModel,
    ));
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
