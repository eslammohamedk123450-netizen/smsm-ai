import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/services/credit_service.dart';
import '../../../../core/theme/app_colors.dart';

class CreditManagementTab extends StatefulWidget {
  const CreditManagementTab({super.key});

  @override
  State<CreditManagementTab> createState() => _CreditManagementTabState();
}

class _CreditManagementTabState extends State<CreditManagementTab> {
  final _client = Supabase.instance.client;
  final _creditService = CreditService();
  final _minimumController = TextEditingController();
  final _inputRateController = TextEditingController();
  final _outputRateController = TextEditingController();

  List<Map<String, dynamic>> _transactions = const [];
  bool _enabled = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _minimumController.dispose();
    _inputRateController.dispose();
    _outputRateController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await Future.wait<dynamic>([
        _creditService.getCreditPricingAsAdmin(),
        _client
            .from('suly_credit_transactions')
            .select('id,user_id,hold_id,event_type,amount,balance_delta,balance_after,actual_cost,input_tokens,output_tokens,model_id,source,reason,created_at')
            .order('created_at', ascending: false)
            .limit(100),
      ]);
      if (!mounted) return;
      final pricing = result[0] as Map<String, dynamic>;
      setState(() {
        _enabled = pricing['enabled'] == true;
        _minimumController.text = '${pricing['minimum_request_credits'] ?? 10}';
        _inputRateController.text = '${pricing['input_credits_per_1k_tokens'] ?? 0}';
        _outputRateController.text = '${pricing['output_credits_per_1k_tokens'] ?? 0}';
        _transactions = (result[1] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'تعذر تحميل إعدادات الرصيد: $error';
        _loading = false;
      });
    }
  }

  Future<void> _savePricing() async {
    final minimum = int.tryParse(_minimumController.text.trim());
    final input = int.tryParse(_inputRateController.text.trim());
    final output = int.tryParse(_outputRateController.text.trim());
    if (minimum == null || input == null || output == null ||
        [minimum, input, output].any((value) => value < 0 || value > 1000000000)) {
      setState(() => _error = 'أدخل أرقامًا صحيحة بين صفر ومليار لكل قيمة.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await _creditService.updateCreditPricingAsAdmin(
        enabled: _enabled,
        minimumRequestCredits: minimum,
        inputCreditsPer1kTokens: input,
        outputCreditsPer1kTokens: output,
      );
      if (result['success'] != true) throw StateError('لم تقبل قاعدة البيانات تحديث الأسعار.');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم حفظ الأسعار. سيُطبق الإعداد على الطلبات الجديدة.')),
      );
      await _load();
    } catch (error) {
      if (mounted) setState(() => _error = 'تعذر حفظ الأسعار: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _dateLabel(dynamic value) {
    final date = DateTime.tryParse('$value')?.toLocal();
    if (date == null) return '$value';
    final local = date.toString();
    return local.length > 16 ? local.substring(0, 16) : local;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final settlements = _transactions.where((row) => row['event_type'] == 'settle').toList();
    final billed = settlements.fold<int>(0, (sum, row) => sum + ((row['amount'] as num?)?.toInt() ?? 0));
    final consumedTokens = settlements.fold<int>(0, (sum, row) =>
        sum + ((row['input_tokens'] as num?)?.toInt() ?? 0) + ((row['output_tokens'] as num?)?.toInt() ?? 0));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) _errorBanner(_error!),
          if (!_enabled)
            Card(
              color: AppColors.primary.withOpacity(0.10),
              child: const Padding(
                padding: EdgeInsets.all(14),
                child: Text(
                  'الخصم معطّل حاليًا. اضبط الأسعار أولًا واختبرها؛ عند تفعيل المفتاح سيُطبّق الخصم على الطلبات الجديدة مباشرة.',
                  style: TextStyle(color: AppColors.textPrimary),
                ),
              ),
            ),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _statCard('عمليات التسوية في آخر 100 سجل', '${settlements.length}', Icons.receipt_long),
              _statCard('العملات المحصلة في آخر 100 سجل', '$billed', Icons.toll),
              _statCard('Tokens مسجلة في آخر 100 سجل', '$consumedTokens', Icons.data_usage),
              _statCard('عمليات حجز في آخر 100 سجل', '${_transactions.where((row) => row['event_type'] == 'reserve').length}', Icons.lock_clock),
            ],
          ),
          const SizedBox(height: 12),
          Card(
            color: AppColors.cardBackground,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('تسعير العملات', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 6),
                  const Text('معدل الإدخال والإخراج هو عدد العملات لكل 1,000 token. الحد الأدنى يُحسب لكل طلب. لا تعتمد على هذه القيم لتقدير ربحك بالدولار قبل إدخال أسعار المزود الفعلية.', style: TextStyle(color: AppColors.textSecondary)),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('تفعيل الخصم للطلبات الجديدة'),
                    value: _enabled,
                    onChanged: _saving ? null : (value) => setState(() => _enabled = value),
                  ),
                  _numberField(_minimumController, 'الحد الأدنى للعملات لكل طلب'),
                  _numberField(_inputRateController, 'عملات لكل 1,000 token إدخال'),
                  _numberField(_outputRateController, 'عملات لكل 1,000 token إخراج'),
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _savePricing,
                      icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save),
                      label: const Text('حفظ الإعدادات'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text('آخر معاملات الرصيد (حتى 100)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          if (_transactions.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('لا توجد معاملات حتى الآن.')))
          else
            ..._transactions.map(_transactionCard),
        ],
      ),
    );
  }

  Widget _numberField(TextEditingController controller, String label) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: label, suffixText: 'رصيد'),
        ),
      );

  Widget _statCard(String title, String value, IconData icon) => SizedBox(
        width: 220,
        child: Card(
          color: AppColors.cardBackground,
          child: ListTile(
            leading: Icon(icon, color: AppColors.primary),
            title: Text(value, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
            subtitle: Text(title, style: const TextStyle(color: AppColors.textSecondary)),
          ),
        ),
      );

  Widget _transactionCard(Map<String, dynamic> row) {
    final event = '${row['event_type'] ?? 'unknown'}';
    final amount = (row['amount'] as num?)?.toInt() ?? 0;
    final userId = '${row['user_id'] ?? ''}';
    final userLabel = userId.length > 12 ? '${userId.substring(0, 8)}…' : userId;
    final tokens = ((row['input_tokens'] as num?)?.toInt() ?? 0) +
        ((row['output_tokens'] as num?)?.toInt() ?? 0);
    return Card(
      color: AppColors.cardBackground,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(
          event == 'settle' ? Icons.check_circle_outline : event == 'reserve' ? Icons.lock_outline : Icons.account_balance_wallet_outlined,
          color: event == 'settle' ? AppColors.success : AppColors.primary,
        ),
        title: Text('$event · $amount عملة', style: const TextStyle(color: AppColors.textPrimary)),
        subtitle: Text([
          'المستخدم: $userLabel',
          'الرصيد بعد العملية: ${row['balance_after'] ?? '—'} · tokens: $tokens',
          if (row['model_id'] != null) 'Model ID: ${row['model_id']}',
          if (row['reason'] != null) '${row['reason']}',
          _dateLabel(row['created_at']),
        ].join('\n'), style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        isThreeLine: true,
      ),
    );
  }

  Widget _errorBanner(String message) => Card(
        color: AppColors.error.withOpacity(0.12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Text(message, style: const TextStyle(color: AppColors.error)),
        ),
      );
}
