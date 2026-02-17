import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class ResearchSkill extends BaseSkill {
  private client: Anthropic | null = null;

  constructor() {
    super('research', 'Conduct research and analysis on topics');
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async execute(input: { query: string; depth?: 'basic' | 'detailed' }): Promise<Output> {
    try {
      if (!this.client) {
        this.initializeClient();
        if (!this.client) {
          throw new Error('Anthropic API key not configured');
        }
      }

      const depth = input.depth || 'basic';
      const prompt = `You are a research analyst. Conduct a ${depth} research on: ${input.query}

Provide key findings, insights, and actionable recommendations.`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: depth === 'detailed' ? 4000 : 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';

      return this.createOutput({
        query: input.query,
        depth,
        findings: content,
        model: 'claude-3-5-sonnet-20241022',
      });
    } catch (error: any) {
      return this.createOutput(
        { query: input.query },
        'error',
        error.message || 'Research failed'
      );
    }
  }
}
