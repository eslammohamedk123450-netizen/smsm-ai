import 'package:supabase_flutter/supabase_flutter.dart';

class CreditService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<int> getCredits(String userId) async {
    final response = await _supabase
        .rpc('get_user_credits', params: {'p_user_id': userId});
    return response as int;
  }

  Future<Map<String, dynamic>> addCredits({
    required String userId,
    required int amount,
    required String source,
    String? referenceId,
  }) async {
    final response = await _supabase.rpc('add_user_credits', params: {
      'p_user_id': userId,
      'p_amount': amount,
      'p_source': source,
      'p_reference_id': referenceId,
    });
    return response as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> deductCredits({
    required String userId,
    required int totalTokens,
    required int cost,
    required String source,
    String? referenceId,
  }) async {
    final response = await _supabase.rpc('deduct_user_credits', params: {
      'p_user_id': userId,
      'p_total_tokens': totalTokens,
      'p_cost': cost,
      'p_source': source,
      'p_reference_id': referenceId,
    });
    return response as Map<String, dynamic>;
  }

  Stream<List<Map<String, dynamic>>> getCreditTransactions(String userId) {
    return _supabase
        .from('credit_transactions')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('created_at', ascending: false);
  }
}
