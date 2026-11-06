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
  List<ModelEntity> _models = const [];

  Future<void> initialize() async {
    emit(const ChatLoading());
    try {
      _models = await _chatRepository.getAvailableModels();
      emit(ChatLoaded(models: _models, creditBalance: 0));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> startNewConversation([String? ignoredModelId]) async {
    _currentAssistantContent = '';
    _currentMessageId = null;
    try {
      final conversationId = await _chatRepository.createConversation('New Conversation', null);
      _currentConversationId = conversationId;
      emit(ChatLoaded(models: _models, messages: const [], conversationId: conversationId));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> loadConversation(String conversationId) async {
    emit(const ChatLoading());
    try {
      final messages = await _chatRepository.getMessages(conversationId);
      _currentConversationId = conversationId;
      emit(ChatLoaded(models: _models, messages: messages, conversationId: conversationId));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> sendMessage(String message, [String? ignoredModelId]) async {
    if (_currentConversationId == null) await startNewConversation();
    final conversationId = _currentConversationId;
    if (conversationId == null) return;

    final currentState = state;
    final existingMessages = currentState is ChatLoaded ? currentState.messages : <MessageEntity>[];
    final userMessage = MessageEntity(
      id: 'local_user_${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'user',
      content: message,
      createdAt: DateTime.now(),
    );
    final assistantMessage = MessageEntity(
      id: 'local_assistant_${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'assistant',
      content: '',
      createdAt: DateTime.now(),
      isStreaming: true,
      streamedContent: '',
    );
    _currentMessageId = assistantMessage.id;
    _currentAssistantContent = '';
    emit(ChatLoaded(
      models: _models,
      messages: [...existingMessages, userMessage, assistantMessage],
      conversationId: conversationId,
      isStreaming: true,
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
    if (currentState is ChatLoaded) {
      final updatedMessages = currentState.messages.map((message) {
        if (message.id != _currentMessageId) return message;
        return message.copyWith(
          content: _currentAssistantContent,
          streamedContent: _currentAssistantContent,
          isStreaming: true,
        );
      }).toList();
      emit(currentState.copyWith(messages: updatedMessages, isStreaming: true));
    }
  }

  void onStreamComplete() {
    final currentState = state;
    if (currentState is ChatLoaded) {
      final updatedMessages = currentState.messages.map((message) {
        if (message.id != _currentMessageId) return message;
        return message.copyWith(content: _currentAssistantContent, streamedContent: _currentAssistantContent, isStreaming: false);
      }).toList();
      emit(currentState.copyWith(messages: updatedMessages, isStreaming: false));
    }
    _currentAssistantContent = '';
    _currentMessageId = null;
  }

  void onStreamError(String error) {
    final currentState = state;
    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(isStreaming: false));
    }
    _currentAssistantContent = '';
    _currentMessageId = null;
    emit(ChatError(error));
  }

  void selectModel(String modelId) {
    final currentState = state;
    if (currentState is ChatLoaded) emit(currentState.copyWith(selectedModelId: modelId));
  }
}
