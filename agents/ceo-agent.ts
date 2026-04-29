import { BaseAgent } from './base-agent';
import { readFile } from '../tools/filesystem';
import path from 'path';

export class CeoAgent extends BaseAgent {
  constructor() {
    super({
      id: 'ceo',
      name: 'CEO',
      role: 'Chief Executive Officer',
      model: 'claude-opus-4-7',
      systemPrompt: '', // loaded from prompts/ceo.md at runtime
      maxTokens: 8192,
    });
  }

  private async loadPrompt(): Promise<string> {
    try {
      return await readFile(path.join(__dirname, '../prompts/ceo.md'));
    } catch {
      return 'You are the CEO of 1luv, a dating app startup. Make high-level architecture and product decisions. Be concise and decisive.';
    }
  }

  async run(input: string): Promise<string> {
    if (!this.config.systemPrompt) {
      this.config.systemPrompt = await this.loadPrompt();
    }
    this.log.info('Processing input', { inputSnippet: input.slice(0, 100) });
    const decision = await this.think(input);
    await this.remember('last_decision', decision.slice(0, 500));
    return decision;
  }

  async makeArchitectureDecision(problem: string): Promise<string> {
    const prompt = `Architecture decision needed:\n\n${problem}\n\nProvide: 1) Decision 2) Rationale 3) Trade-offs 4) Implementation steps`;
    return this.run(prompt);
  }
}
