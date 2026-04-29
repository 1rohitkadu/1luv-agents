import { BaseAgent } from './base-agent';
import { getProjectState, getTasksByStatus } from '../memory/project-state';
import { sendWhatsAppMessage } from '../orchestrator/whatsapp';

const SYSTEM_PROMPT = `You are the COO of 1luv, a dating app startup.
You coordinate all agents to ensure the project moves forward efficiently.
You have visibility into all tasks, agent statuses, and blockers.
Prioritize unblocking developers, resolving conflicts, and keeping the sprint on track.
Be decisive and action-oriented. Communicate clearly and concisely.`;

export class CooAgent extends BaseAgent {
  constructor() {
    super({ id: 'coo', name: 'COO', role: 'Chief Operating Officer', systemPrompt: SYSTEM_PROMPT });
  }

  async run(input: string): Promise<string> {
    this.log.info('Coordinating', { input: input.slice(0, 100) });
    return this.think(input);
  }

  async coordinateSprint(): Promise<void> {
    const state = await getProjectState();
    const blocked = await getTasksByStatus('blocked');
    const inProgress = await getTasksByStatus('in_progress');

    const summary = `
Current sprint: ${state.currentSprint}
In progress tasks: ${inProgress.length}
Blocked tasks: ${blocked.length}
Daily spend: $${state.dailySpend.toFixed(2)}

Blocked tasks:
${blocked.map((t) => `- ${t.title} (assigned: ${t.assignedTo})`).join('\n') || 'None'}
    `.trim();

    const response = await this.think(`Daily standup summary:\n${summary}\n\nWhat coordination actions should be taken?`);
    await this.remember('daily_summary', summary, 86400);

    await sendWhatsAppMessage(`*1luv COO Daily Update*\n\n${response}`);
  }

  async resolveBlocker(taskId: string, blockerDescription: string): Promise<string> {
    const prompt = `Task ${taskId} is blocked: ${blockerDescription}\n\nProvide specific steps to unblock this task.`;
    return this.run(prompt);
  }
}
