import Anthropic from '@anthropic-ai/sdk';
import { agentLogger } from '../tools/logger';
import { saveMemory, getRecentMemories } from '../memory/agent-memory';
import { recordSpend } from '../memory/project-state';
import type { Logger } from 'winston';

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model?: string;
  systemPrompt: string;
  maxTokens?: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PRICE_PER_INPUT_TOKEN = 3 / 1_000_000;   // $3 / 1M tokens (Sonnet 4.6)
const PRICE_PER_OUTPUT_TOKEN = 15 / 1_000_000; // $15 / 1M tokens

export abstract class BaseAgent {
  protected client: Anthropic;
  protected log: Logger;
  protected config: AgentConfig;
  private conversationHistory: AgentMessage[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.log = agentLogger(config.name);
  }

  get id() { return this.config.id; }
  get name() { return this.config.name; }

  protected async think(userMessage: string, clearHistory = false): Promise<string> {
    if (clearHistory) this.conversationHistory = [];

    const memories = await getRecentMemories(this.config.id, 10);
    const memoryContext = memories.length
      ? `\n\nRecent learnings:\n${memories.map((m) => `- ${m.key}: ${m.value}`).join('\n')}`
      : '';

    this.conversationHistory.push({ role: 'user', content: userMessage });

    const response = await this.client.messages.create({
      model: this.config.model || 'claude-sonnet-4-6',
      max_tokens: this.config.maxTokens || 4096,
      system: this.config.systemPrompt + memoryContext,
      messages: this.conversationHistory,
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = inputTokens * PRICE_PER_INPUT_TOKEN + outputTokens * PRICE_PER_OUTPUT_TOKEN;
    await recordSpend(costUsd);

    const assistantMessage = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

    this.log.info('Completed thinking', {
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(4),
    });

    return assistantMessage;
  }

  protected async remember(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await saveMemory(this.config.id, key, value, ttlSeconds);
  }

  abstract run(input: string): Promise<string>;
}
