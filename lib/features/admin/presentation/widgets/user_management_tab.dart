import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/services/credit_service.dart';
import '../../../../core/theme/app_colors.dart';

class UserManagementTab extends StatefulWidget {
  const UserManagementTab({super.key});

  @override
  State<UserManagementTab> createState() => _UserManagementTabState();
}

class _UserManagementTabState extends State<UserManagementTab> {
  final _client = Supabase.instance.client;
  final _creditService = CreditService();
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _users = const [];
  bool _loading = true;
  String? _error;

  List<Map<String, dynamic>> get _filteredUsers {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return _users;
    return _users.where((user) {
      return '${user['email'] ?? ''}'.toLowerCase().contains(query) ||
          '${user['full_name'] ?? ''}'.toLowerCase().contains(query) ||
          '${user['id'] ?? ''}'.toLowerCase().contains(query);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final responses = await Future.wait<dynamic>([
        _client
            .from('suly_profiles')
            .select('id,email,full_name,subscription_tier,is_banned,created_at')
            .order('created_at', ascending: false)
            .limit(200),
        _client.from('suly_credit_accounts').select('user_id,balance,reserved_balance').limit(500),
      ]);
      final accounts = <String, Map<String, dynamic>>{
        for (final row in (responses[1] as List).cast<Map<String, dynamic>>())
          '${row['user_id']}': row,
      };
      final profiles = (responses[0] as List).cast<Map<String, dynamic>>();
      final users = profiles.map((profile) {
        final account = accounts['${profile['id']}'];
        return <String, dynamic>{
          ...profile,
          'balance': (account?['balance'] as num?)?.toInt() ?? 0,
          'reserved_balance': (account?['reserved_balance'] as num?)?.toInt() ?? 0,
        };
      }).toList();
      if (!mounted) return;
      setState(() {
        _users = users;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'تعذر تحميل المستخدمين. تحقق من صلاحية المشرف وسياسات RLS. $error';
        _loading = false;
      });
    }
  }

  Future<void> _adjustCredits(Map<String, dynamic> user) async {
    final amountController = TextEditingController();
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('تعديل رصيد ${user['email'] ?? user['id']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountController,
              keyboardType: const TextInputType.numberWithOptions(signed: true),
              decoration: const InputDecoration(labelText: 'المقدار (موجب للإضافة وسالب للخصم)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLength: 500,
              decoration: const InputDecoration(labelText: 'السبب الإلزامي للتدقيق'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('تنفيذ')),
        ],
      ),
    );
    if (confirmed != true) {
      amountController.dispose();
      reasonController.dispose();
      return;
    }
    final amount = int.tryParse(amountController.text.trim());
    final reason = reasonController.text.trim();
    amountController.dispose();
    reasonController.dispose();
    if (amount == null || amount == 0 || reason.isEmpty) {
      _showMessage('أدخل قيمة غير صفرية وسببًا واضحًا.');
      return;
    }
    try {
      final result = await _creditService.adjustCreditsAsAdmin(
        userId: '${user['id']}',
        amount: amount,
        reason: reason,
      );
      if (result['success'] != true) {
        _showMessage(result['error'] == 'insufficient_credits'
            ? 'لا يمكن خصم مبلغ أكبر من الرصيد المتاح.'
            : 'رفضت قاعدة البيانات تعديل الرصيد.');
        return;
      }
      _showMessage('تم تسجيل التعديل في سجل التدقيق. الرصيد الجديد: ${result['balance']}');
      await _loadUsers();
    } catch (error) {
      _showMessage('فشل تعديل الرصيد: $error');
    }
  }

  Future<void> _setBanned(Map<String, dynamic> user, bool banned) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(banned ? 'حظر المستخدم؟' : 'إلغاء الحظر؟'),
        content: Text('${user['email'] ?? user['id']} ${banned ? 'لن يستطيع استخدام الخدمات.' : 'سيتمكن من استخدام الخدمات مجددًا.'}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('تأكيد')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _client.rpc('suly_admin_set_user_banned', params: {
        'p_user_id': user['id'],
        'p_banned': banned,
      });
      _showMessage(banned ? 'تم حظر المستخدم.' : 'تم إلغاء الحظر.');
      await _loadUsers();
    } catch (error) {
      _showMessage('فشل تحديث حالة المستخدم: $error');
    }
  }

  Future<void> _showUserTransactions(Map<String, dynamic> user) async {
    try {
      final transactions = await _client
          .from('suly_credit_transactions')
          .select('event_type,amount,balance_delta,balance_after,actual_cost,input_tokens,output_tokens,model_id,source,reason,created_at')
          .eq('user_id', user['id'])
          .order('created_at', ascending: false)
          .limit(50);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('سجل رصيد ${user['email'] ?? user['id']}'),
          content: SizedBox(
            width: 560,
            child: (transactions as List).isEmpty
                ? const Center(child: Text('لا توجد معاملات مسجلة.'))
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: (transactions as List).length,
                    itemBuilder: (context, index) {
                      final row = transactions[index] as Map<String, dynamic>;
                      final tokens = ((row['input_tokens'] as num?)?.toInt() ?? 0) +
                          ((row['output_tokens'] as num?)?.toInt() ?? 0);
                      return ListTile(
                        dense: true,
                        title: Text('${row['event_type']} · ${row['amount']} عملة'),
                        subtitle: Text([
                          'الرصيد بعد العملية: ${row['balance_after']} · tokens: $tokens',
                          if (row['model_id'] != null) 'Model ID: ${row['model_id']}',
                          if (row['reason'] != null) '${row['reason']}',
                          '${row['created_at']}',
                        ].join('\n')),
                      );
                    },
                  ),
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إغلاق'))],
        ),
      );
    } catch (error) {
      _showMessage('تعذر تحميل سجل الرصيد: $error');
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final users = _filteredUsers;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'ابحث بالاسم أو البريد أو UUID',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
              IconButton(onPressed: _loading ? null : _loadUsers, icon: const Icon(Icons.refresh), tooltip: 'تحديث'),
            ],
          ),
        ),
        if (_error != null)
          Padding(padding: const EdgeInsets.all(12), child: Text(_error!, style: const TextStyle(color: AppColors.error))),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : users.isEmpty
                  ? const Center(child: Text('لا يوجد مستخدمون مطابقون للبحث.'))
                  : RefreshIndicator(
                      onRefresh: _loadUsers,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: users.length,
                        itemBuilder: (context, index) => _userCard(users[index]),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _userCard(Map<String, dynamic> user) {
    final isBanned = user['is_banned'] == true;
    final name = '${user['full_name'] ?? ''}'.trim();
    return Card(
      color: AppColors.cardBackground,
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        title: Text(name.isEmpty ? '${user['email'] ?? 'مستخدم'}' : name, style: const TextStyle(color: AppColors.textPrimary)),
        subtitle: Text([
          '${user['email'] ?? ''}',
          'الباقة: ${user['subscription_tier'] ?? 'free'} · الرصيد: ${user['balance']} · المحجوز: ${user['reserved_balance']}',
          'UUID: ${user['id']}',
        ].join('\n'), style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        isThreeLine: true,
        trailing: Wrap(
          spacing: 2,
          children: [
            IconButton(
              tooltip: 'سجل الرصيد',
              icon: const Icon(Icons.receipt_long),
              onPressed: () => _showUserTransactions(user),
            ),
            IconButton(
              tooltip: 'تعديل الرصيد',
              icon: const Icon(Icons.account_balance_wallet_outlined, color: AppColors.success),
              onPressed: () => _adjustCredits(user),
            ),
            IconButton(
              tooltip: isBanned ? 'إلغاء الحظر' : 'حظر المستخدم',
              icon: Icon(isBanned ? Icons.lock_open : Icons.block, color: isBanned ? AppColors.success : AppColors.error),
              onPressed: () => _setBanned(user, !isBanned),
            ),
          ],
        ),
      ),
    );
  }
}
