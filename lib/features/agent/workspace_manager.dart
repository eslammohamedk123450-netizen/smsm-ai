import 'dart:io';
import 'package:path/path.dart' as path;

class WorkspaceManager {
  final String rootPath;

  WorkspaceManager(this.rootPath) {
    final dir = Directory(rootPath);
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
  }

  bool _isSafePath(String filePath) {
    final resolvedPath = path.normalize(path.join(rootPath, filePath));
    return path.isWithin(rootPath, resolvedPath);
  }

  Future<void> createFile(String fileName, String content) async {
    if (!_isSafePath(fileName)) throw Exception('Access Denied');
    final file = File(path.join(rootPath, fileName));
    await file.writeAsString(content);
  }

  Future<String> readFile(String fileName) async {
    if (!_isSafePath(fileName)) throw Exception('Access Denied');
    final file = File(path.join(rootPath, fileName));
    return await file.readAsString();
  }

  Future<void> updateFile(String fileName, String newContent) async {
    if (!_isSafePath(fileName)) throw Exception('Access Denied');
    final file = File(path.join(rootPath, fileName));
    await file.writeAsString(newContent);
  }

  Future<void> deleteFile(String fileName) async {
    if (!_isSafePath(fileName)) throw Exception('Access Denied');
    final file = File(path.join(rootPath, fileName));
    if (file.existsSync()) await file.delete();
  }

  List<String> listDirectory() {
    final dir = Directory(rootPath);
    return dir.listSync().map((e) => path.basename(e.path)).toList();
  }
}
