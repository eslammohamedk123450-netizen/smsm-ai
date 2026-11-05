import 'package:get_it/get_it.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app_config.dart';
import 'core/services/admob_service.dart';
import 'core/services/credit_service.dart';
import 'core/network/supabase_client.dart';
import 'core/network/sse_client.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/data/datasources/auth_remote_datasource.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/chat/domain/repositories/chat_repository.dart';
import 'features/chat/data/repositories/chat_repository_impl.dart';
import 'features/chat/data/datasources/chat_remote_datasource.dart';
import 'features/chat/presentation/cubit/chat_cubit.dart';
import 'features/credits_ads/presentation/cubit/rewards_cubit.dart';

final GetIt getIt = GetIt.instance;

Future<void> configureDependencies() async {
  getIt.registerSingleton<SupabaseClient>(Supabase.instance.client);
  getIt.registerSingleton<SupabaseNetworkClient>(SupabaseNetworkClient());
  getIt.registerSingleton<SseClient>(SseClient());
  getIt.registerSingleton<AdMobService>(AdMobService());
  getIt.registerSingleton<CreditService>(CreditService());

  getIt.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSourceImpl(getIt<SupabaseClient>()),
  );
  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(getIt<AuthRemoteDataSource>()),
  );
  getIt.registerLazySingleton<AuthCubit>(
    () => AuthCubit(getIt<AuthRepository>()),
  );

  getIt.registerLazySingleton<ChatRemoteDataSource>(
    () => ChatRemoteDataSourceImpl(getIt<SupabaseClient>(), getIt<SseClient>()),
  );
  getIt.registerLazySingleton<ChatRepository>(
    () => ChatRepositoryImpl(getIt<ChatRemoteDataSource>()),
  );
  getIt.registerLazySingleton<ChatCubit>(
    () => ChatCubit(getIt<ChatRepository>()),
  );

  getIt.registerLazySingleton<RewardsCubit>(
    () => RewardsCubit(getIt<CreditService>()),
  );
}
