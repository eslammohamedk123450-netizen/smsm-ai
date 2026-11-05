import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class ModelManagementTab extends StatefulWidget {
  const ModelManagementTab({super.key});

  @override
  State<ModelManagementTab> createState() => _ModelManagementTabState();
}

class _ModelManagementTabState extends State<ModelManagementTab> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Model Fleet Management',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          const Text(
            'Toggle model state, set pricing category, and configure cost per 1k tokens.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              itemCount: 8,
              itemBuilder: (context, index) {
                final models = [
                  {'name': 'GPT-4o', 'provider': 'OpenAI', 'cat': 'Premium', 'cost': '5'},
                  {'name': 'Llama 3.1 70B', 'provider': 'Groq', 'cat': 'Free', 'cost': '0'},
                  {'name': 'Claude 3.5 Sonnet', 'provider': 'Anthropic', 'cat': 'Premium', 'cost': '8'},
                  {'name': 'Gemini 1.5 Pro', 'provider': 'Google AI', 'cat': 'Premium', 'cost': '3'},
                  {'name': 'DeepSeek Chat', 'provider': 'DeepSeek', 'cat': 'Free', 'cost': '0'},
                  {'name': 'Mistral Large', 'provider': 'Mistral AI', 'cat': 'Premium', 'cost': '4'},
                  {'name': 'Grok Beta', 'provider': 'xAI', 'cat': 'Premium', 'cost': '6'},
                  {'name': 'Command R+', 'provider': 'Cohere', 'cat': 'Premium', 'cost': '4'},
                ];
                final m = models[index];
                final isFree = m['cat'] == 'Free';
                return Card(
                  color: AppColors.cardBackground,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(m['name] as String, style: const TextStyle(color: AppColors.textPrimary)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${m['provider']} • ${m['cost']} credits/1k tokens', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ],
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isFree ? AppColors.freeBadge.withOpacity(0.2) : AppColors.premiumBadge.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: isFree ? AppColors.freeBadge : AppColors.premiumBadge),
                          ),
                          child: Text(
                            m['cat] as String,
                            style: TextStyle(color: isFree ? AppColors.freeBadge : AppColors.premiumBadge, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Switch(
                          value: true,
                          onChanged: (val) {},
                          activeColor: AppColors.primary,
                        ),
                      ],
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
