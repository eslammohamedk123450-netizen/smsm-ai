import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../widgets/api_keys_tab.dart';
import '../widgets/model_management_tab.dart';
import '../widgets/circuit_breaker_tab.dart';
import '../widgets/user_management_tab.dart';
import '../../../../core/theme/app_theme.dart';

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
    _tabController = TabController(length: 4, vsync: this);
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
          tabs: const [
            Tab(text: 'API Keys', icon: Icon(Icons.key)),
            Tab(text: 'Models', icon: Icon(Icons.model_training)),
            Tab(text: 'Circuit Breaker', icon: Icon(Icons.breaker)),
            Tab(text: 'Users', icon: Icon(Icons.people)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => Navigator.pop(context),
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
        ],
      ),
    );
  }
}
