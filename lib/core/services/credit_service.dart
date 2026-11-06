import 'dart:math';

import 'package:supabase_flutter/supabase_flutter.dart';

class CreditService {
  final SupabaseClient _supabase;

  CreditService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  void _requireOwnUser(String userId) {
    if (_supabase.auth.currentUser?.id != userId) {
      throw StateError('Credit data can only be accessed for the signed-in user.');
    }
  }

  Future<int> getCredits(String userId) async {
    _requireOwnUser(userId);
    final row = await _supabase
        .from('suly_credit_accounts')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();
    return (row?['balance'] as num?)?.toInt() ?? 0;
  }

  Future<int> getCurrentUserCredits() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return 0;
    return getCredits(userId);
  }

  Future<Map<String, dynamic>> getCreditPricingAsAdmin() async {
    final row = await _supabase
        .from('suly_credit_pricing')
        .select(
          'enabled,minimum_request_credits,input_credits_per_1k_tokens,output_credits_per_1k_tokens,updated_at',
        )
        .eq('id', 1)
        .maybeSingle();
    if (row == null) throw StateError('Credit pricing has not been configured.');
    return Map<String, dynamic>.from(row);
  }

  Future<Map<String, dynamic>> updateCreditPricingAsAdmin({
    required bool enabled,
    required int minimumRequestCredits,
    required int inputCreditsPer1kTokens,
    required int outputCreditsPer1kTokens,
  }) async {
    final response = await _supabase.rpc('suly_admin_update_credit_pricing', params: {
      'p_enabled': enabled,
      'p_minimum_request_credits': minimumRequestCredits,
      'p_input_credits_per_1k_tokens': inputCreditsPer1kTokens,
      'p_output_credits_per_1k_tokens': outputCreditsPer1kTokens,
    });
    if (response is Map) return Map<String, dynamic>.from(response);
    throw StateError('The pricing update response was invalid.');
  }

  /// Client-side ad callbacks are not proof of a verified ad completion.
  /// Grants must be issued by a trusted server-side ad verification flow.
  Future<Map<String, dynamic>> addCredits({
    required String userId,
    required int amount,
    required String source,
    String? referenceId,
  }) async {
    throw UnsupportedError(
      'Client-side credit grants are disabled; a verified server-side reward is required.',
    );
  }

  /// Model usage is settled only by ai-router after it records request usage.
  Future<Map<String, dynamic>> deductCredits({
    required String userId,
    required int totalTokens,
    required int cost,
    required String source,
    String? referenceId,
  }) async {
    throw UnsupportedError(
      'Direct client-side deductions are disabled; ai-router settles model usage.',
    );
  }

  Future<Map<String, dynamic>> adjustCreditsAsAdmin({
    required String userId,
    required int amount,
    required String reason,
    String? requestId,
  }) async {
    final response = await _supabase.rpc('suly_admin_adjust_credits', params: {
      'p_user_id': userId,
      'p_amount': amount,
      'p_reason': reason,
      'p_request_id': requestId ?? _newUuidV4(),
    });
    if (response is Map) return Map<String, dynamic>.from(response);
    throw StateError('The credit adjustment response was invalid.');
  }

  Stream<List<Map<String, dynamic>>> getCreditTransactions(String userId) {
    if (_supabase.auth.currentUser?.id != userId) {
      return Stream.error(
        StateError('Credit transactions can only be accessed for the signed-in user.'),
      );
    }
    return _supabase
        .from('suly_credit_transactions')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('created_at', ascending: false);
  }

  String _newUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((value) => value.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
