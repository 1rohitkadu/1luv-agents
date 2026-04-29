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

// ── Check required env vars before doing anything ──────────────────
const REQUIRED_VARS = [
  'ANTHROPIC_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_NUMBER',
  'FOUNDER_WHATSAPP',
  'REDIS_HOST',
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error('');
  console.error('🔴 MISSING ENVIRONMENT VARIABLES:');
  missing.forEach((v) => console.error(`   ❌ ${v} is not set`));
  console.error('');
  console.error('Add these in Railway → your project → Variables tab');
  console.error('');
  process.exit(1);
}

// ── Instantiate agents safely ───────────────────────────────────────
let ceo: CeoAgent;
let coo: CooAgent;
let cfo: CfoAgent;
let pm: PmAgent;
let frontendDev: DevFrontendAgent;
let backendDev: DevBackendAgent;
let qa: QaAgent;
let devops: DevopsAgent;

try {
  ceo       = new CeoAgent();
  coo       = new CooAgent();
  cfo       = new CfoAgent();
  pm        = new PmAgent();
  frontendDev = new DevFrontendAgent();
  backendDev  = new DevBackendAgent();
  qa        = new QaAgent();
  devops    = new DevopsAgent();
  console.log('✅ All agents instantiated successfully');
} catch (err) {
  console.error('🔴 AGENT STARTUP ERROR:');
  console.error(err instanceof Error ? err.message : JSON.stringify(err));
  console.error(err instanceof Error ? err.stack : '');
  process.exit(1);
}

const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();

// ── WhatsApp webhook ────────────────────────────────────────────────
app.post('/whatsapp/webhook', async (request, reply) => {
  try {
    const data = parseIncomingWebhook(request.body as Record<string, string>);
    if (!isFromFounder(data.from)) {
      return reply.send({ status: 'ignored' });
    }

    const message = data.body?.trim().toLowerCase();
    console.log(`[WhatsApp] Founder said: "${message}"`);

    if (message === 'status') {
      const stats = await getQueueStats();
      await sendWhatsAppMessage(
        process.env.FOUNDER_WHATSAPP!,
        `*1luv Agent Status* 🤖\n\nQueued: ${stats.waiting}\nActive: ${stats.active}\nCompleted: ${stats.completed}\n\nAll agents online ✅`
      );
    } else if (message === 'pause') {
      await sendWhatsAppMessage(process.env.FOUNDER_WHATSAPP!, '⏸ Pausing agents...');
    } else if (message === 'costs') {
      await sendWhatsAppMessage(process.env.FOUNDER_WHATSAPP!, '💰 Cost report coming soon...');
    } else {
      await enqueue('ceo_decision', { task: data.body, source: 'founder' });
      await sendWhatsAppMessage(
        process.env.FOUNDER_WHATSAPP!,
        `📥 Got it! Your CEO Agent is reviewing:\n"${data.body}"`
      );
    }

    reply.send({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err instanceof Error ? err.message : err);
    reply.status(500).send({ status: 'error' });
  }
});

// ── Health check ────────────────────────────────────────────────────
app.get('/health', async (_, reply) => {
  reply.send({ status: 'ok', agents: 8, timestamp: new Date().toISOString() });
});

// ── Start server ────────────────────────────────────────────────────
async function main() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 1luv AI Company running on port ${PORT}`);
    console.log('📱 Waiting for founder commands on WhatsApp...');

    await sendWhatsAppMessage(
      process.env.FOUNDER_WHATSAPP!,
      `*1luv AI Company Online* 🚀\n\nYour AI team is ready:\n✅ CEO Agent\n✅ COO Agent\n✅ CFO Agent\n✅ Project Manager\n✅ Frontend Dev\n✅ Backend Dev\n✅ QA Agent\n✅ DevOps Agent\n\nType any task to begin.`
    );
  } catch (err) {
    console.error('🔴 SERVER FAILED TO START:');
    console.error(err instanceof Error ? err.message : JSON.stringify(err));
    console.error(err instanceof Error ? err.stack : '');
    process.exit(1);
  }
}

main();
