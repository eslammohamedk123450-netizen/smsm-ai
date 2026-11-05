class AppConstants {
  static const int maxPromptTokens = 32000;
  static const int racingFirstTokenTimeoutMs = 8000;
  static const int circuitBreakerFailureThreshold = 3;
  static const Duration circuitBreakerSuspensionDuration = Duration(minutes: 15);
  static const Duration streamingTimeout = Duration(seconds: 30);
  static const Duration connectionTimeout = Duration(seconds: 15);

  static const String freeBadgeLabel = 'FREE - FAST RACING';
  static const String premiumBadgeLabel = 'PREMIUM';

  static const String defaultConversationTitle = 'New Conversation';

  AppConstants._();
}
