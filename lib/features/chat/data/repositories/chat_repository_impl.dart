import '../../domain/entities/message_entity.dart';
import '../../domain/entities/model_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import '../datasources/chat_remote_datasource.dart';

class ChatRepositoryImpl implements ChatRepository {
  final ChatRemoteDataSource remoteDataSource;

  ChatRepositoryImpl(this.remoteDataSource);

  @override
  Future<List<ModelEntity>> getAvailableModels() async {
    return await remoteDataSource.getAvailableModels();
  }

  @override
  Future<ModelEntity?> getModelById(String modelId) async {
    return await remoteDataSource.getModelById(modelId);
  }

  @override
  Future<List<MessageEntity>> getMessages(String conversationId) async {
    return await remoteDataSource.getMessages(conversationId);
  }

  @override
  Future<String> createConversation(String title, String? modelId) async {
    return await remoteDataSource.createConversation(title, modelId);
  }

  @override
  Future<void> sendMessage(String conversationId, String message, String modelId) async {
    return await remoteDataSource.sendMessage(conversationId, message, modelId);
  }

  @override
  Stream<List<MessageEntity>> messageStream(String conversationId) {
    return remoteDataSource.messageStream(conversationId);
  }

  @override
  Future<void> updateMessage(String messageId, String content, bool done) async {
    return await remoteDataSource.updateMessage(messageId, content, done);
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    return await remoteDataSource.deleteConversation(conversationId);
  }
}
