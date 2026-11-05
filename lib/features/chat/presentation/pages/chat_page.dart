import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../cubit/chat_cubit.dart';
import '../cubit/chat_state.dart';
import '../widgets/message_bubble.dart';
import '../widgets/streaming_text_widget.dart';
import '../widgets/model_selector_sheet.dart';
import '../../../../core/theme/app_theme.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  String _selectedModelId = '';

  @override
  void initState() {
    super.initState();
    context.read<ChatCubit>().initialize();
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _selectedModelId.isEmpty) return;
    _messageController.clear();
    context.read<ChatCubit>().sendMessage(text, _selectedModelId);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ChatCubit, ChatState>(
      builder: (context, state) {
        final messages = (state is ChatLoaded) ? state.messages : <dynamic>[];
        final isStreaming = (state is ChatLoaded) ? state.isStreaming : false;
        final selectedModel = (state is ChatLoaded) ? state.selectedModelId : _selectedModelId;

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: const Text('AI Chat'),
            actions: [
              IconButton(
                icon: const Icon(Icons.model_sharing),
                onPressed: _showModelSelector,
                tooltip: 'Select Model',
              ),
              if (selectedModel.isNotEmpty) ...[
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary),
                  ),
                  child: Text(
                    selectedModel,
                    style: const TextStyle(fontSize: 12, color: AppColors.primary),
                  ),
                ),
              ],
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () => context.read<ChatCubit>().initialize(),
              ),
            ],
          ),
          body: Column(
            children: [
              Expanded(
                child: messages.isEmpty
                    ? const Center(
                        child: Text(
                          'Start a conversation',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: messages.length,
                        itemBuilder: (context, index) {
                          final msg = messages[index];
                          final isLast = index == messages.length - 1;
                          return MessageBubble(
                            role: msg.role,
                            content: msg.content,
                            isStreaming: msg.isStreaming && isLast,
                            streamedContent: msg.streamedContent,
                          );
                        },
                      ),
              ),
              if (isStreaming) const StreamingTextWidget(),
              const SizedBox(height: 8),
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
                      enabled: !isStreaming,
                      decoration: InputDecoration(
                        hintText: 'Type a message...',
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
                          onPressed: isStreaming ? null : _sendMessage,
                        ),
                      ),
                      onSubmitted: isStreaming ? null : (_) => _sendMessage(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

  void _showModelSelector() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      builder: (context) => ModelSelectorSheet(
        selectedModelId: _selectedModelId,
        onModelSelected: (id) {
          setState(() => _selectedModelId = id);
          context.read<ChatCubit>().selectModel(id);
          Navigator.pop(context);
        },
      ),
    );
  }