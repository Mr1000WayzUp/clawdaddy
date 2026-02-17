export interface Config {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  twitterApiKey?: string;
  twitterApiSecret?: string;
  twitterAccessToken?: string;
  twitterAccessSecret?: string;
  port: number;
  nodeEnv: string;
  databaseUrl: string;
}

export interface SkillConfig {
  name: string;
  enabled: boolean;
  description: string;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  skills: string[];
  schedule?: string;
  enabled: boolean;
}

export interface Output {
  id: string;
  timestamp: Date;
  skillName: string;
  workflowId?: string;
  content: any;
  status: 'success' | 'error';
  error?: string;
}
