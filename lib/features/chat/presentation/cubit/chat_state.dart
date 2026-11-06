import 'package:equatable/equatable.dart';
import '../../domain/entities/message_entity.dart';

abstract class ChatState extends Equatable {
  final List<MessageEntity> messages;
  final String? conversationId;
  final String? currentModel;

  const ChatState({
    this.messages = const [],
    this.conversationId,
    this.currentModel,
  });

  @override
  List<Object?> get props => [messages, conversationId, currentModel];
}

class ChatInitial extends ChatState {
  const ChatInitial({super.messages, super.conversationId, super.currentModel});
}

class ChatLoading extends ChatState {
  const ChatLoading({super.messages, super.conversationId, super.currentModel});

  ChatLoading copyWith({
    List<MessageEntity>? messages,
    String? conversationId,
    String? currentModel,
  }) {
    return ChatLoading(
      messages: messages ?? this.messages,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
    );
  }
}

class ChatLoaded extends ChatState {
  final int creditBalance;

  const ChatLoaded({
    super.messages,
    super.conversationId,
    super.currentModel,
    this.creditBalance = 0,
  });

  ChatLoaded copyWith({
    List<MessageEntity>? messages,
    String? conversationId,
    String? currentModel,
    int? creditBalance,
  }) {
    return ChatLoaded(
      messages: messages ?? this.messages,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
      creditBalance: creditBalance ?? this.creditBalance,
    );
  }

  @override
  List<Object?> get props => [messages, conversationId, currentModel, creditBalance];
}

class ChatError extends ChatState {
  final String message;

  const ChatError({
    required this.message,
    super.messages,
    super.conversationId,
    super.currentModel,
  });

  ChatError copyWith({
    String? message,
    List<MessageEntity>? messages,
    String? conversationId,
    String? currentModel,
  }) {
    return ChatError(
      message: message ?? this.message,
      messages: messages ?? this.messages,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
    );
  }

  @override
  List<Object?> get props => [message, messages, conversationId, currentModel];
}

class ChatStreaming extends ChatState {
  final String partialContent;

  const ChatStreaming({
    required this.partialContent,
    super.messages,
    super.conversationId,
    super.currentModel,
  });

  ChatStreaming copyWith({
    String? partialContent,
    List<MessageEntity>? messages,
    String? conversationId,
    String? currentModel,
  }) {
    return ChatStreaming(
      partialContent: partialContent ?? this.partialContent,
      messages: messages ?? this.messages,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
    );
  }

  @override
  List<Object?> get props => [partialContent, messages, conversationId, currentModel];
}
