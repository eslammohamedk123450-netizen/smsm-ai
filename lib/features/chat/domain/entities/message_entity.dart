class MessageEntity {
  final String id;
  final String conversationId;
  final String role;
  final String content;
  final int tokenCount;
  final String? modelId;
  final DateTime createdAt;
  final bool isStreaming;
  final String streamedContent;

  const MessageEntity({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    this.tokenCount = 0,
    this.modelId,
    required this.createdAt,
    this.isStreaming = false,
    this.streamedContent = '',
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

  MessageEntity copyWith({
    String? id,
    String? conversationId,
    String? role,
    String? content,
    int? tokenCount,
    String? modelId,
    DateTime? createdAt,
    bool? isStreaming,
    String? streamedContent,
  }) {
    return MessageEntity(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      role: role ?? this.role,
      content: content ?? this.content,
      tokenCount: tokenCount ?? this.tokenCount,
      modelId: modelId ?? this.modelId,
      createdAt: createdAt ?? this.createdAt,
      isStreaming: isStreaming ?? this.isStreaming,
      streamedContent: streamedContent ?? this.streamedContent,
    );
  }

  @override
  String toString() {
    return 'MessageEntity(id: $id, role: $role, content: ${content.length} chars)';
  }
}
