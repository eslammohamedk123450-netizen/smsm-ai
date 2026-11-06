import 'package:flutter/material.dart';

class ThinkingProcessWidget extends StatelessWidget {
  final String thought;
  const ThinkingProcessWidget({super.key, required this.thought});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Colors.blueGrey.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.blueGrey.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.psychology, color: Colors.blue),
          const SizedBox(width: 8),
          Expanded(child: Text(thought, style: const TextStyle(fontStyle: FontStyle.italic))),
        ],
      ),
    );
  }
}
