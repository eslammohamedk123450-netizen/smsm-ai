class TokenCounter {
  static int count(String text) {
    if (text.isEmpty) return 0;
    return (text.length / 4).ceil();
  }

  static int countWords(String text) {
    if (text.isEmpty) return 0;
    return text.split(RegExp(r'\s+')).where((s) => s.isNotEmpty).length;
  }

  static int estimateCost(int totalTokens, int costPer1kTokens, double multiplier) {
    return ((totalTokens / 1000) * costPer1kTokens * multiplier).ceil();
  }

  TokenCounter._();
}
