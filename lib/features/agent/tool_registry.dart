import 'base_tool.dart';

class ToolDefinition {
  final String name;
  final String description;
  final Map<String, dynamic> inputSchema;

  ToolDefinition({
    required this.name,
    required this.description,
    required this.inputSchema,
  });
}

class ToolRegistry {
  final Map<String, BaseTool> _tools = {};

  void registerTool(BaseTool tool) {
    _tools[tool.name] = tool;
  }

  BaseTool? getTool(String name) {
    return _tools[name];
  }

  List<ToolDefinition> getAvailableToolDefinitions() {
    return _tools.values
        .map((tool) => ToolDefinition(
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            ))
        .toList();
  }
}
