import { redis } from './agent-memory';
import { logger } from '../tools/logger';

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'blocked';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  linearId?: string;
  branchName?: string;
  prUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectState {
  projectName: string;
  currentSprint: string;
  tasks: Record<string, Task>;
  dailySpend: number;
  lastUpdated: number;
}

const STATE_KEY = 'project:1luv:state';

export async function getProjectState(): Promise<ProjectState> {
  const raw = await redis.get(STATE_KEY);
  if (!raw) {
    return {
      projectName: '1luv',
      currentSprint: 'sprint-1',
      tasks: {},
      dailySpend: 0,
      lastUpdated: Date.now(),
    };
  }
  return JSON.parse(raw) as ProjectState;
}

export async function saveProjectState(state: ProjectState): Promise<void> {
  state.lastUpdated = Date.now();
  await redis.set(STATE_KEY, JSON.stringify(state));
}

export async function upsertTask(task: Omit<Task, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<void> {
  const state = await getProjectState();
  const existing = state.tasks[task.id];
  state.tasks[task.id] = {
    ...task,
    createdAt: existing?.createdAt ?? task.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
  await saveProjectState(state);
  logger.info('Task upserted', { id: task.id, status: task.status });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, extras?: Partial<Task>): Promise<void> {
  const state = await getProjectState();
  if (!state.tasks[taskId]) throw new Error(`Task ${taskId} not found`);
  state.tasks[taskId] = { ...state.tasks[taskId], ...extras, status, updatedAt: Date.now() };
  await saveProjectState(state);
  logger.info('Task status updated', { taskId, status });
}

export async function recordSpend(amountUsd: number): Promise<void> {
  const state = await getProjectState();
  state.dailySpend += amountUsd;
  await saveProjectState(state);
}

export async function resetDailySpend(): Promise<void> {
  const state = await getProjectState();
  state.dailySpend = 0;
  await saveProjectState(state);
  logger.info('Daily spend reset');
}

export async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
  const state = await getProjectState();
  return Object.values(state.tasks).filter((t) => t.status === status);
}
