abstract class AgentState {
  const AgentState();
}

class AgentIdle extends AgentState {
  const AgentIdle();
}

class AgentPlanning extends AgentState {
  const AgentPlanning();
}

class AgentAwaitingApproval extends AgentState {
  const AgentAwaitingApproval();
}

class AgentExecuting extends AgentState {
  const AgentExecuting();
}

class AgentVerifying extends AgentState {
  const AgentVerifying();
}

class AgentCompleted extends AgentState {
  const AgentCompleted();
}

class AgentFailed extends AgentState {
  final String error;
  const AgentFailed(this.error);
}
