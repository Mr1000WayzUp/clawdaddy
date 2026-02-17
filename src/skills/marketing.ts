import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class MarketingSkill extends BaseSkill {
  private client: Anthropic | null = null;

  constructor() {
    super('marketing', 'Generate marketing content and strategies');
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async execute(input: { task: string; context?: string }): Promise<Output> {
    try {
      if (!this.client) {
        this.initializeClient();
        if (!this.client) {
          throw new Error('Anthropic API key not configured');
        }
      }

      const prompt = `You are a marketing expert. ${input.context ? `Context: ${input.context}\n\n` : ''}Task: ${input.task}

Please provide a detailed marketing strategy or content based on the task above.`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';

      return this.createOutput({
        task: input.task,
        result: content,
        model: 'claude-3-5-sonnet-20241022',
      });
    } catch (error: any) {
      return this.createOutput(
        { task: input.task },
        'error',
        error.message || 'Marketing skill execution failed'
      );
    }
  }
}
