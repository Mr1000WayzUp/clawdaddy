import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class ContentCreationSkill extends BaseSkill {
  private client: Anthropic | null = null;

  constructor() {
    super('content-creation', 'Create various types of content (blog posts, social media, emails)');
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async execute(input: { 
    type: string; 
    topic: string; 
    tone?: string;
    length?: string;
  }): Promise<Output> {
    try {
      if (!this.client) {
        this.initializeClient();
        if (!this.client) {
          throw new Error('Anthropic API key not configured');
        }
      }

      const prompt = `You are a professional content creator. Create ${input.type} content about: ${input.topic}
${input.tone ? `Tone: ${input.tone}` : ''}
${input.length ? `Length: ${input.length}` : ''}

Please create engaging, high-quality content.`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0].type === 'text' ? message.content[0].text : '';

      return this.createOutput({
        type: input.type,
        topic: input.topic,
        content,
        model: 'claude-3-5-sonnet-20241022',
      });
    } catch (error: any) {
      return this.createOutput(
        { type: input.type, topic: input.topic },
        'error',
        error.message || 'Content creation failed'
      );
    }
  }
}
