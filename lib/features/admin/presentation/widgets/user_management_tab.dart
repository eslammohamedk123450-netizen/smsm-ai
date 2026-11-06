import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class UserManagementTab extends StatefulWidget {
  const UserManagementTab({super.key});

  @override
  State<UserManagementTab> createState() => _UserManagementTabState();
}

class _UserManagementTabState extends State<UserManagementTab> {
  final _searchController = TextEditingController();
  final _creditAdjustController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    _creditAdjustController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'User Management',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              labelText: 'Search users',
              hintText: 'Email or name',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              itemCount: 5,
              itemBuilder: (context, index) {
                final users = [
                  {'name': 'Ahmed Ali', 'email': 'ahmed@example.com', 'tier': 'Premium', 'credits': 1500, 'banned': false},
                  {'name': 'Sara Mohamed', 'email': 'sara@example.com', 'tier': 'Free', 'credits': 200, 'banned': false},
                  {'name': 'Omar Hassan', 'email': 'omar@example.com', 'tier': 'Pro', 'credits': 5000, 'banned': false},
                  {'name': 'Layla Ibrahim', 'email': 'layla@example.com', 'tier': 'Free', 'credits': 0, 'banned': true},
                  {'name': 'Khaled Sayed', 'email': 'khaled@example.com', 'tier': 'Premium', 'credits': 800, 'banned': false},
                ];
                final u = users[index];
                return Card(
                  color: AppColors.cardBackground,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(u['name'] as String, style: const TextStyle(color: AppColors.textPrimary)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(u['email'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        Text('Tier: ${u['tier']} • Credits: ${u['credits']}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ],
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Switch(
                          value: u['banned'] as bool,
                          onChanged: (val) {},
                          activeColor: AppColors.error,
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          icon: const Icon(Icons.add_circle, color: AppColors.success),
                          onPressed: () => _showCreditDialog(context),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showCreditDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Adjust Credits', style: TextStyle(color: AppColors.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _creditAdjustController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Amount to add/deduct',
                prefixIcon: Icon(Icons.account_balance_wallet),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Credits adjusted')),
              );
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }
}
