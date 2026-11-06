class AgentTask {
  final String id;
  final String goal;
  final List<String> steps;
  int currentStepIndex;

  AgentTask({
    required this.id,
    required this.goal,
    this.steps = const [],
    this.currentStepIndex = 0,
  });
}
