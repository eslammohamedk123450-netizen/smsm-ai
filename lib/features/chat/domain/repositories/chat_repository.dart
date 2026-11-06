import '../entities/message_entity.dart';
import '../entities/model_entity.dart';

abstract class ChatRepository {
  Future<List<ModelEntity>> getAvailableModels();
  Future<ModelEntity?> getModelById(String modelId);
  Future<List<MessageEntity>> getMessages(String conversationId);
  Future<String> createConversation(String title, String? modelId);
  Future<void> sendMessage(
    String conversationId,
    String message, {
    required void Function(String chunk) onChunk,
  });
  Stream<List<MessageEntity>> messageStream(String conversationId);
  Future<void> updateMessage(String messageId, String content, bool done);
  Future<void> deleteConversation(String conversationId);
}
