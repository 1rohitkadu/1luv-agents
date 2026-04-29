import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { redis } from '../memory/agent-memory';
import { logger } from '../tools/logger';
import { CfoAgent } from '../agents/cfo-agent';

export type JobType =
  | 'whatsapp_message'
  | 'breakdown_feature'
  | 'implement_task'
  | 'review_code'
  | 'deploy'
  | 'ceo_decision'
  | 'coo_coordinate'
  | 'daily_report';

export interface AgentJob {
  type: JobType;
  payload: Record<string, unknown>;
  requestedBy?: string;
}

export const agentQueue = new Queue<AgentJob>('agent-jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export async function enqueue(type: JobType, payload: Record<string, unknown>, opts?: { priority?: number; delay?: number }): Promise<string> {
  const job = await agentQueue.add(type, { type, payload }, {
    priority: opts?.priority,
    delay: opts?.delay,
  });
  logger.info('Job enqueued', { type, jobId: job.id });
  return job.id!;
}

export function createWorker(
  processor: (job: Job<AgentJob>) => Promise<unknown>
): Worker<AgentJob> {
  const cfo = new CfoAgent();

  const worker = new Worker<AgentJob>(
    'agent-jobs',
    async (job) => {
      // Budget gate: skip non-critical jobs if over budget
      const criticalTypes: JobType[] = ['cfo_report' as JobType, 'daily_report', 'whatsapp_message'];
      if (!criticalTypes.includes(job.data.type)) {
        const withinBudget = await cfo.isWithinBudget();
        if (!withinBudget) {
          logger.warn('Job skipped — over daily budget', { jobId: job.id, type: job.data.type });
          return { skipped: true, reason: 'budget_exceeded' };
        }
      }
      return processor(job);
    },
    {
      connection: redis,
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => logger.info('Job completed', { jobId: job.id, type: job.data.type }));
  worker.on('failed', (job, err) => logger.error('Job failed', { jobId: job?.id, type: job?.data.type, err: err.message }));

  return worker;
}

export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    agentQueue.getWaitingCount(),
    agentQueue.getActiveCount(),
    agentQueue.getCompletedCount(),
    agentQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}
