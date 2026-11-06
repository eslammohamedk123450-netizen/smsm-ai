import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AppConfig {
  AppConfig._();

  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String _anonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const String _publishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  static const String _edgeFunctionUrl = String.fromEnvironment('EDGE_FUNCTION_BASE_URL');

  static String get supabaseAnonKey =>
      _anonKey.isNotEmpty ? _anonKey : _publishableKey;

  static String get edgeFunctionBaseUrl => _edgeFunctionUrl.isNotEmpty
      ? _edgeFunctionUrl
      : '$supabaseUrl/functions/v1';

  static const String admobAppId = String.fromEnvironment('ADMOB_APP_ID');
  static const String admobRewardedAdUnitId = String.fromEnvironment('ADMOB_REWARDED_AD_UNIT_ID');

  static bool get isDebugMode => kDebugMode;
  static bool get isReleaseMode => kReleaseMode;
  static bool get isProfileMode => kProfileMode;
  static const Duration streamingTimeout = Duration(seconds: 180);
  static const Duration connectionTimeout = Duration(seconds: 30);
  static const int maxPromptTokens = 4096;

  static SupabaseClient get supabaseClient => Supabase.instance.client;

  static bool _isPlaceholder(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.isEmpty ||
        normalized.contains('your-anon-key-here') ||
        normalized.contains('your-project-url') ||
        normalized.contains('replace-me') ||
        normalized.contains('changeme');
  }

  static Future<void> initialize() async {
    if (_isPlaceholder(supabaseUrl) || !supabaseUrl.startsWith('https://')) {
      throw StateError('SUPABASE_URL is missing or invalid.');
    }
    if (_isPlaceholder(supabaseAnonKey)) {
      throw StateError('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is missing.');
    }

    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      authFlowType: AuthFlowType.implicit,
      authCallbackUrlTemplate: '$supabaseUrl/auth/v1/callback',
    );
  }
}
