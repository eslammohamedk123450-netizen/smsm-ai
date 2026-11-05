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

  Future<void> initialize() async {
    emit(const ChatLoading());
    try {
      final models = await _chatRepository.getAvailableModels();
      emit(ChatLoaded(models: models, creditBalance: 0));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> startNewConversation(String? modelId) async {
    _currentAssistantContent = '';
    _currentMessageId = null;

    try {
      final conversationId = await _chatRepository.createConversation(
        'New Conversation',
        modelId,
      );
      _currentConversationId = conversationId;
      emit(ChatLoaded(
        messages: [],
        selectedModelId: modelId,
        conversationId: conversationId,
      ));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> loadConversation(String conversationId) async {
    emit(const ChatLoading());
    try {
      final messages = await _chatRepository.getMessages(conversationId);
      _currentConversationId = conversationId;
      emit(ChatLoaded(messages: messages, conversationId: conversationId));
    } catch (e) {
      emit(ChatError(e.toString()));
    }
  }

  Future<void> sendMessage(String message, String modelId) async {
    if (_currentConversationId == null) {
      await startNewConversation(modelId);
    }

    final userMessage = MessageEntity(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      conversationId: _currentConversationId!,
      role: 'user',
      content: message,
      createdAt: DateTime.now(),
    );

    final currentState = state;
    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(messages: [...currentState.messages, userMessage]));
    }

    _currentAssistantContent = '';
    _currentMessageId = null;

    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(isStreaming: true));
    }

    try {
      await _chatRepository.sendMessage(_currentConversationId!, message, modelId);

      final aiMessage = MessageEntity(
        id: 'temp_${DateTime.now().millisecondsSinceEpoch}',
        conversationId: _currentConversationId!,
        role: 'assistant',
        content: '',
        createdAt: DateTime.now(),
        isStreaming: true,
        streamedContent: '',
      );

      if (currentState is ChatLoaded) {
        emit(currentState.copyWith(
          messages: [...currentState.messages, aiMessage],
          isStreaming: true,
        ));
      }

      _currentMessageId = aiMessage.id;
    } catch (e) {
      if (currentState is ChatLoaded) {
        emit(currentState.copyWith(isStreaming: false));
      }
      emit(ChatError(e.toString()));
    }
  }

  void onStreamChunk(String chunk) {
    _currentAssistantContent += chunk;

    final currentState = state;
    if (currentState is ChatLoaded) {
      final updatedMessages = currentState.messages.map((msg) {
        if (msg.id == _currentMessageId) {
          return msg.copyWith(
            content: _currentAssistantContent,
            streamedContent: _currentAssistantContent,
            isStreaming: true,
          );
        }
        return msg;
      }).toList();

      emit(currentState.copyWith(
        messages: updatedMessages,
        isStreaming: true,
      ));
    }
  }

  void onStreamComplete() {
    _currentAssistantContent = '';
    _currentMessageId = null;

    final currentState = state;
    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(isStreaming: false));
    }
  }

  void onStreamError(String error) {
    _currentAssistantContent = '';
    _currentMessageId = null;

    final currentState = state;
    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(isStreaming: false));
    }
    emit(ChatError(error));
  }

  void selectModel(String modelId) {
    final currentState = state;
    if (currentState is ChatLoaded) {
      emit(currentState.copyWith(selectedModelId: modelId));
    }
  }
}
