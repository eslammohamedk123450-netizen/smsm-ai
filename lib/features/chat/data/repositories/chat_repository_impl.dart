import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import '../datasources/chat_remote_datasource.dart';

class ChatRepositoryImpl implements ChatRepository {
  final ChatRemoteDataSource remoteDataSource;

  ChatRepositoryImpl(this.remoteDataSource);

  @override
  Future<List<ModelEntity>> getAvailableModels() => remoteDataSource.getAvailableModels();

  @override
  Future<ModelEntity?> getModelById(String modelId) => remoteDataSource.getModelById(modelId);

  @override
  Future<List<MessageEntity>> getMessages(String conversationId) => remoteDataSource.getMessages(conversationId);

  @override
  Future<String> createConversation(String title, String? modelId) => remoteDataSource.createConversation(title, modelId);

  @override
  Future<void> sendMessage(
    String conversationId,
    String message, {
    required void Function(String chunk) onChunk,
  }) => remoteDataSource.sendMessage(conversationId, message, onChunk: onChunk);

  @override
  Stream<List<MessageEntity>> messageStream(String conversationId) => remoteDataSource.messageStream(conversationId);

  @override
  Future<void> updateMessage(String messageId, String content, bool done) => remoteDataSource.updateMessage(messageId, content, done);

  @override
  Future<void> deleteConversation(String conversationId) => remoteDataSource.deleteConversation(conversationId);
}
