import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../cubit/chat_cubit.dart';
import '../cubit/chat_state.dart';
import '../widgets/message_bubble.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    final chatCubit = context.read<ChatCubit>();
    if (chatCubit.state.isStreaming || chatCubit.state is ChatLoading) return;
    _messageController.clear();
    await chatCubit.sendMessage(text);
    if (mounted) _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ChatCubit, ChatState>(
      listener: (context, state) {
        if (state is ChatLoaded || state is ChatStreaming || state is ChatError) {
          _scrollToBottom();
        }
      },
      child: BlocBuilder<ChatCubit, ChatState>(
        builder: (context, state) {
          final messages = state.messages;
          final isBusy = state.isStreaming || state is ChatLoading;
          return Scaffold(
            backgroundColor: AppColors.background,
            appBar: AppBar(
              title: const Text('SMSM AI · دردشة نصية'),
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh),
                  tooltip: 'إعادة تحميل النماذج',
                  onPressed: isBusy ? null : () => context.read<ChatCubit>().initialize(),
                ),
                IconButton(
                  icon: const Icon(Icons.logout),
                  tooltip: 'تسجيل الخروج',
                  onPressed: () => context.read<AuthCubit>().logout(),
                ),
              ],
            ),
            body: Column(
              children: [
                if (state.isStreaming) const LinearProgressIndicator(),
                Expanded(
                  child: state is ChatLoading
                      ? const Center(child: CircularProgressIndicator())
                      : Column(
                          children: [
                            if (state is ChatError)
                              Container(
                                width: double.infinity,
                                margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.error.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  state.message,
                                  style: const TextStyle(color: AppColors.error),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            Expanded(
                              child: messages.isEmpty
                                  ? const Center(
                                      child: Padding(
                                        padding: EdgeInsets.all(24),
                                        child: Text(
                                          'هذه نسخة تجريبية مغلقة للدردشة النصية. أرسل رسالة لبدء المحادثة.',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(color: AppColors.textSecondary),
                                        ),
                                      ),
                                    )
                                  : ListView.builder(
                                      controller: _scrollController,
                                      padding: const EdgeInsets.all(16),
                                      itemCount: messages.length,
                                      itemBuilder: (context, index) {
                                        final message = messages[index];
                                        return MessageBubble(
                                          role: message.role,
                                          content: message.content,
                                          isStreaming: message.isStreaming && index == messages.length - 1,
                                          streamedContent: message.streamedContent,
                                        );
                                      },
                                    ),
                            ),
                          ],
                        ),
                ),
                if (state.isStreaming)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 8),
                        Text('جاري توليد الرد', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ],
                    ),
                  ),
              ],
            ),
            bottomNavigationBar: SafeArea(
              child: Container(
                color: AppColors.surface,
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        enabled: !isBusy,
                        minLines: 1,
                        maxLines: 5,
                        decoration: InputDecoration(
                          hintText: 'اكتب رسالة…',
                          hintStyle: const TextStyle(color: AppColors.textMuted),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          filled: true,
                          fillColor: AppColors.inputBackground,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.send, color: AppColors.primary),
                            onPressed: isBusy ? null : _sendMessage,
                          ),
                        ),
                        onSubmitted: isBusy ? null : (_) => _sendMessage(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
