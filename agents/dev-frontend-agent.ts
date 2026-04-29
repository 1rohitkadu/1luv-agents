import { BaseAgent } from './base-agent';
import { runClaudeCodeTask } from '../tools/claude-code';
import { createBranch, createOrUpdateFile, createPullRequest } from '../tools/github';
import { updateTaskStatus } from '../memory/project-state';

const SYSTEM_PROMPT = `You are the Frontend Developer at 1luv, a dating app startup.
You write production-quality React Native (Expo) and Next.js code.
Stack: React Native + Expo, Next.js 14 (App Router), TypeScript, TailwindCSS, React Query, Zustand.
The 1luv app is a dating app. Write clean, accessible, performant UI code.
Always include proper TypeScript types. Follow existing code conventions.`;

export class DevFrontendAgent extends BaseAgent {
  constructor() {
    super({ id: 'dev-frontend', name: 'Frontend Dev', role: 'Frontend Developer', systemPrompt: SYSTEM_PROMPT });
  }

  async run(input: string): Promise<string> {
    return this.think(input);
  }

  async implementTask(taskId: string, title: string, description: string, workingDir: string): Promise<string> {
    await updateTaskStatus(taskId, 'in_progress');
    this.log.info('Starting task', { taskId, title });

    const branchName = `feature/frontend-${taskId.slice(0, 8)}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;

    try {
      await createBranch(branchName);
    } catch (err) {
      this.log.warn('Branch may already exist', { branchName });
    }

    const plan = await this.think(`Plan the implementation for: ${title}\n\n${description}\n\nList the files to create/modify and the key logic.`);

    const result = await runClaudeCodeTask(
      `Implement this frontend task for the 1luv dating app:\n\nTitle: ${title}\nDescription: ${description}\n\nPlan:\n${plan}`,
      workingDir
    );

    await this.remember(`task:${taskId}`, `Implemented: ${title}. Branch: ${branchName}`);
    await updateTaskStatus(taskId, 'review', { branchName });

    this.log.info('Task complete, ready for QA', { taskId, branchName });
    return `Frontend task ${taskId} complete. Branch: ${branchName}\n\n${result.slice(0, 500)}`;
  }
}
