import '../base_tool.dart';
import '../workspace_manager.dart';

class FileWriteTool extends BaseTool {
  final WorkspaceManager workspace;
  FileWriteTool(this.workspace) : super(
    name: 'file_write',
    description: 'Writes content to a local file.',
    inputSchema: {'path': 'string', 'content': 'string'},
  );

  @override
  Future<String> execute(Map<String, dynamic> args) async {
    try {
      await workspace.createFile(args['path'], args['content']);
      return 'Success: File ${args['path']} written.';
    } catch (e) {
      return 'Error: Could not write file ${args['path']}: $e';
    }
  }
}
