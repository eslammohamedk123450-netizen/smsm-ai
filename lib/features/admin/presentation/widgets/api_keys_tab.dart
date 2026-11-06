import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/theme/app_theme.dart';

class ApiKeysTab extends StatefulWidget {
  const ApiKeysTab({super.key});

  @override
  State<ApiKeysTab> createState() => _ApiKeysTabState();
}

class _ApiKeysTabState extends State<ApiKeysTab> {
  final _nameController = TextEditingController();
  final _keyController = TextEditingController();
  final _baseUrlController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _client = Supabase.instance.client;
  String _providerType = 'groq';
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<Map<String, dynamic>> _providers = [];

  static const Map<String, String> _defaultUrls = {
    'groq': 'https://api.groq.com/openai/v1',
    'openai': 'https://api.openai.com/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'deepseek': 'https://api.deepseek.com/v1',
    'together': 'https://api.together.xyz/v1',
    'mistral': 'https://api.mistral.ai/v1',
    'perplexity': 'https://api.perplexity.ai',
    'xai': 'https://api.x.ai/v1',
    'custom': '',
  };

  @override
  void initState() {
    super.initState();
    _baseUrlController.text = _defaultUrls[_providerType]!;
    _loadProviders();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _keyController.dispose();
    _baseUrlController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadProviders() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await _client
          .from('ai_providers')
          .select('id,name,provider_type,base_url,enabled,last_test_status')
          .order('priority');
      if (!mounted) return;
      setState(() {
        _providers = (response as List).cast<Map<String, dynamic>>();
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

  Future<void> _saveProvider() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await _client.functions.invoke(
        'sync-models',
        body: {
          'action': 'create_provider',
          'provider': {
            'name': _nameController.text.trim(),
            'provider_type': _providerType,
            'base_url': _baseUrlController.text.trim(),
            'description': _descriptionController.text.trim(),
            'api_key': _keyController.text,
          },
        },
      );
      final data = result.data;
      if (result.status < 200 || result.status >= 300 || data is! Map || data['success'] != true) {
        throw Exception(data is Map ? (data['error'] ?? data['warning'] ?? 'Provider sync failed') : 'Provider sync failed');
      }
      final discovered = data['discovered'] ?? 0;
      final created = data['created'] ?? 0;
      _keyController.clear();
      _nameController.clear();
      _descriptionController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Provider saved securely. $created new models added ($discovered discovered).')),
        );
      }
      await _loadProviders();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _onProviderTypeChanged(String? value) {
    if (value == null) return;
    final oldDefault = _defaultUrls[_providerType] ?? '';
    setState(() {
      _providerType = value;
      if (_baseUrlController.text.trim().isEmpty || _baseUrlController.text.trim() == oldDefault) {
        _baseUrlController.text = _defaultUrls[value] ?? '';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('API Providers', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          const Text(
            'The provider key is sent only to the protected Edge Function and stored in Supabase Vault. Chat-compatible models are discovered and added automatically.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),
          Form(
            key: _formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Provider name', hintText: 'e.g. Groq Production'),
                  validator: (value) => (value == null || value.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _providerType,
                  decoration: const InputDecoration(labelText: 'API type (OpenAI-compatible)'),
                  items: _defaultUrls.keys.map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                  onChanged: _onProviderTypeChanged,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _baseUrlController,
                  decoration: const InputDecoration(labelText: 'Models/API base URL', hintText: 'https://api.example.com/v1'),
                  validator: (value) {
                    final uri = Uri.tryParse((value ?? '').trim());
                    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) return 'Enter a valid HTTPS URL';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _keyController,
                  obscureText: true,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: const InputDecoration(labelText: 'API key', hintText: 'Stored encrypted in Vault'),
                  validator: (value) => (value == null || value.isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descriptionController,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _saveProvider,
                    icon: _saving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.sync),
                    label: Text(_saving ? 'Saving and discovering models…' : 'Save provider and sync models'),
                  ),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.error)),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              const Expanded(child: Text('Configured providers', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary))),
              IconButton(onPressed: _loading ? null : _loadProviders, icon: const Icon(Icons.refresh)),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _providers.isEmpty
                    ? const Center(child: Text('No providers configured', style: TextStyle(color: AppColors.textSecondary)))
                    : ListView.builder(
                        itemCount: _providers.length,
                        itemBuilder: (context, index) {
                          final provider = _providers[index];
                          return Card(
                            color: AppColors.cardBackground,
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              leading: const Icon(Icons.cloud_done, color: AppColors.primary),
                              title: Text('${provider['name']}', style: const TextStyle(color: AppColors.textPrimary)),
                              subtitle: Text(
                                '${provider['provider_type']} • ${provider['enabled'] == true ? 'Active' : 'Disabled'} • ${provider['last_test_status'] ?? 'Not tested'}',
                                style: const TextStyle(color: AppColors.textSecondary),
                              ),
                              trailing: const Icon(Icons.lock, color: AppColors.success),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
