import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../widgets/api_keys_tab.dart';
import '../widgets/model_management_tab.dart';
import '../widgets/circuit_breaker_tab.dart';
import '../widgets/user_management_tab.dart';
import '../widgets/credit_management_tab.dart';
import '../../../../core/theme/app_colors.dart';

class AdminDashboardPage extends StatefulWidget {
  const AdminDashboardPage({super.key});

  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}

class _AdminDashboardPageState extends State<AdminDashboardPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          isScrollable: true,
          tabs: const [
            Tab(text: 'API Keys', icon: Icon(Icons.key)),
            Tab(text: 'Models', icon: Icon(Icons.model_training)),
            Tab(text: 'Circuit Breaker', icon: Icon(Icons.breaker)),
            Tab(text: 'Users', icon: Icon(Icons.people)),
            Tab(text: 'Credits', icon: Icon(Icons.account_balance_wallet)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              try {
                await Supabase.instance.client.auth.signOut();
                if (context.mounted) context.go('/');
              } catch (error) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Sign out failed: $error')),
                  );
                }
              }
            },
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          ApiKeysTab(),
          ModelManagementTab(),
          CircuitBreakerTab(),
          UserManagementTab(),
          CreditManagementTab(),
        ],
      ),
    );
  }
}
