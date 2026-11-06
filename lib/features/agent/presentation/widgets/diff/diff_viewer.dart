import 'package:flutter/material.dart';

class DiffViewer extends StatelessWidget {
  final String oldText;
  final String newText;

  const DiffViewer({super.key, required this.oldText, required this.newText});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Changes Proposed:', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), border: Border.all(color: Colors.red)),
          child: Text('- $oldText', style: const TextStyle(color: Colors.red)),
        ),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), border: Border.all(color: Colors.green)),
          child: Text('+ $newText', style: const TextStyle(color: Colors.green)),
        ),
      ],
    );
  }
}
