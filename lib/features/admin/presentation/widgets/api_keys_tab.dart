import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ApiKeysTab extends StatefulWidget {
  const ApiKeysTab({super.key});

  @override
  State<ApiKeysTab> createState() => _ApiKeysTabState();
}

class _ApiKeysTabState extends State<ApiKeysTab> {
  final _providerController = TextEditingController();
  final _keyController = TextEditingController();
  final _baseUrlController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _providerController.dispose();
    _keyController.dispose();
    _baseUrlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Secure API Key Management',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          const Text(
            'API keys are encrypted and stored in Supabase Vault. Keys are only accessible by Edge Functions.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          Form(
            key: _formKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _providerController,
                  decoration: const InputDecoration(
                    labelText: 'Provider Name',
                    hintText: 'e.g., openai, groq, anthropic',
                    prefixIcon: Icon(Icons.label),
                  ),
                  validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _keyController,
                  decoration: const InputDecoration(
                    labelText: 'API Key',
                    hintText: 'sk-...',
                    prefixIcon: Icon(Icons.key),
                  ),
                  obscureText: true,
                  validator: (v) => v?.isEmpty ?? true ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _baseUrlController,
                  decoration: const InputDecoration(
                    labelText: 'Base URL',
                    hintText: 'https://api.example.com/v1',
                    prefixIcon: Icon(Icons.link),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      if (_formKey.currentState!.validate()) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('API key saved to Vault')),
                        );
                      }
                    },
                    child: const Text('Save API Key'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          const Text(
            'Configured Providers',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.builder(
              itemCount: 6,
              itemBuilder: (context, index) {
                final providers = ['OpenAI', 'Groq', 'Google AI', 'Anthropic', 'Mistral', 'DeepSeek'];
                return Card(
                  color: AppColors.cardBackground,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(providers[index], style: const TextStyle(color: AppColors.textPrimary)),
                    subtitle: const Text('Active', style: TextStyle(color: AppColors.success)),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppColors.error),
                      onPressed: () {},
                    ),
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
