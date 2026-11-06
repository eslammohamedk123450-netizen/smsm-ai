import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme/app_theme.dart';

class ModelManagementTab extends StatefulWidget {
  const ModelManagementTab({super.key});

  @override
  State<ModelManagementTab> createState() => _ModelManagementTabState();
}

class _ModelManagementTabState extends State<ModelManagementTab> {
  final _client = Supabase.instance.client;
  final _freeTimeoutController = TextEditingController(text: '5000');
  final _fallbackTimeoutController = TextEditingController(text: '30000');
  final _maxParallelController = TextEditingController(text: '10');
  List<Map<String, dynamic>> _models = [];
  Map<int, Map<String, dynamic>> _health = {};
  bool _loading = true;
  bool _savingSettings = false;
  bool _paidFallbackEnabled = true;
  bool _healthAutoRestrictEnabled = true;
  String? _error;

  static const _tiers = ['free', 'lite', 'pro', 'max'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _freeTimeoutController.dispose();
    _fallbackTimeoutController.dispose();
    _maxParallelController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait<dynamic>([
        _client
            .from('ai_models')
            .select('id,name,provider_id,model_identifier,enabled,priority,context_window,routing_group,allowed_tiers,capabilities_json,response_timeout_ms,restriction_failure_threshold,restriction_window_minutes')
            .order('priority', ascending: false)
            .order('name'),
        _client
            .from('ai_router_settings')
            .select('free_race_timeout_ms,paid_fallback_enabled,paid_fallback_timeout_ms,max_parallel_free_models,health_auto_restrict_enabled')
            .eq('id', 1)
            .single(),
        _client
            .from('ai_model_health')
            .select('model_id,total_attempts,successful_attempts,failed_attempts,consecutive_failures,last_attempt_at,last_success_at,last_failure_at,last_status,last_error_code,last_error_reason,average_latency_ms,auto_restricted,restriction_reason,restricted_at')
            .limit(1000),
      ]);
      if (!mounted) return;
      final settings = results[1] as Map<String, dynamic>;
      final healthRows = (results[2] as List).cast<Map<String, dynamic>>();
      setState(() {
        _models = (results[0] as List).cast<Map<String, dynamic>>();
        _health = {for (final row in healthRows) row['model_id'] as int: row};
        _freeTimeoutController.text = '${settings['free_race_timeout_ms'] ?? 5000}';
        _fallbackTimeoutController.text = '${settings['paid_fallback_timeout_ms'] ?? 30000}';
        _maxParallelController.text = '${settings['max_parallel_free_models'] ?? 10}';
        _paidFallbackEnabled = settings['paid_fallback_enabled'] == true;
        _healthAutoRestrictEnabled = settings['health_auto_restrict_enabled'] != false;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _updateModel(int id, Map<String, dynamic> changes) async {
    try {
      await _client.from('ai_models').update(changes).eq('id', id);
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not update model: $e')));
    }
  }

  Future<void> _toggleTier(Map<String, dynamic> model, String tier) async {
    final tiers = List<String>.from((model['allowed_tiers'] as List?)?.whereType<String>() ?? const []);
    if (tiers.contains(tier)) {
      tiers.remove(tier);
    } else {
      tiers.add(tier);
    }
    await _updateModel(model['id'] as int, {'allowed_tiers': tiers});
  }

  Future<void> _saveSettings() async {
    final freeTimeout = int.tryParse(_freeTimeoutController.text.trim());
    final fallbackTimeout = int.tryParse(_fallbackTimeoutController.text.trim());
    final maxParallel = int.tryParse(_maxParallelController.text.trim());
    if (freeTimeout == null || freeTimeout < 1000 || freeTimeout > 30000 ||
        fallbackTimeout == null || fallbackTimeout < 1000 || fallbackTimeout > 120000 ||
        maxParallel == null || maxParallel < 1 || maxParallel > 50) {
      setState(() => _error = 'Free timeout: 1000–30000 ms; fallback: 1000–120000 ms; parallel models: 1–50.');
      return;
    }
    setState(() {
      _savingSettings = true;
      _error = null;
    });
    try {
      await _client.from('ai_router_settings').update({
        'free_race_timeout_ms': freeTimeout,
        'paid_fallback_timeout_ms': fallbackTimeout,
        'paid_fallback_enabled': _paidFallbackEnabled,
        'max_parallel_free_models': maxParallel,
        'health_auto_restrict_enabled': _healthAutoRestrictEnabled,
        'updated_by': _client.auth.currentUser?.id,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', 1);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Routing and health settings saved')));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _savingSettings = false);
    }
  }

  Future<void> _editPerModelLimits(Map<String, dynamic> model) async {
    final timeoutController = TextEditingController(text: '${model['response_timeout_ms'] ?? 15000}');
    final failuresController = TextEditingController(text: '${model['restriction_failure_threshold'] ?? 3}');
    final windowController = TextEditingController(text: '${model['restriction_window_minutes'] ?? 15}');
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Health limits · ${model['name']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _numberField(timeoutController, 'Model response timeout', 'ms'),
            _numberField(failuresController, 'Consecutive failures before restriction', 'tries'),
            _numberField(windowController, 'Failure window', 'minutes'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Save')),
        ],
      ),
    );
    if (saved == true) {
      final timeout = int.tryParse(timeoutController.text);
      final failures = int.tryParse(failuresController.text);
      final window = int.tryParse(windowController.text);
      if (timeout == null || timeout < 1000 || timeout > 120000 || failures == null || failures < 1 || failures > 20 || window == null || window < 1 || window > 1440) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Use timeout 1000–120000 ms, failures 1–20, and window 1–1440 minutes.')));
      } else {
        await _updateModel(model['id'] as int, {
          'response_timeout_ms': timeout,
          'restriction_failure_threshold': failures,
          'restriction_window_minutes': window,
        });
      }
    }
    timeoutController.dispose();
    failuresController.dispose();
    windowController.dispose();
  }

  Future<void> _reviewAndReenable(Map<String, dynamic> model) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Re-enable model?'),
        content: Text('This clears its consecutive-failure counter and puts it back into routing. Review the failure history first if needed.\n\n${_health[model['id']]?['restriction_reason'] ?? ''}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Re-enable')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _client.rpc('suly_admin_reset_model_health', params: {'p_model_id': model['id']});
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not re-enable model: $e')));
    }
  }

  Future<void> _removeFromRouting(Map<String, dynamic> model) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove model from routing?'),
        content: const Text('This preserves its health history but disables it for users. You can change it back later.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Disable model')),
        ],
      ),
    );
    if (confirmed == true) await _updateModel(model['id'] as int, {'enabled': false, 'routing_group': 'disabled'});
  }

  Future<void> _deleteModel(Map<String, dynamic> model) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete model permanently?'),
        content: const Text('This removes the model configuration and its aggregate health row. Attempt history is retained with the model name snapshot.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Delete permanently', style: TextStyle(color: AppColors.error))),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _client.from('ai_models').delete().eq('id', model['id']);
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not delete model: $e')));
    }
  }

  Future<void> _showAttemptHistory(Map<String, dynamic> model) async {
    try {
      final rows = await _client
          .from('ai_model_attempt_logs')
          .select('attempt_status,duration_ms,error_code,error_reason,created_at')
          .eq('model_id', model['id'])
          .order('created_at', ascending: false)
          .limit(30);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('Recent attempts · ${model['name']}'),
          content: SizedBox(
            width: 520,
            child: (rows as List).isEmpty
                ? const Text('No attempts logged yet.')
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: (rows as List).length,
                    itemBuilder: (context, index) {
                      final row = rows[index] as Map<String, dynamic>;
                      return ListTile(
                        dense: true,
                        title: Text('${row['attempt_status']} · ${row['duration_ms']} ms'),
                        subtitle: Text([
                          if (row['error_code'] != null) '${row['error_code']}',
                          if (row['error_reason'] != null) '${row['error_reason']}',
                          '${row['created_at']}',
                        ].join('\n')),
                      );
                    },
                  ),
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Close'))],
        ),
      );
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not load attempt history: $e')));
    }
  }

  Widget _numberField(TextEditingController controller, String label, String suffix) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: label, suffixText: suffix),
      ),
    );
  }

  Widget _modelCard(Map<String, dynamic> model) {
    final id = model['id'] as int;
    final health = _health[id] ?? const <String, dynamic>{};
    final succeeded = (health['successful_attempts'] as int?) ?? 0;
    final failed = (health['failed_attempts'] as int?) ?? 0;
    final counted = succeeded + failed;
    final successPercent = counted == 0 ? null : succeeded * 100 / counted;
    final stars = successPercent == null ? 0 : (successPercent / 20).round().clamp(0, 5).toInt();
    final restricted = health['auto_restricted'] == true;
    final route = model['routing_group'] as String? ?? 'free_race';
    final allowed = List<String>.from((model['allowed_tiers'] as List?)?.whereType<String>() ?? const []);

    return Card(
      color: AppColors.cardBackground,
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${model['name']}', style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                    Text('${model['model_identifier']}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  ]),
                ),
                Switch(value: model['enabled'] == true, onChanged: (value) => _updateModel(id, {'enabled': value})),
              ],
            ),
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 4,
              children: [
                Chip(
                  label: Text(restricted ? 'AUTO-RESTRICTED' : (model['enabled'] == true ? 'ACTIVE' : 'DISABLED')),
                  backgroundColor: restricted ? AppColors.error.withOpacity(0.18) : AppColors.primary.withOpacity(0.12),
                  labelStyle: TextStyle(color: restricted ? AppColors.error : AppColors.primary),
                ),
                DropdownButton<String>(
                  value: route,
                  dropdownColor: AppColors.surface,
                  items: const [
                    DropdownMenuItem(value: 'free_race', child: Text('Free race')),
                    DropdownMenuItem(value: 'paid_fallback', child: Text('Paid fallback')),
                    DropdownMenuItem(value: 'disabled', child: Text('Disabled')),
                  ],
                  onChanged: (value) { if (value != null) _updateModel(id, {'routing_group': value}); },
                ),
                Text('Priority ${model['priority'] ?? 100}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
            Row(
              children: [
                Text(successPercent == null ? 'Not enough data' : '${successPercent.toStringAsFixed(0)}% success', style: const TextStyle(color: AppColors.textPrimary)),
                const SizedBox(width: 8),
                Text(successPercent == null ? '☆☆☆☆☆' : '${List.filled(stars, '★').join()}${List.filled(5 - stars, '☆').join()}', style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 16)),
                const Spacer(),
                Text('${(health['average_latency_ms'] as num?)?.round() ?? 0} ms avg', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              ],
            ),
            Text('Success $succeeded · Failed $failed · Consecutive failures ${health['consecutive_failures'] ?? 0}', style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            if (restricted || health['last_error_reason'] != null) ...[
              const SizedBox(height: 6),
              Text(
                (health['restriction_reason'] ?? health['last_error_reason']).toString(),
                style: TextStyle(color: restricted ? AppColors.error : AppColors.textSecondary, fontSize: 12),
              ),
            ],
            const SizedBox(height: 6),
            const Text('Available to plans', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            Wrap(
              spacing: 6,
              children: _tiers.map((tier) => FilterChip(
                label: Text(tier.toUpperCase()),
                selected: allowed.contains(tier),
                onSelected: (_) => _toggleTier(model, tier),
                selectedColor: AppColors.primary.withOpacity(0.35),
              )).toList(),
            ),
            Wrap(
              spacing: 4,
              children: [
                TextButton.icon(onPressed: () => _editPerModelLimits(model), icon: const Icon(Icons.tune), label: const Text('Health limits')),
                TextButton.icon(onPressed: () => _showAttemptHistory(model), icon: const Icon(Icons.history), label: const Text('Attempt history')),
                if (restricted)
                  TextButton.icon(onPressed: () => _reviewAndReenable(model), icon: const Icon(Icons.restart_alt), label: const Text('Review & re-enable')),
                TextButton.icon(onPressed: () => _removeFromRouting(model), icon: const Icon(Icons.block), label: const Text('Disable')),
                TextButton.icon(onPressed: () => _deleteModel(model), icon: const Icon(Icons.delete_outline, color: AppColors.error), label: const Text('Delete')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Model routing and health', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                const SizedBox(height: 8),
                const Text('The first free model that produces text wins. If none answers before the deadline, paid fallback runs. Per-model circuit breakers quarantine repeatedly failing models until you review them.', style: TextStyle(color: AppColors.textSecondary)),
                const SizedBox(height: 16),
                Card(
                  color: AppColors.cardBackground,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Global router controls', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        _numberField(_freeTimeoutController, 'Free-model first-token deadline', 'ms'),
                        _numberField(_fallbackTimeoutController, 'Paid fallback deadline', 'ms'),
                        _numberField(_maxParallelController, 'Max free models in one race', 'models'),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Enable paid fallback', style: TextStyle(color: AppColors.textPrimary)),
                          value: _paidFallbackEnabled,
                          onChanged: (value) => setState(() => _paidFallbackEnabled = value),
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Automatically restrict models after their failure limit', style: TextStyle(color: AppColors.textPrimary)),
                          value: _healthAutoRestrictEnabled,
                          onChanged: (value) => setState(() => _healthAutoRestrictEnabled = value),
                        ),
                        Align(
                          alignment: Alignment.centerRight,
                          child: ElevatedButton(onPressed: _savingSettings ? null : _saveSettings, child: Text(_savingSettings ? 'Saving…' : 'Save settings')),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: const TextStyle(color: AppColors.error)),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Expanded(child: Text('Discovered models', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary))),
                    IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: _models.isEmpty
                      ? const Center(child: Text('No models discovered yet. Add a provider first.', style: TextStyle(color: AppColors.textSecondary)))
                      : ListView.builder(itemCount: _models.length, itemBuilder: (context, index) => _modelCard(_models[index])),
                ),
              ],
            ),
    );
  }
}
