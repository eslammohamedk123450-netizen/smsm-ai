import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../../../../core/theme/app_theme.dart';

class StreamingTextWidget extends StatelessWidget {
  const StreamingTextWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: const MarkdownBody(
        styleSheet: MarkdownStyleSheet(
          p: TextStyle(color: AppColors.textPrimary, height: 1.5),
          h1: TextStyle(color: AppColors.primary, fontSize: 22, fontWeight: FontWeight.bold),
          h2: TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.bold),
          h3: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
          code: TextStyle(color: AppColors.accent, fontFamily: 'monospace'),
          codeblockDecoration: BoxDecoration(color: AppColors.inputBackground),
        ),
      ),
    );
  }
}
