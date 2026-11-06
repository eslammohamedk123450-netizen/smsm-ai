import 'package:flutter/material.dart';
import 'diff_viewer.dart';

class ApprovalDialog extends StatelessWidget {
  final String oldText;
  final String newText;
  final Function(bool) onResult;

  const ApprovalDialog({
    super.key,
    required this.oldText,
    required this.newText,
    required this.onResult,
  });

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Approve Code Fix'),
      content: SingleChildScrollView(
        child: DiffViewer(oldText: oldText, newText: newText),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            onResult(false);
          },
          child: const Text('Reject'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context);
            onResult(true);
          },
          child: const Text('Approve Fix'),
        ),
      ],
    );
  }
}
