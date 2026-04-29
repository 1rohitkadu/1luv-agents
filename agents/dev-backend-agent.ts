import { BaseAgent } from './base-agent';
import { runClaudeCodeTask } from '../tools/claude-code';
import { createBranch, createPullRequest } from '../tools/github';
import { updateTaskStatus } from '../memory/project-state';

const SYSTEM_PROMPT = `You are the Backend Developer at 1luv, a dating app startup.
You write production-quality Fastify (Node.js/TypeScript) and Python code.
Stack: Fastify, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, Python (FastAPI for ML services).
The 1luv app is a dating app — you build matching algorithms, user profiles, messaging, notifications.
Write type-safe, performant, well-tested backend code. Include input validation (Zod/Pydantic). Follow REST conventions.`;

export class DevBackendAgent extends BaseAgent {
  constructor() {
    super({ id: 'dev-backend', name: 'Backend Dev', role: 'Backend Developer', systemPrompt: SYSTEM_PROMPT });
  }

  async run(input: string): Promise<string> {
    return this.think(input);
  }

  async implementTask(taskId: string, title: string, description: string, workingDir: string): Promise<string> {
    await updateTaskStatus(taskId, 'in_progress');
    this.log.info('Starting task', { taskId, title });

    const branchName = `feature/backend-${taskId.slice(0, 8)}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;

    try {
      await createBranch(branchName);
    } catch {
      this.log.warn('Branch may already exist', { branchName });
    }

    const plan = await this.think(`Plan the backend implementation for: ${title}\n\n${description}\n\nList API endpoints, data models, and key logic.`);

    const result = await runClaudeCodeTask(
      `Implement this backend task for the 1luv dating app:\n\nTitle: ${title}\nDescription: ${description}\n\nPlan:\n${plan}`,
      workingDir
    );

    await this.remember(`task:${taskId}`, `Implemented: ${title}. Branch: ${branchName}`);
    await updateTaskStatus(taskId, 'review', { branchName });

    this.log.info('Task complete, ready for QA', { taskId, branchName });
    return `Backend task ${taskId} complete. Branch: ${branchName}\n\n${result.slice(0, 500)}`;
  }

  async designApi(feature: string): Promise<string> {
    return this.think(`Design a REST API for: ${feature}\n\nInclude: endpoints, request/response schemas, auth requirements, error cases.`);
  }
}
