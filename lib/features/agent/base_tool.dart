abstract class BaseTool {
  final String name;
  final String description;
  final Map<String, dynamic> inputSchema;
  final bool requiresApproval;

  BaseTool({
    required this.name,
    required this.description,
    required this.inputSchema,
    this.requiresApproval = false,
  });

  Future<String> execute(Map<String, dynamic> args);
}
