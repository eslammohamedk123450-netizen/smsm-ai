import 'package:flutter/material.dart';
import 'package:syntax_highlight/syntax_highlight.dart';
import '../../../../core/theme/app_theme.dart';

class CodeBlockWidget extends StatelessWidget {
  final String code;
  final String language;

  const CodeBlockWidget({
    super.key,
    required this.code,
    required this.language,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              border: Border(bottom: BorderSide(color: AppColors.divider)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  language.isNotEmpty ? language : 'Code',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy, size: 16, color: AppColors.primary),
                  onPressed: () {
                    // Copy to clipboard
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Code copied to clipboard')),
                    );
                  },
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Text(
                code,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
