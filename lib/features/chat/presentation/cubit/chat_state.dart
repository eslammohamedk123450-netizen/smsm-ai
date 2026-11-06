import 'package:equatable/equatable.dart';

import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';

abstract class ChatState extends Equatable {
  final List<MessageEntity> messages;
  final List<ModelEntity> models;
  final String? conversationId;
  final String? currentModel;
  final int creditBalance;
  final bool isStreaming;

  const ChatState({
    this.messages = const [],
    this.models = const [],
    this.conversationId,
    this.currentModel,
    this.creditBalance = 0,
    this.isStreaming = false,
  });

  @override
  List<Object?> get props => [
        messages,
        models,
        conversationId,
        currentModel,
        creditBalance,
        isStreaming,
      ];
}

class ChatInitial extends ChatState {
  const ChatInitial({
    super.messages,
    super.models,
    super.conversationId,
    super.currentModel,
    super.creditBalance,
  });
}

class ChatLoading extends ChatState {
  const ChatLoading({
    super.messages,
    super.models,
    super.conversationId,
    super.currentModel,
    super.creditBalance,
  });
}

class ChatLoaded extends ChatState {
  const ChatLoaded({
    super.messages,
    super.models,
    super.conversationId,
    super.currentModel,
    super.creditBalance,
    super.isStreaming,
  });

  ChatLoaded copyWith({
    List<MessageEntity>? messages,
    List<ModelEntity>? models,
    String? conversationId,
    String? currentModel,
    int? creditBalance,
    bool? isStreaming,
  }) {
    return ChatLoaded(
      messages: messages ?? this.messages,
      models: models ?? this.models,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
      creditBalance: creditBalance ?? this.creditBalance,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }
}

class ChatError extends ChatState {
  final String message;

  const ChatError({
    required this.message,
    super.messages,
    super.models,
    super.conversationId,
    super.currentModel,
    super.creditBalance,
  });

  ChatError copyWith({
    String? message,
    List<MessageEntity>? messages,
    List<ModelEntity>? models,
    String? conversationId,
    String? currentModel,
    int? creditBalance,
  }) {
    return ChatError(
      message: message ?? this.message,
      messages: messages ?? this.messages,
      models: models ?? this.models,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
      creditBalance: creditBalance ?? this.creditBalance,
    );
  }

  @override
  List<Object?> get props => [...super.props, message];
}

class ChatStreaming extends ChatState {
  final String partialContent;

  const ChatStreaming({
    required this.partialContent,
    super.messages,
    super.models,
    super.conversationId,
    super.currentModel,
    super.creditBalance,
    super.isStreaming = true,
  });

  ChatStreaming copyWith({
    String? partialContent,
    List<MessageEntity>? messages,
    List<ModelEntity>? models,
    String? conversationId,
    String? currentModel,
    int? creditBalance,
    bool? isStreaming,
  }) {
    return ChatStreaming(
      partialContent: partialContent ?? this.partialContent,
      messages: messages ?? this.messages,
      models: models ?? this.models,
      conversationId: conversationId ?? this.conversationId,
      currentModel: currentModel ?? this.currentModel,
      creditBalance: creditBalance ?? this.creditBalance,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }

  @override
  List<Object?> get props => [...super.props, partialContent];
}
