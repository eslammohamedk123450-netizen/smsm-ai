import '../base_tool.dart';

class FileReadTool extends BaseTool {
  FileReadTool() : super(
    name: 'file_read',
    description: 'Reads the content of a local file.',
    inputSchema: {'path': 'string'},
  );

  @override
  Future<String> execute(Map<String, dynamic> args) async {
    return 'Mock Result: File content for "${args['path']}" is "This is dummy file content".';
  }
}
