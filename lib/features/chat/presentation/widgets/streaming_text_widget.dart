import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;

import '../../../../core/network/sse_client.dart';
import '../../../../core/theme/app_theme.dart';

class StreamingTextWidget extends StatefulWidget {
  const StreamingTextWidget({super.key, required this.stream, this.style});
  final Stream<SseEvent> stream;
  final TextStyle? style;

  @override
  State<StreamingTextWidget> createState() => _StreamingTextWidgetState();
}

class _StreamingTextWidgetState extends State<StreamingTextWidget> {
  final StringBuffer _buffer = StringBuffer();
  final List<String> _toolPills = [];
  bool _done = false;
  StreamSubscription<SseEvent>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = widget.stream.listen(
      (event) {
        if (event is SseChunk) {
          _buffer.write(event.text);
          setState(() {});
        } else if (event is SseToolEvent) {
          final label = event.message ?? event.tool;
          if (event.status == 'done' || event.status == 'error') {
            _toolPills.remove(label);
          } else if (!_toolPills.contains(label)) {
            _toolPills.add(label);
          }
          setState(() {});
        } else if (event is SseDone) {
          _done = true;
          setState(() {});
        } else if (event is SseError) {
          _buffer.write('\n\n[Error: ${event.message}]');
          _done = true;
          setState(() {});
        }
      },
      onDone: () => setState(() => _done = true),
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_toolPills.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                children: _toolPills.map((t) => _ToolPill(label: t)).toList(),
              ),
            ),
          MarkdownBody(
            data: _buffer.toString(),
            selectable: true,
            builders: const {'code': CodeElementBuilder()},
            styleSheet: MarkdownStyleSheet(
              p: TextStyle(color: AppColors.textPrimary, height: 1.5),
              code: TextStyle(color: AppColors.accent, fontFamily: 'monospace'),
            ),
          ),
          if (!_done)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
        ],
      ),
    );
  }
}

class _ToolPill extends StatelessWidget {
  const _ToolPill({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}

class CodeElementBuilder extends MarkdownElementBuilder {
  const CodeElementBuilder();
  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    return _CodeBlock(code: element.textContent);
  }
}

class _CodeBlock extends StatelessWidget {
  const _CodeBlock({required this.code});
  final String code;
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(color: const Color(0xFF1E1E1E), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.topRight,
            child: IconButton(
              icon: const Icon(Icons.copy, color: Colors.white70, size: 18),
              tooltip: 'Copy',
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: code));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied to clipboard')));
                }
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: SelectableText(code, style: const TextStyle(fontFamily: 'monospace', color: Colors.white, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
