import 'tool_registry.dart';
import 'base_tool.dart';

class ToolExecutor {
  final ToolRegistry _registry;

  ToolExecutor(this._registry);

  Future<String> executeTool(String name, Map<String, dynamic> args) async {
    final tool = _registry.getTool(name);
    if (tool == null) {
      return 'Error: Tool $name not found.';
    }

    if (tool.requiresApproval) {
      return 'Pending: Approval required for tool $name.';
    }

    try {
      return await tool.execute(args);
    } catch (e) {
      return 'Error executing $name: ${e.toString()}';
    }
  }
}
