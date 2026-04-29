import 'dotenv/config';
import Fastify from 'fastify';
import { logger } from '../tools/logger';
import { parseIncomingWebhook, isFromFounder, sendWhatsAppMessage } from './whatsapp';
import { enqueue, createWorker, getQueueStats, type AgentJob } from './queue';
import { CeoAgent } from '../agents/ceo-agent';
import { CooAgent } from '../agents/coo-agent';
import { CfoAgent } from '../agents/cfo-agent';
import { PmAgent } from '../agents/pm-agent';
import { DevFrontendAgent } from '../agents/dev-frontend-agent';
import { DevBackendAgent } from '../agents/dev-backend-agent';
import { QaAgent } from '../agents/qa-agent';
import { DevopsAgent } from '../agents/devops-agent';
import type { Job } from 'bullmq';
import cron from 'node-cron';

const app = Fastify({ logger: false });
const PORT = Number(process.env.PORT) || 3000;

// Instantiate agents
const ceo = new CeoAgent();
const coo = new CooAgent();
const cfo = new CfoAgent();
const pm = new PmAgent();
const frontendDev = new DevFrontendAgent();
const backendDev = new DevBackendAgent();
const qa = new QaAgent();
const devops = new DevopsAgent();

const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

// ── Job processor ─────────────────────────────────────────────────────────────
async function processJob(job: Job<AgentJob>): Promise<unknown> {
  const { type, payload } = job.data;
  logger.info('Processing job', { type, jobId: job.id });

  switch (type) {
    case 'ceo_decision':
      return ceo.makeArchitectureDecision(payload.problem as string);

    case 'breakdown_feature':
      return pm.breakdownFeature(payload.feature as string);

    case 'implement_task': {
      const { taskId, title, description, assignedTo } = payload as { taskId: string; title: string; description: string; assignedTo: string };
      if (assignedTo === 'frontend-dev') return frontendDev.implementTask(taskId, title, description, PROJECT_DIR);
      if (assignedTo === 'backend-dev') return backendDev.implementTask(taskId, title, description, PROJECT_DIR);
      throw new Error(`Unknown assignee: ${assignedTo}`);
    }

    case 'review_code': {
      const { code, spec, taskId } = payload as { code: string; spec: string; taskId: string };
      return qa.reviewCode(code, spec, taskId);
    }

    case 'deploy': {
      const { service, branch } = payload as { service: string; branch: string };
      return devops.handleDeployment(service, branch, PROJECT_DIR);
    }

    case 'coo_coordinate':
      return coo.coordinateSprint();

    case 'daily_report':
      return cfo.generateDailyCostReport();

    case 'whatsapp_message':
      return sendWhatsAppMessage(payload.message as string);

    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/webhook/whatsapp', async (req, reply) => {
  const body = req.body as Record<string, string>;
  const msg = parseIncomingWebhook(body);

  if (!isFromFounder(msg.from)) {
    logger.warn('Ignoring WhatsApp from non-founder', { from: msg.from });
    return reply.send('<Response/>');
  }

  logger.info('Incoming WhatsApp from founder', { body: msg.body });

  // Route commands
  const text = msg.body.trim();
  if (text.toLowerCase().startsWith('/ceo ')) {
    await enqueue('ceo_decision', { problem: text.slice(5) }, { priority: 1 });
    await sendWhatsAppMessage('CEO is thinking... ⏳');
  } else if (text.toLowerCase().startsWith('/feature ')) {
    await enqueue('breakdown_feature', { feature: text.slice(9) }, { priority: 2 });
    await sendWhatsAppMessage('PM is breaking down the feature... ⏳');
  } else if (text.toLowerCase() === '/status') {
    const stats = await getQueueStats();
    await sendWhatsAppMessage(`*1luv Agent Status*\nQueue: ${JSON.stringify(stats, null, 2)}`);
  } else if (text.toLowerCase() === '/standup') {
    await enqueue('coo_coordinate', {});
  } else if (text.toLowerCase() === '/report') {
    await enqueue('daily_report', {}, { priority: 1 });
  } else {
    // General message → COO
    const response = await coo.run(text);
    await sendWhatsAppMessage(response.slice(0, 1500));
  }

  reply.send('<Response/>');
});

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

app.get('/queue/stats', async () => getQueueStats());

// ── Scheduled jobs ────────────────────────────────────────────────────────────
function scheduleJobs() {
  // Daily standup at 9am
  cron.schedule('0 9 * * 1-5', () => enqueue('coo_coordinate', {}));
  // Daily cost report at 6pm
  cron.schedule('0 18 * * *', () => enqueue('daily_report', {}));
  // Budget check every hour
  cron.schedule('0 * * * *', () => cfo.checkBudget());
  // Reset daily spend at midnight
  cron.schedule('0 0 * * *', () => cfo.resetBudget());
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function start() {
  const worker = createWorker(processJob);

  scheduleJobs();

  await app.listen({ port: PORT, host: '0.0.0.0' });
  logger.info(`1luv-agents server running on port ${PORT}`);

  await sendWhatsAppMessage(`*1luv Agents Online* 🤖\nServer started on port ${PORT}. Type /status to check.`).catch(() => {});

  const shutdown = async () => {
    logger.info('Shutting down...');
    await worker.close();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
