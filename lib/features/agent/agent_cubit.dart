import 'package:flutter_bloc/flutter_bloc.dart';
import 'agent_state.dart';
import 'agent_task.dart';
import 'agent_runtime.dart';

class AgentCubit extends Cubit<AgentState> {
  final AgentRuntime _runtime;

  AgentCubit(this._runtime) : super(const AgentIdle());

  Future<void> runTask(AgentTask task) async {
    emit(const AgentPlanning());
    try {
      emit(const AgentExecuting());
      // We need to notify when reflecting.
      // Simplest way: Add a callback to runtime or just emit reflecting state before execution steps.
      await _runtime.executeTask(task);
      emit(const AgentVerifying());
      emit(const AgentCompleted());
    } catch (e) {
      emit(AgentFailed(e.toString()));
    }
  }
}
