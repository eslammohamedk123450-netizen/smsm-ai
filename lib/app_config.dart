import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AppConfig {
  AppConfig._();

  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String _anonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const String _publishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  static const String _edgeFunctionUrl = String.fromEnvironment('EDGE_FUNCTION_BASE_URL');

  static String get supabaseAnonKey => _anonKey.isNotEmpty ? _anonKey : _publishableKey;
  static String get edgeFunctionBaseUrl => _edgeFunctionUrl.isNotEmpty
      ? _edgeFunctionUrl
      : Uri.parse(supabaseUrl).resolve('/functions/v1').toString();

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
        normalized.contains('placeholder') ||
        normalized.contains('replace-me') ||
        normalized.contains('changeme') ||
        normalized.contains('example-key') ||
        normalized.startsWith('your-');
  }

  static bool _isServiceRoleKey(String key) {
    final normalized = key.toLowerCase();
    if (normalized.startsWith('sb_secret_') || normalized.contains('service_role')) return true;

    final parts = key.split('.');
    if (parts.length != 3) return false;
    try {
      final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      return (jsonDecode(payload) as Map<String, dynamic>)['role'] == 'service_role';
    } catch (_) {
      return false;
    }
  }

  static Future<void> initialize() async {
    final uri = Uri.tryParse(supabaseUrl);
    if (uri == null || uri.host.isEmpty || uri.scheme != 'https' || _isPlaceholder(supabaseUrl)) {
      throw StateError('SUPABASE_URL is missing or invalid.');
    }

    final key = supabaseAnonKey.trim();
    if (_isPlaceholder(key)) {
      throw StateError('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is missing.');
    }
    if (_isServiceRoleKey(key)) {
      throw StateError('Do not use a Supabase service-role/secret key in the Flutter app. Supply the public anon/publishable key.');
    }

    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: key,
      authFlowType: AuthFlowType.implicit,
      authCallbackUrlTemplate: '$supabaseUrl/auth/v1/callback',
    );
  }
}
