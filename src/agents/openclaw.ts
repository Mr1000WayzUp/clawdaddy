import { 
  MarketingSkill, 
  ContentCreationSkill, 
  ResearchSkill,
  BrowserAutomationSkill,
  SocialMediaSkill,
  CompetitorMonitoringSkill,
  LeadManagementSkill,
  BaseSkill
} from '../skills';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class OpenClawAgent {
  private skills: Map<string, BaseSkill>;
  private client: Anthropic | null = null;

  constructor() {
    this.skills = new Map();
    this.initializeSkills();
    this.initializeClient();
  }

  private initializeSkills() {
    const skillInstances = [
      new MarketingSkill(),
      new ContentCreationSkill(),
      new ResearchSkill(),
      new BrowserAutomationSkill(),
      new SocialMediaSkill(),
      new CompetitorMonitoringSkill(),
      new LeadManagementSkill(),
    ];

    skillInstances.forEach(skill => {
      this.skills.set(skill.getName(), skill);
    });
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public listSkills(): Array<{ name: string; description: string }> {
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.getName(),
      description: skill.getDescription(),
    }));
  }

  public async executeSkill(skillName: string, input: any): Promise<Output> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill '${skillName}' not found`);
    }
    return await skill.execute(input);
  }

  public async orchestrate(request: string): Promise<Output> {
    try {
      if (!this.client) {
        this.initializeClient();
        if (!this.client) {
          throw new Error('Anthropic API key not configured');
        }
      }

      // Use Claude to understand the request and determine which skill(s) to use
      const skillList = this.listSkills()
        .map(s => `- ${s.name}: ${s.description}`)
        .join('\n');

      const prompt = `You are an AI assistant orchestrator. Given the user's request, determine which skill to use and what parameters to pass.

Available skills:
${skillList}

User request: ${request}

Respond in JSON format with:
{
  "skill": "skill-name",
  "parameters": { /* parameters for the skill */ },
  "reasoning": "why this skill was chosen"
}

If the request is complex and requires multiple skills, choose the most appropriate primary skill.`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse skill selection response');
      }

      const decision = JSON.parse(jsonMatch[0]);
      
      // Execute the selected skill
      const result = await this.executeSkill(decision.skill, decision.parameters);
      
      return {
        ...result,
        content: {
          ...result.content,
          orchestration: {
            selectedSkill: decision.skill,
            reasoning: decision.reasoning,
          },
        },
      };
    } catch (error: any) {
      return {
        id: `orchestration-${Date.now()}`,
        timestamp: new Date(),
        skillName: 'orchestration',
        content: { request },
        status: 'error',
        error: error.message || 'Orchestration failed',
      };
    }
  }
}

export const openClawAgent = new OpenClawAgent();
