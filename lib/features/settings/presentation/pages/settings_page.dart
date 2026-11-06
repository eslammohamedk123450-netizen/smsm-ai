import 'package:flutter/material.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: const [
          ListTile(title: Text('Language'), trailing: Icon(Icons.chevron_right)),
          ListTile(title: Text('Theme'), trailing: Icon(Icons.chevron_right)),
          ListTile(title: Text('API Keys'), trailing: Icon(Icons.chevron_right)),
          ListTile(title: Text('Logout'), iconColor: Colors.red),
        ],
      ),
    );
  }
}
