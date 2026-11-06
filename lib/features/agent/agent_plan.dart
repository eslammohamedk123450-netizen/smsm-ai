class AgentStep {
  final String description;
  bool isCompleted;

  AgentStep({
    required this.description,
    this.isCompleted = false,
  });
}

class AgentPlan {
  final List<AgentStep> steps;

  AgentPlan({required this.steps});
}
