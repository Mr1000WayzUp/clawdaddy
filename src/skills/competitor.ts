import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class CompetitorMonitoringSkill extends BaseSkill {
  private client: Anthropic | null = null;

  constructor() {
    super('competitor-monitoring', 'Monitor and analyze competitor activities');
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async execute(input: { 
    competitor: string;
    aspects?: string[];
    urls?: string[];
  }): Promise<Output> {
    try {
      if (!this.client) {
        this.initializeClient();
        if (!this.client) {
          throw new Error('Anthropic API key not configured');
        }
      }

      const aspects = input.aspects?.join(', ') || 'general strategy, pricing, marketing';
      const prompt = `You are a competitive intelligence analyst. Analyze competitor: ${input.competitor}

Focus on these aspects: ${aspects}
${input.urls ? `URLs to consider: ${input.urls.join(', ')}` : ''}

Provide insights on their strategy, strengths, weaknesses, and recommendations for competitive positioning.`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';

      return this.createOutput({
        competitor: input.competitor,
        aspects: input.aspects,
        analysis: content,
        model: 'claude-3-5-sonnet-20241022',
      });
    } catch (error: any) {
      return this.createOutput(
        { competitor: input.competitor },
        'error',
        error.message || 'Competitor monitoring failed'
      );
    }
  }
}
