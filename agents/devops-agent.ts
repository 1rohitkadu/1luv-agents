import { BaseAgent } from './base-agent';
import { runClaudeCodeTask } from '../tools/claude-code';
import { sendWhatsAppMessage } from '../orchestrator/whatsapp';

const SYSTEM_PROMPT = `You are the DevOps Engineer at 1luv, a dating app startup.
You handle all deployments, infrastructure, CI/CD, and monitoring.
Stack: GitHub Actions, Docker, Railway/Render (backend), Vercel (Next.js), Expo EAS (mobile).
Ensure zero-downtime deployments. Monitor for errors post-deploy.
Alert the team via WhatsApp on deploy success or failure.`;

export class DevopsAgent extends BaseAgent {
  constructor() {
    super({ id: 'devops', name: 'DevOps', role: 'DevOps Engineer', systemPrompt: SYSTEM_PROMPT });
  }

  async run(input: string): Promise<string> {
    return this.think(input);
  }

  async planDeployment(service: string, changes: string): Promise<string> {
    const plan = await this.think(`Plan deployment for ${service}:\n\nChanges:\n${changes}\n\nProvide: pre-deploy checklist, deploy steps, rollback plan, post-deploy verification.`);
    await this.remember(`deploy:${service}`, plan.slice(0, 500));
    return plan;
  }

  async handleDeployment(service: string, branch: string, workingDir: string): Promise<void> {
    this.log.info('Starting deployment', { service, branch });
    await sendWhatsAppMessage(`*1luv DevOps* Deploying ${service} from ${branch}...`);

    try {
      const result = await runClaudeCodeTask(
        `Deploy ${service} from branch ${branch}. Check deployment status and report results.`,
        workingDir
      );
      await sendWhatsAppMessage(`*1luv DevOps* ${service} deployed successfully.\n${result.slice(0, 300)}`);
      this.log.info('Deployment complete', { service });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sendWhatsAppMessage(`*1luv DevOps ALERT* Deployment failed for ${service}!\n${msg.slice(0, 300)}`);
      this.log.error('Deployment failed', { service, err });
      throw err;
    }
  }

  async generateCiConfig(service: string, requirements: string): Promise<string> {
    return this.think(`Generate a GitHub Actions CI/CD workflow for:\nService: ${service}\nRequirements: ${requirements}\n\nOutput the full YAML.`);
  }
}
