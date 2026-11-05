import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<UserEntity> login(String email, String password);

  Future<UserEntity> register(String email, String password, String fullName);

  Future<void> logout();

  Future<UserEntity?> getCurrentUser();

  Stream<UserEntity?> authStateChanges();

  Future<bool> isAuthenticated();
}
