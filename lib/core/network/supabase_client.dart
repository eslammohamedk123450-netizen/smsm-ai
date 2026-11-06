import 'package:supabase_flutter/supabase_flutter.dart' hide AuthException;
import '../errors/exceptions.dart';

class SupabaseNetworkClient {
  SupabaseClient get client => Supabase.instance.client;

  Future<T> handleAsync<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on AuthException {
      rethrow;
    } on PostgrestException catch (e) {
      throw ServerException(
        message: e.message,
        statusCode: e.code?.toInt() ?? 500,
        details: e.details,
      );
    } on StorageException catch (e) {
      throw ServerException(
        message: e.message,
        statusCode: e.statusCode ?? 500,
        details: e.details,
      );
    } on AuthException catch (e) {
      throw AuthException(message: e.message, details: e.details);
    } catch (e) {
      if (e is AppException) rethrow;
      throw ServerException(message: e.toString());
    }
  }

  Future<bool> isAuthenticated() {
    return Future.value(client.auth.currentUser != null);
  }

  String? get currentUserId => client.auth.currentUser?.id;

  Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;
}
