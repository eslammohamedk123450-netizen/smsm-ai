import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class CircuitBreakerTab extends StatefulWidget {
  const CircuitBreakerTab({super.key});

  @override
  State<CircuitBreakerTab> createState() => _CircuitBreakerTabState();
}

class _CircuitBreakerTabState extends State<CircuitBreakerTab> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Circuit Breaker Alerts',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          const Text(
            'Models auto-suspended after 3 failures in 15 minutes. Review and take action.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          Expanded(
            child: ListView.builder(
              itemCount: 3,
              itemBuilder: (context, index) {
                final alerts = [
                  {'model': 'Groq Llama-3.1-70b', 'provider': 'Groq', 'reason': 'SUSPENDED_AUTO: Timeout > 8s', 'failures': 4},
                  {'model': 'OpenAI GPT-4o', 'provider': 'OpenAI', 'reason': 'SUSPENDED_AUTO: HTTP 502 Bad Gateway', 'failures': 3},
                  {'model': 'Anthropic Claude', 'provider': 'Anthropic', 'reason': 'SUSPENDED_AUTO: Rate limit exceeded', 'failures': 3},
                ];
                final a = alerts[index];
                return Card(
                  color: AppColors.cardBackground,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    title: Text(a['model'] as String, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${a['provider']} • ${a['failures']} failures', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(a['reason'] as String, style: const TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.w500)),
                      ],
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        ElevatedButton(
                          onPressed: () {},
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          child: const Text('Reactivate', style: TextStyle(fontSize: 10)),
                        ),
                        const SizedBox(height: 6),
                        TextButton(
                          onPressed: () {},
                          child: const Text('Delete', style: TextStyle(color: AppColors.error, fontSize: 10)),
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
