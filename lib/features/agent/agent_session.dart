class AgentSession {
  final String id;
  String status;
  final List<String> history;
  List<String>? currentPlan;

  AgentSession({
    required this.id,
    this.status = 'idle',
    this.history = const [],
    this.currentPlan,
  });
}
