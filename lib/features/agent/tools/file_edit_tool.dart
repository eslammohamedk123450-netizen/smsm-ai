import '../base_tool.dart';
import '../workspace_manager.dart';

class FileEditTool extends BaseTool {
  final WorkspaceManager workspace;
  FileEditTool(this.workspace) : super(
    name: 'file_edit',
    description: 'Edits content of a local file.',
    inputSchema: {'path': 'string', 'content': 'string'},
  );

  @override
  Future<String> execute(Map<String, dynamic> args) async {
    try {
      await workspace.updateFile(args['path'], args['content']);
      return 'Success: File ${args['path']} edited.';
    } catch (e) {
      return 'Error: Could not edit file ${args['path']}: $e';
    }
  }
}
