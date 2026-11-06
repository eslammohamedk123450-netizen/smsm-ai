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
      await _runtime.executeTask(task);
      emit(const AgentVerifying());
      emit(const AgentCompleted());
    } catch (e) {
      emit(AgentFailed(e.toString()));
    }
  }
}
