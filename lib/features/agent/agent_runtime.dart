import 'agent_task.dart';
import 'agent_plan.dart';
import 'tool_executor.dart';

class AgentRuntime {
  final ToolExecutor _toolExecutor;

  AgentRuntime(this._toolExecutor);

  Future<void> executeTask(AgentTask task) async {
    bool isCompleted = false;
    bool needsPlanning = true;
    AgentPlan? plan;
    int reflectionCount = 0;
    const int maxReflections = 3;

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

        // Execute with reflection
        try {
          final toolName = step.description.toLowerCase().contains('image') ? 'vision_analyze' : 'web_search';
          final args = step.description.toLowerCase().contains('image')
              ? {'image_path': 'screenshot.png'}
              : {'query': step.description};

          await _toolExecutor.executeTool(toolName, args);

          step.isCompleted = true;
          task.currentStepIndex++;
        } catch (e) {
          // Attempt automatic fix if reflection is still allowed
          if (reflectionCount < maxReflections) {
            reflectionCount++;
            await _toolExecutor.executeTool('error_fix', {'path': 'main.dart', 'error_log': e.toString()});
          } else {
            break;
          }
        }
      } else {
        isCompleted = true;
      }
    }
  }
}
