import '../base_tool.dart';
import '../workspace_manager.dart';

class FileReadTool extends BaseTool {
  final WorkspaceManager workspace;
  FileReadTool(this.workspace) : super(
    name: 'file_read',
    description: 'Reads the content of a local file.',
    inputSchema: {'path': 'string'},
  );

  @override
  Future<String> execute(Map<String, dynamic> args) async {
    try {
      return await workspace.readFile(args['path']);
    } catch (e) {
      return 'Error: Could not read file ${args['path']}: $e';
    }
  }
}
