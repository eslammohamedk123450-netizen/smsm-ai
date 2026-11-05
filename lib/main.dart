import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:get_it/get_it.dart';
import 'app_config.dart';
import 'app_dependencies.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/chat/presentation/pages/chat_page.dart';
import 'features/admin/presentation/pages/admin_dashboard_page.dart';

final GetIt getIt = GetIt.instance;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await AppConfig.initialize();

  await MobileAds.instance.initialize();

  await configureDependencies();

  final authCubit = getIt<AuthCubit>();
  await authCubit.checkAuth();

  runApp(const MultiLLMAgentApp());
}

class MultiLLMAgentApp extends StatelessWidget {
  const MultiLLMAgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Multi-LLM AI Agent',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: _router,
    );
  }
}

final GoRouter _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const LoginPage(),
    ),
    GoRoute(
      path: '/chat',
      builder: (context, state) => const ChatPage(),
    ),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminDashboardPage(),
    ),
  ],
);
