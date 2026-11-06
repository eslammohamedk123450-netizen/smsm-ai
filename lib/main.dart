import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:get_it/get_it.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_config.dart';
import 'app_dependencies.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
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
  redirect: (context, state) async {
    if (state.matchedLocation != '/admin') return null;
    final client = Supabase.instance.client;
    if (client.auth.currentUser == null) return '/';
    try {
      final isAdmin = await client.rpc('suly_is_admin');
      return isAdmin == true ? null : '/chat';
    } catch (_) {
      // Fail closed if the administrator role cannot be verified.
      return '/chat';
    }
  },
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
