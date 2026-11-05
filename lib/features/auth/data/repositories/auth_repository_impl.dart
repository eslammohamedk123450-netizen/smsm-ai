import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;

  AuthRepositoryImpl(this.remoteDataSource);

  @override
  Future<UserEntity> login(String email, String password) async {
    return await remoteDataSource.login(email, password);
  }

  @override
  Future<UserEntity> register(String email, String password, String fullName) async {
    return await remoteDataSource.register(email, password, fullName);
  }

  @override
  Future<void> logout() async {
    return await remoteDataSource.logout();
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    return await remoteDataSource.getCurrentUser();
  }

  @override
  Stream<UserEntity?> authStateChanges() {
    return remoteDataSource.authStateChanges.map((state) {
      final user = state.session?.user;
      if (user == null) return null;
      return UserEntity(
        id: user.id,
        email: user.email ?? '',
        fullName: user.userMetadata?['full_name'],
        avatarUrl: user.userMetadata?['avatar_url'],
        role: user.userMetadata?['role'] ?? 'user',
        isBanned: user.userMetadata?['is_banned'] ?? false,
        creditBalance: (user.userMetadata?['credit_balance'] as num?)?.toInt() ?? 0,
        subscriptionTier: user.userMetadata?['subscription_tier'] ?? 'free',
      );
    });
  }

  @override
  Future<bool> isAuthenticated() async {
    final user = await getCurrentUser();
    return user != null;
  }
}
