import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class MessageBubble extends StatelessWidget {
  final String role;
  final String content;
  final bool isStreaming;
  final String streamedContent;

  const MessageBubble({
    super.key,
    required this.role,
    required this.content,
    this.isStreaming = false,
    this.streamedContent = '',
  });

  @override
  Widget build(BuildContext context) {
    final isUser = role == 'user';
    final displayContent = isStreaming ? streamedContent : content;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isUser ? AppColors.primary : AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isUser)
                Text(
                  'Assistant',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.accent.withOpacity(0.7),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                displayContent,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  height: 1.4,
                ),
              ),
              if (isStreaming) ...[
                const SizedBox(height: 4),
                const Text(
                  '⬤',
                  style: TextStyle(color: AppColors.accent, fontSize: 16),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
