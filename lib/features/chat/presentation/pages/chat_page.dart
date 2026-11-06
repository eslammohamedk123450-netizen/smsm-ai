import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/chat_cubit.dart';
import '../cubit/chat_state.dart';
import '../widgets/message_bubble.dart';
import '../../../../core/theme/app_theme.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<ChatCubit>().initialize();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    _messageController.clear();
    context.read<AgentCubit>().runTask(AgentTask(id: 'task_${DateTime.now().millisecondsSinceEpoch}', goal: text));
    await context.read<ChatCubit>().sendMessage(text);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<ChatCubit, ChatState>(
      listener: (context, state) {
        if (state is ChatLoaded || state is ChatStreaming) {
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
      },
      child: BlocBuilder<ChatCubit, ChatState>(
        builder: (context, state) {
          final messages = state.messages;
        final isStreaming = state is ChatStreaming;
        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: const Text('AI Chat'),
            actions: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.primary.withOpacity(0.7)),
                ),
                child: const Center(
                  child: Text('AUTO · FASTEST', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.bold)),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.refresh),
                tooltip: 'Reload models',
                onPressed: () => context.read<ChatCubit>().initialize(),
              ),
            ],
          ),
          body: Column(
            children: [
              BlocBuilder<AgentCubit, AgentState>(
                builder: (context, agentState) {
                  if (agentState is AgentPlanning) return const AgentStatusCard(status: 'Planning...');
                  if (agentState is AgentExecuting) return const AgentStatusCard(status: 'Executing...');
                  return const SizedBox.shrink();
                },
              ),
              BlocBuilder<AgentCubit, AgentState>(
                builder: (context, agentState) {
                  if (agentState is AgentExecuting) return const StepTimeline(steps: ['Processing task', 'Executing tools']);
                  return const SizedBox.shrink();
                },
              ),
              if (isStreaming) const LinearProgressIndicator(),
              Expanded(
                child: state is ChatLoading
                    ? const Center(child: CircularProgressIndicator())
                    : state is ChatError
                        ? Center(child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(state.message, style: const TextStyle(color: AppColors.error), textAlign: TextAlign.center),
                          ))
                        : messages.isEmpty
                            ? const Center(
                                child: Text(
                                  'Your message will race enabled free models. If none responds before the admin-set deadline, the router can use a paid fallback model.',
                                  textAlign: TextAlign.center,
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
              const SizedBox(height: 8),
               if (isStreaming) const Padding(
                 padding: EdgeInsets.only(bottom: 8),
                 child: Row(
                   mainAxisAlignment: MainAxisAlignment.center,
                   children: [
                     CircularProgressIndicator(strokeWidth: 2),
                     SizedBox(width: 8),
                     Text('جاري التوليد', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
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
                      enabled: !isStreaming,
                      minLines: 1,
                      maxLines: 5,
                      decoration: InputDecoration(
                        hintText: 'Type a message…',
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
