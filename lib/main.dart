import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_config.dart';
import 'app_dependencies.dart';
import 'core/theme/app_theme.dart';
import 'features/admin/presentation/pages/admin_dashboard_page.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/chat/presentation/cubit/chat_cubit.dart';
import 'features/chat/presentation/pages/chat_page.dart';

final GetIt getIt = GetIt.instance;
late final GoRouter _router;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await AppConfig.initialize();
  await MobileAds.instance.initialize();
  await configureDependencies();

  final authCubit = getIt<AuthCubit>();
  await authCubit.checkAuth();
  unawaited(authCubit.listenToAuthChanges());

  _router = GoRouter(
    initialLocation: '/',
    refreshListenable: GoRouterRefreshStream(
      Supabase.instance.client.auth.onAuthStateChange,
    ),
    redirect: (context, state) async {
      final user = Supabase.instance.client.auth.currentUser;
      final isLogin = state.matchedLocation == '/';
      final isAdmin = state.matchedLocation == '/admin';
      final isPrivate = state.matchedLocation == '/chat' || isAdmin;

      if (isPrivate && user == null) return '/';
      if (isLogin && user != null) return '/chat';
      if (!isAdmin || user == null) return null;

      try {
        final result = await Supabase.instance.client.rpc('suly_is_admin');
        return result == true ? null : '/chat';
      } catch (_) {
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

  runApp(const MultiLLMAgentApp());
}

class MultiLLMAgentApp extends StatelessWidget {
  const MultiLLMAgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthCubit>.value(value: getIt<AuthCubit>()),
        BlocProvider<ChatCubit>.value(value: getIt<ChatCubit>()),
      ],
      child: MaterialApp.router(
        title: 'SMSM AI',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        routerConfig: _router,
      ),
    );
  }
}
