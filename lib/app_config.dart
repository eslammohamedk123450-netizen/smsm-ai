import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AppConfig {
  AppConfig._();

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://your-project-ref.supabase.co',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'your-anon-key-here',
  );

  static const String edgeFunctionBaseUrl = String.fromEnvironment(
    'EDGE_FUNCTION_BASE_URL',
    defaultValue: 'https://your-project-ref.supabase.co/functions/v1',
  );

  static const String admobAppId = String.fromEnvironment(
    'ADMOB_APP_ID',
    defaultValue: 'ca-app-pub-3940256099942544~3347511713',
  );

  static const String admobRewardedAdUnitId = String.fromEnvironment(
    'ADMOB_REWARDED_AD_UNIT_ID',
    defaultValue: 'ca-app-pub-3940256099942544/5224354917',
  );

  static bool get isDebugMode => kDebugMode;

  static bool get isReleaseMode => kReleaseMode;

  static bool get isProfileMode => kProfileMode;

  static const Duration streamingTimeout = Duration(seconds: 30);

  static const Duration connectionTimeout = Duration(seconds: 15);

  static const int maxPromptTokens = 32000;

  static const int racingFirstTokenTimeoutMs = 8000;

  static const int circuitBreakerFailureThreshold = 3;

  static const Duration circuitBreakerSuspensionDuration = Duration(minutes: 15);

  static SupabaseClient get supabaseClient => Supabase.instance.client;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      authFlowType: AuthFlowType.implicit,
      authCallbackUrlTemplate: '${supabaseUrl}/auth/v1/callback',
    );
  }
}
