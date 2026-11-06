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
      // Credit display is deferred for the closed text beta.
    }
  }

  Future<void> initialize() async {
    if (isClosed) return;
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
      if (isClosed) return;
      emit(ChatLoaded(
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: currentModel,
        creditBalance: _creditBalance,
      ));
    } catch (error) {
      if (isClosed) return;
      emit(ChatError(
        message: 'تعذر تحميل نماذج الدردشة. حاول مرة أخرى.',
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
    if (isClosed) return;
    _currentAssistantContent = '';
    _currentMessageId = null;
    try {
      await _refreshCreditBalance();
      final conversationId = await _chatRepository.createConversation('New Conversation', modelId);
      _currentConversationId = conversationId;
      if (isClosed) return;
      emit(ChatLoaded(
        messages: const [],
        conversationId: conversationId,
        currentModel: modelId,
        models: _models,
        creditBalance: _creditBalance,
      ));
    } catch (_) {
      if (isClosed) return;
      emit(ChatError(
        message: 'تعذر إنشاء المحادثة. حاول مرة أخرى.',
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: state.currentModel,
        creditBalance: _creditBalance,
      ));
    }
  }

  Future<void> loadConversation(String conversationId) async {
    if (isClosed) return;
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
      if (isClosed) return;
      emit(ChatLoaded(
        messages: messages,
        conversationId: conversationId,
        currentModel: currentModel,
        models: _models,
        creditBalance: _creditBalance,
      ));
    } catch (_) {
      if (isClosed) return;
      emit(ChatError(
        message: 'تعذر تحميل المحادثة. حاول مرة أخرى.',
        messages: const [],
        models: _models,
        conversationId: _currentConversationId,
        currentModel: currentModel,
        creditBalance: _creditBalance,
      ));
    }
  }

  Future<void> sendMessage(String message, [String? modelId]) async {
    final text = message.trim();
    if (isClosed || state.isStreaming || text.isEmpty) return;
    final currentModel = modelId ?? state.currentModel;
    if (_currentConversationId == null) await startNewConversation(currentModel);
    final conversationId = _currentConversationId;
    if (conversationId == null || isClosed) return;

    await _refreshCreditBalance();
    final existingMessages = state.messages;
    final now = DateTime.now();
    final userMessage = MessageEntity(
      id: 'local_user_${now.microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'user',
      content: text,
      status: 'sent',
      createdAt: now,
    );
    final assistantMessage = MessageEntity(
      id: 'local_assistant_${now.microsecondsSinceEpoch}',
      conversationId: conversationId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      isStreaming: true,
      createdAt: now,
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
      await _chatRepository.sendMessage(conversationId, text, onChunk: onStreamChunk);
      if (!isClosed) await onStreamComplete();
    } catch (_) {
      if (isClosed) return;
      await _refreshCreditBalance();
      onStreamError('تعذر الاتصال بخدمة الدردشة. حاول مرة أخرى.');
    }
  }

  void onStreamChunk(String chunk) {
    if (isClosed || _currentMessageId == null) return;
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
    if (isClosed) return;
    await _refreshCreditBalance();
    if (isClosed) return;
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
    if (isClosed) return;
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
    if (isClosed) return;
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
