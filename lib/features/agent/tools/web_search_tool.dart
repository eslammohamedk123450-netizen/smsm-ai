import '../base_tool.dart';

class WebSearchTool extends BaseTool {
  WebSearchTool() : super(
    name: 'web_search',
    description: 'Searches the web for information.',
    inputSchema: {'query': 'string'},
  );

  @override
  Future<String> execute(Map<String, dynamic> args) async {
    return 'Mock Result: Found information for query "${args['query']}".';
  }
}
