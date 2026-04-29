import { BaseAgent } from './base-agent';
import { upsertTask } from '../memory/project-state';
import { createLinearTask } from '../tools/linear';
import { readFile } from '../tools/filesystem';
import path from 'path';

const SYSTEM_PROMPT = `You are the PM of 1luv, a dating app startup.
You break down high-level features into concrete, actionable tickets.
Each ticket should have: clear title, description, acceptance criteria, and assignee (frontend-dev, backend-dev, devops, or qa).
Output tickets as JSON array. Be specific about technical requirements.`;

export class PmAgent extends BaseAgent {
  constructor() {
    super({ id: 'pm', name: 'PM', role: 'Product Manager', systemPrompt: SYSTEM_PROMPT });
  }

  private async loadPrompt(): Promise<string> {
    try {
      return await readFile(path.join(__dirname, '../prompts/pm.md'));
    } catch {
      return SYSTEM_PROMPT;
    }
  }

  async run(input: string): Promise<string> {
    if (this.config.systemPrompt === SYSTEM_PROMPT) {
      this.config.systemPrompt = await this.loadPrompt();
    }
    return this.think(input);
  }

  async breakdownFeature(feature: string): Promise<Array<{ id: string; title: string; description: string; assignedTo: string }>> {
    const prompt = `Break this feature into tickets:\n\n${feature}\n\nReturn a JSON array of tickets with fields: title, description, acceptanceCriteria, assignedTo (one of: frontend-dev, backend-dev, devops, qa).`;
    const response = await this.think(prompt, true);

    let tickets: Array<{ title: string; description: string; assignedTo: string }> = [];
    try {
      const match = response.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
      tickets = JSON.parse(match ? match[1] : response);
    } catch {
      this.log.warn('Failed to parse tickets JSON, returning raw response');
      return [{ id: crypto.randomUUID(), title: feature, description: response, assignedTo: 'backend-dev' }];
    }

    const result = [];
    for (const t of tickets) {
      const id = crypto.randomUUID();
      await upsertTask({
        id,
        title: t.title,
        description: t.description,
        assignedTo: t.assignedTo,
        status: 'pending',
      });
      result.push({ id, ...t });
    }

    this.log.info('Created tickets', { count: result.length, feature: feature.slice(0, 80) });
    return result;
  }

  async createLinearTickets(tickets: Array<{ title: string; description: string; assignedTo: string }>): Promise<void> {
    try {
      for (const t of tickets) {
        await createLinearTask({
          title: t.title,
          description: t.description,
          priority: 'medium',
        });
        this.log.info('Linear ticket created', { title: t.title });
      }
    } catch (err) {
      this.log.warn('Could not create Linear tickets', { err });
    }
  }
}
