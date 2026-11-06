class AppConstants {
  static const int maxPromptTokens = 32000;
  static const int racingFirstTokenTimeoutMs = 5000;
  static const int circuitBreakerFailureThreshold = 3;
  static const Duration streamingTimeout = Duration(seconds: 180);
  static const Duration connectionTimeout = Duration(seconds: 180);

  static const String freeBadgeLabel = 'FREE - FAST RACING';
  static const String premiumBadgeLabel = 'PREMIUM';

  static const String defaultConversationTitle = 'New Conversation';

  AppConstants._();
}
