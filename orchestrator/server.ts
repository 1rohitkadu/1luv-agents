import 'dotenv/config';
import Fastify from 'fastify';
import { parseIncomingWebhook, isFromFounder, sendWhatsAppMessage } from './whatsapp';
import { enqueue, getQueueStats } from './queue';
import { CeoAgent } from '../agents/ceo-agent';
import { CooAgent } from '../agents/coo-agent';
import { CfoAgent } from '../agents/cfo-agent';
import { PmAgent } from '../agents/pm-agent';
import { DevFrontendAgent } from '../agents/dev-frontend-agent';
import { DevBackendAgent } from '../agents/dev-backend-agent';
import { QaAgent } from '../agents/qa-agent';
import { DevopsAgent } from '../agents/devops-agent';

const app = Fastify({ logger: false });
const PORT = Number(process.env.PORT) || 3000;

const REQUIRED_VARS = ['ANTHROPIC_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_NUMBER','FOUNDER_WHATSAPP','REDIS_HOST'];
const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  missing.forEach((v) => console.error('MISSING: ' + v));
  process.exit(1);
}

let ceo: CeoAgent, coo: CooAgent, cfo: CfoAgent, pm: PmAgent;
let frontendDev: DevFrontendAgent, backendDev: DevBackendAgent, qa: QaAgent, devops: DevopsAgent;

try {
  ceo = new CeoAgent(); coo = new CooAgent(); cfo = new CfoAgent(); pm = new PmAgent();
  frontendDev = new DevFrontendAgent(); backendDev = new DevBackendAgent();
  qa = new QaAgent(); devops = new DevopsAgent();
  console.log('All agents ready');
} catch (err) {
  console.error('AGENT ERROR: ' + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
}

app.post('/whatsapp/webhook', async (request, reply) => {
  try {
    const body = request.body as Record<string, string>;
    const data = parseIncomingWebhook(body);
    if (!isFromFounder(data.from)) return reply.send({ status: 'ignored' });
    const message = (data.body ?? '').trim().toLowerCase();
    console.log('Founder said: ' + message);
    if (message === 'status') {
      const stats = await getQueueStats();
      await sendWhatsAppMessage('*1luv Status*\nQueued: ' + stats.waiting + '\nActive: ' + stats.active + '\nDone: ' + stats.completed);
    } else {
      await enqueue('ceo' as any, { task: data.body, source: 'founder' });
      await sendWhatsAppMessage('Got it! CEO Agent is reviewing:\n"' + data.body + '"');
    }
    return reply.send({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error: ' + (err instanceof Error ? err.message : String(err)));
    return reply.status(500).send({ status: 'error' });
  }
});

app.get('/health', async (_, reply) => reply.send({ status: 'ok' }));

async function main() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log('1luv AI Company running on port ' + PORT);
    console.log('Waiting for WhatsApp commands...');
    await sendWhatsAppMessage('*1luv AI Company Online*\n\nAll 8 agents ready:\nCEO, COO, CFO, PM, Frontend, Backend, QA, DevOps\n\nType any task to begin.');
  } catch (err) {
    console.error('START ERROR: ' + (err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

main();