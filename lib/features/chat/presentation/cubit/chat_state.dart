import 'package:equatable/equatable.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';

abstract class ChatState extends Equatable {
  const ChatState();

  @override
  List<Object?> get props => [];
}

class ChatInitial extends ChatState {
  const ChatInitial();
}

class ChatLoading extends ChatState {
  const ChatLoading();
}

class ChatLoaded extends ChatState {
  final List<MessageEntity> messages;
  final List<ModelEntity> models;
  final String? selectedModelId;
  final String? conversationId;
  final bool isStreaming;
  final int creditBalance;

  const ChatLoaded({
    this.messages = const [],
    this.models = const [],
    this.selectedModelId,
    this.conversationId,
    this.isStreaming = false,
    this.creditBalance = 0,
  });

  ChatLoaded copyWith({
    List<MessageEntity>? messages,
    List<ModelEntity>? models,
    String? selectedModelId,
    String? conversationId,
    bool? isStreaming,
    int? creditBalance,
  }) {
    return ChatLoaded(
      messages: messages ?? this.messages,
      models: models ?? this.models,
      selectedModelId: selectedModelId ?? this.selectedModelId,
      conversationId: conversationId ?? this.conversationId,
      isStreaming: isStreaming ?? this.isStreaming,
      creditBalance: creditBalance ?? this.creditBalance,
    );
  }

  @override
  List<Object?> get props => [messages, models, selectedModelId, conversationId, isStreaming, creditBalance];
}

class ChatError extends ChatState {
  final String message;
  const ChatError(this.message);

  @override
  List<Object?> get props => [message];
}

class MessageStreaming extends ChatState {
  final String partialContent;
  const MessageStreaming(this.partialContent);

  @override
  List<Object?> get props => [partialContent];
}
