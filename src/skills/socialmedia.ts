import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';

export class SocialMediaSkill extends BaseSkill {
  constructor() {
    super('social-media', 'Post content to social media platforms');
  }

  public async execute(input: { 
    platform: string;
    content: string;
    scheduledTime?: string;
  }): Promise<Output> {
    try {
      // Check if API keys are configured
      const hasTwitterKey = configManager.getApiKey('twitter');
      
      const result = {
        platform: input.platform,
        content: input.content,
        scheduledTime: input.scheduledTime,
        status: hasTwitterKey ? 'ready' : 'needs_config',
        message: hasTwitterKey 
          ? 'Social media posting is configured and ready.' 
          : 'Configure API keys to enable social media posting.',
        timestamp: new Date().toISOString(),
      };

      return this.createOutput(result);
    } catch (error: any) {
      return this.createOutput(
        { platform: input.platform, content: input.content },
        'error',
        error.message || 'Social media posting failed'
      );
    }
  }
}
