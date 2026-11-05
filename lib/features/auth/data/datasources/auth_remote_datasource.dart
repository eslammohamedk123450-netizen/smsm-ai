import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/errors/exceptions.dart';
import '../../domain/entities/user_entity.dart';

abstract class AuthRemoteDataSource {
  Future<UserEntity> login(String email, String password);
  Future<UserEntity> register(String email, String password, String fullName);
  Future<void> logout();
  Future<UserEntity?> getCurrentUser();
  Stream<AuthState> get authStateChanges;
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final SupabaseClient supabase;

  AuthRemoteDataSourceImpl(this.supabase);

  @override
  Future<UserEntity> login(String email, String password) async {
    try {
      final response = await supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      if (response.user == null) {
        throw AuthException(message: 'Login failed');
      }
      return _mapToUserEntity(response.user!);
    } on AuthException catch (e) {
      throw AuthException(message: e.message ?? 'Login failed');
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  @override
  Future<UserEntity> register(String email, String password, String fullName) async {
    try {
      final response = await supabase.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );
      if (response.user == null) {
        throw AuthException(message: 'Registration failed');
      }
      return _mapToUserEntity(response.user!, fullName: fullName);
    } on AuthException catch (e) {
      throw AuthException(message: e.message ?? 'Registration failed');
    } catch (e) {
      throw AuthException(message: e.toString());
    }
  }

  @override
  Future<void> logout() async {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      throw AuthException(message: 'Logout failed');
    }
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    try {
      final user = supabase.auth.currentUser;
      if (user == null) return null;
      return _mapToUserEntity(user);
    } catch (e) {
      return null;
    }
  }

  @override
  Stream<AuthState> get authStateChanges => supabase.auth.onAuthStateChange;

  UserEntity _mapToUserEntity(User user, {String? fullName}) {
    return UserEntity(
      id: user.id,
      email: user.email ?? '',
      fullName: fullName ?? user.userMetadata?['full_name'],
      avatarUrl: user.userMetadata?['avatar_url'],
      role: user.userMetadata?['role'] ?? 'user',
      isBanned: user.userMetadata?['is_banned'] ?? false,
      creditBalance: (user.userMetadata?['credit_balance'] as num?)?.toInt() ?? 0,
      subscriptionTier: user.userMetadata?['subscription_tier'] ?? 'free',
    );
  }
}
