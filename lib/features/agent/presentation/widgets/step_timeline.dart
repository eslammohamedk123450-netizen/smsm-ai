import 'package:flutter/material.dart';

class StepTimeline extends StatelessWidget {
  final List<String> steps;
  const StepTimeline({super.key, required this.steps});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: steps.map((step) => ListTile(leading: const Icon(Icons.radio_button_checked), title: Text(step))).toList(),
    );
  }
}
