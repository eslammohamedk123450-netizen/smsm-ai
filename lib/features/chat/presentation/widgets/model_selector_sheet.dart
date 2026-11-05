import 'package:flutter/material.dart';
import '../../../features/chat/domain/entities/model_entity.dart';
import '../../../../core/theme/app_theme.dart';

class ModelSelectorSheet extends StatelessWidget {
  final String selectedModelId;
  final Function(String) onModelSelected;

  const ModelSelectorSheet({
    super.key,
    required this.selectedModelId,
    required this.onModelSelected,
  });

  @override
  Widget build(BuildContext context) {
    final models = [
      ModelEntity(
        id: 'model_openai_gpt4o',
        provider: 'openai',
        modelName: 'gpt-4o',
        displayName: 'GPT-4o',
        category: 'premium',
        status: 'active',
        costPer1kTokens: 5,
        creditMultiplier: 1.5,
        maxTokens: 128000,
        supportsStreaming: true,
        isRacingEnabled: false,
      ),
      ModelEntity(
        id: 'model_groq_llama3',
        provider: 'groq',
        modelName: 'llama-3.1-70b-versatile',
        displayName: 'Llama 3.1 70B',
        category: 'free',
        status: 'active',
        costPer1kTokens: 0,
        creditMultiplier: 1.0,
        maxTokens: 131072,
        supportsStreaming: true,
        isRacingEnabled: true,
      ),
      ModelEntity(
        id: 'model_anthropic_claude',
        provider: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        displayName: 'Claude 3.5 Sonnet',
        category: 'premium',
        status: 'active',
        costPer1kTokens: 8,
        creditMultiplier: 2.0,
        maxTokens: 200000,
        supportsStreaming: true,
        isRacingEnabled: false,
      ),
      ModelEntity(
        id: 'model_google_gemini',
        provider: 'google_ai',
        modelName: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        category: 'premium',
        status: 'active',
        costPer1kTokens: 3,
        creditMultiplier: 1.2,
        maxTokens: 1048576,
        supportsStreaming: true,
        isRacingEnabled: false,
      ),
      ModelEntity(
        id: 'model_deepseek_chat',
        provider: 'deepseek',
        modelName: 'deepseek-chat',
        displayName: 'DeepSeek Chat',
        category: 'free',
        status: 'active',
        costPer1kTokens: 0,
        creditMultiplier: 1.0,
        maxTokens: 32768,
        supportsStreaming: true,
        isRacingEnabled: true,
      ),
    ];

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.textMuted,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'Select AI Model',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  controller: controller,
                  itemCount: models.length,
                  itemBuilder: (context, index) {
                    final model = models[index];
                    final isSelected = model.id == selectedModelId;
                    return ListTile(
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.primary : AppColors.inputBackground,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSelected ? AppColors.primary : AppColors.divider),
                        ),
                        child: Center(
                          child: Text(
                            model.displayName.substring(0, 1),
                            style: TextStyle(
                              color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      title: Text(
                        model.displayName,
                        style: const TextStyle(color: AppColors.textPrimary),
                      ),
                      subtitle: Text(
                        '${model.provider.toUpperCase()} • ${model.maxTokens.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')} tokens',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: model.badgeColor.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: model.badgeColor.withOpacity(0.5)),
                        ),
                        child: Text(
                          model.badgeLabel,
                          style: TextStyle(
                            color: model.badgeColor,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      selected: isSelected,
                      selectedTileColor: AppColors.primary.withOpacity(0.1),
                      onTap: () => onModelSelected(model.id),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}