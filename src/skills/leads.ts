import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class LeadManagementSkill extends BaseSkill {
  private client: Anthropic | null = null;
  private leads: any[] = [];

  constructor() {
    super('lead-management', 'Manage and qualify leads');
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async execute(input: { 
    action: 'add' | 'qualify' | 'list';
    lead?: any;
    leadId?: string;
  }): Promise<Output> {
    try {
      if (input.action === 'add' && input.lead) {
        const newLead = {
          id: `lead-${Date.now()}`,
          ...input.lead,
          createdAt: new Date().toISOString(),
        };
        this.leads.push(newLead);
        return this.createOutput({
          action: 'add',
          lead: newLead,
          message: 'Lead added successfully',
        });
      }

      if (input.action === 'qualify' && input.lead) {
        if (!this.client) {
          this.initializeClient();
          if (!this.client) {
            throw new Error('Anthropic API key not configured');
          }
        }

        const prompt = `You are a sales qualification expert. Qualify this lead:
Name: ${input.lead.name}
Company: ${input.lead.company || 'N/A'}
Email: ${input.lead.email || 'N/A'}
Context: ${input.lead.context || 'N/A'}

Provide a qualification score (1-10), key insights, and recommended next actions.`;

        const message = await this.client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        });

        const analysis = message.content[0].type === 'text' ? message.content[0].text : '';

        return this.createOutput({
          action: 'qualify',
          lead: input.lead,
          qualification: analysis,
        });
      }

      if (input.action === 'list') {
        return this.createOutput({
          action: 'list',
          leads: this.leads,
          count: this.leads.length,
        });
      }

      throw new Error('Invalid action or missing required parameters');
    } catch (error: any) {
      return this.createOutput(
        { action: input.action },
        'error',
        error.message || 'Lead management failed'
      );
    }
  }
}
