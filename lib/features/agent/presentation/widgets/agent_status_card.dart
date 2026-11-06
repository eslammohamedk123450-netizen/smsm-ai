import 'package:flutter/material.dart';

class AgentStatusCard extends StatelessWidget {
  final String status;
  const AgentStatusCard({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: const Text('Agent Status'),
        subtitle: Text(status),
      ),
    );
  }
}
