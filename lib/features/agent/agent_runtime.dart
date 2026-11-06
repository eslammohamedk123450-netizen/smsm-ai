import 'agent_task.dart';
import 'agent_plan.dart';
import 'tool_executor.dart';

class AgentRuntime {
  final ToolExecutor _toolExecutor;

  AgentRuntime(this._toolExecutor);

  Future<void> executeTask(AgentTask task) async {
    bool isCompleted = false;
    bool needsPlanning = true;
    bool requiresApproval = false;
    AgentPlan? plan;

    while (!isCompleted) {
      if (task.currentStepIndex >= task.steps.length && !needsPlanning) {
        isCompleted = true;
        break;
      }

      if (needsPlanning) {
        plan = AgentPlan(steps: [
          AgentStep(description: 'Initial analysis for: ${task.goal}'),
          AgentStep(description: 'Execution step for: ${task.goal}'),
        ]);
        needsPlanning = false;
      }

      if (requiresApproval) {
        requiresApproval = false;
      }

      if (plan != null && task.currentStepIndex < plan.steps.length) {
        final step = plan.steps[task.currentStepIndex];
        
        bool stepSuccess = false;
        int attempts = 0;
        while (!stepSuccess && attempts < 2) {
          try {
            await _toolExecutor.executeTool('web_search', {'query': step.description});
            step.isCompleted = true;
            stepSuccess = true;
          } catch (e) {
            attempts++;
            // Log failure and prepare context for fallback/next attempt
            if (attempts >= 2) {
               // Fallback: mark task as partially failed or switch logic
               break;
            }
          }
        }
        task.currentStepIndex++;
      } else {
        isCompleted = true;
      }
    }
  }
}
