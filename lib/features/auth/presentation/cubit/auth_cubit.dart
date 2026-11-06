import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._authRepository) : super(const AuthInitial()) {
    _authSubscription = _authRepository.authStateChanges().listen(
      (user) {
        if (isClosed) return;
        if (user == null) {
          emit(const AuthUnauthenticated());
        } else {
          emit(AuthAuthenticated(user));
        }
      },
      onError: (Object error, StackTrace stackTrace) {
        if (!isClosed) emit(AuthError('تعذّر التحقق من جلسة تسجيل الدخول.'));
      },
    );
  }

  final AuthRepository _authRepository;
  late final StreamSubscription<UserEntity?> _authSubscription;

  Future<void> login(String email, String password) async {
    if (isClosed) return;
    emit(const AuthLoading());
    try {
      final user = await _authRepository.login(email, password);
      if (!isClosed) emit(AuthAuthenticated(user));
    } catch (error) {
      if (!isClosed) emit(AuthError(_friendlyError(error)));
    }
  }

  Future<void> register(String email, String password, String fullName) async {
    if (isClosed) return;
    emit(const AuthLoading());
    try {
      final user = await _authRepository.register(email, password, fullName);
      if (!isClosed) emit(AuthAuthenticated(user));
    } catch (error) {
      if (!isClosed) emit(AuthError(_friendlyError(error)));
    }
  }

  Future<void> logout() async {
    if (isClosed) return;
    emit(const AuthLoading());
    try {
      await _authRepository.logout();
      if (!isClosed) emit(const AuthUnauthenticated());
    } catch (error) {
      if (!isClosed) emit(AuthError(_friendlyError(error)));
    }
  }

  Future<void> checkAuth() async {
    if (isClosed) return;
    emit(const AuthChecking());
    try {
      final user = await _authRepository.getCurrentUser();
      if (isClosed) return;
      if (user != null) {
        emit(AuthAuthenticated(user));
      } else {
        emit(const AuthUnauthenticated());
      }
    } catch (_) {
      if (!isClosed) emit(const AuthUnauthenticated());
    }
  }

  String _friendlyError(Object error) {
    final message = error.toString().replaceFirst(RegExp(r'^Exception: '), '').trim();
    return message.isEmpty ? 'تعذّر إكمال طلب المصادقة. حاول مرة أخرى.' : message;
  }

  @override
  Future<void> close() async {
    await _authSubscription.cancel();
    await super.close();
  }
}
