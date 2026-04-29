import { BaseAgent } from './base-agent';
import { getProjectState, resetDailySpend } from '../memory/project-state';
import { sendWhatsAppMessage } from '../orchestrator/whatsapp';

const DAILY_BUDGET = Number(process.env.DAILY_BUDGET_USD) || 50;

const SYSTEM_PROMPT = `You are the CFO of 1luv, a dating app startup.
You monitor all API costs (Anthropic, GitHub, Linear, Twilio) and enforce the daily budget of $${DAILY_BUDGET}.
Alert when spend exceeds 50% and 80% of daily budget.
Provide cost breakdowns and optimization suggestions.
Track ROI: cost per feature shipped.`;

export class CfoAgent extends BaseAgent {
  constructor() {
    super({ id: 'cfo', name: 'CFO', role: 'Chief Financial Officer', systemPrompt: SYSTEM_PROMPT });
  }

  async run(input: string): Promise<string> {
    return this.think(input);
  }

  async checkBudget(): Promise<{ withinBudget: boolean; spend: number; remaining: number }> {
    const state = await getProjectState();
    const spend = state.dailySpend;
    const remaining = DAILY_BUDGET - spend;
    const pct = (spend / DAILY_BUDGET) * 100;

    this.log.info('Budget check', { spend, remaining, pct: pct.toFixed(1) });

    if (pct >= 80) {
      await sendWhatsAppMessage(`*1luv CFO Alert* Budget ${pct.toFixed(1)}% used ($${spend.toFixed(2)} / $${DAILY_BUDGET}). Pausing non-critical tasks.`);
    } else if (pct >= 50) {
      await sendWhatsAppMessage(`*1luv CFO Notice* Budget ${pct.toFixed(1)}% used ($${spend.toFixed(2)} / $${DAILY_BUDGET}).`);
    }

    return { withinBudget: spend < DAILY_BUDGET, spend, remaining };
  }

  async isWithinBudget(): Promise<boolean> {
    const { withinBudget } = await this.checkBudget();
    return withinBudget;
  }

  async generateDailyCostReport(): Promise<string> {
    const state = await getProjectState();
    const report = await this.think(`Generate a cost report. Daily spend: $${state.dailySpend.toFixed(2)} of $${DAILY_BUDGET} budget. Tasks completed today: ${Object.values(state.tasks).filter((t) => t.status === 'done').length}.`);
    await sendWhatsAppMessage(`*1luv CFO Daily Report*\n\n${report}`);
    return report;
  }

  async resetBudget(): Promise<void> {
    await resetDailySpend();
    this.log.info('Daily budget reset');
  }
}
