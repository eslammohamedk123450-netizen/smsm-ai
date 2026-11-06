import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_config.dart';
import 'app_dependencies.dart';
import 'core/theme/app_theme.dart';
import 'features/admin/presentation/pages/admin_dashboard_page.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/auth/presentation/cubit/auth_state.dart';
import 'features/auth/presentation/pages/login_page.dart';
import 'features/chat/presentation/cubit/chat_cubit.dart';
import 'features/chat/presentation/pages/chat_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await AppConfig.initialize();
    await configureDependencies();
    final authCubit = getIt<AuthCubit>();
    await authCubit.checkAuth();
    runApp(MultiLLMAgentApp(authCubit: authCubit));
  } catch (error) {
    runApp(StartupFailureApp(message: error.toString()));
  }
}

class MultiLLMAgentApp extends StatefulWidget {
  const MultiLLMAgentApp({required this.authCubit, super.key});

  final AuthCubit authCubit;

  @override
  State<MultiLLMAgentApp> createState() => _MultiLLMAgentAppState();
}

class _MultiLLMAgentAppState extends State<MultiLLMAgentApp> {
  late final _AuthRouterRefresh _authRefresh;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _authRefresh = _AuthRouterRefresh(widget.authCubit.stream);
    _router = GoRouter(
      initialLocation: '/loading',
      refreshListenable: _authRefresh,
      redirect: (context, state) async {
        final location = state.matchedLocation;
        final authState = widget.authCubit.state;
        final isCheckingAuth = authState is AuthInitial || authState is AuthChecking;
        if (isCheckingAuth || authState is AuthLoading) {
          if (location == '/loading' || location == '/login') return null;
          return '/loading';
        }

        final isAuthenticated = authState is AuthAuthenticated;
        if (location == '/' || location == '/loading') {
          return isAuthenticated ? '/chat' : '/login';
        }
        if (location == '/login') return isAuthenticated ? '/chat' : null;
        if (location == '/chat' && !isAuthenticated) return '/login';
        if (location == '/admin') {
          if (!isAuthenticated) return '/login';
          try {
            final result = await Supabase.instance.client.rpc('suly_is_admin');
            return result == true ? null : '/chat';
          } catch (_) {
            return '/chat';
          }
        }
        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (context, state) => const _AuthLoadingPage()),
        GoRoute(path: '/loading', builder: (context, state) => const _AuthLoadingPage()),
        GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
        GoRoute(
          path: '/chat',
          builder: (context, state) => BlocProvider<ChatCubit>(
            create: (_) => getIt<ChatCubit>()..initialize(),
            child: const ChatPage(),
          ),
        ),
        GoRoute(path: '/admin', builder: (context, state) => const AdminDashboardPage()),
      ],
    );
  }

  @override
  void dispose() {
    _router.dispose();
    _authRefresh.dispose();
    unawaited(widget.authCubit.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthCubit>.value(
      value: widget.authCubit,
      child: MaterialApp.router(
        title: 'SMSM AI',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.darkTheme,
        routerConfig: _router,
      ),
    );
  }
}

class _AuthRouterRefresh extends ChangeNotifier {
  _AuthRouterRefresh(Stream<AuthState> stream) {
    _subscription = stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<AuthState> _subscription;

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }
}

class _AuthLoadingPage extends StatelessWidget {
  const _AuthLoadingPage();

  @override
  Widget build(BuildContext context) => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
}

class StartupFailureApp extends StatelessWidget {
  const StartupFailureApp({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) => MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off, size: 48),
                    const SizedBox(height: 16),
                    const Text(
                      'تعذّر تشغيل التطبيق. تحقّق من إعدادات Supabase والاتصال ثم أعد المحاولة.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(message, textAlign: TextAlign.center),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}
