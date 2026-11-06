import 'agent_task.dart';

/// The agent runtime is intentionally unavailable in the closed text beta.
/// Its old implementation could run mock tools and referenced an undefined
/// approval flag, so fail closed until a real, bounded runtime is implemented.
class AgentRuntime {
  Future<void> executeTask(AgentTask task) async {
    throw UnsupportedError('Agent features are not available in the closed text beta.');
  }
}
