import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';

class AppSidebar extends StatelessWidget {
  const AppSidebar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 250,
      color: AppColors.background,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton(onPressed: () {}, child: const Text('New Task')),
          ),
          Expanded(child: ListView(children: const [ListTile(title: Text('Chat 1'))])),
          ListTile(
            leading: const Icon(Icons.settings),
            title: const Text('Settings'),
            onTap: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
    );
  }
}
