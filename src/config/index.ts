import dotenv from 'dotenv';
import { Config } from '../types';
import fs from 'fs';
import path from 'path';

dotenv.config();

const configPath = path.join(__dirname, '../../data/config.json');

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    // Load from environment variables
    const envConfig: Config = {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      twitterApiKey: process.env.TWITTER_API_KEY,
      twitterApiSecret: process.env.TWITTER_API_SECRET,
      twitterAccessToken: process.env.TWITTER_ACCESS_TOKEN,
      twitterAccessSecret: process.env.TWITTER_ACCESS_SECRET,
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL || 'sqlite://./data/clawdaddy.db',
    };

    // Try to load from file (overrides env vars)
    if (fs.existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ...envConfig, ...fileConfig };
      } catch (error) {
        console.error('Error loading config file:', error);
      }
    }

    return envConfig;
  }

  public getConfig(): Config {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  public getApiKey(service: 'anthropic' | 'openai' | 'twitter'): string | undefined {
    switch (service) {
      case 'anthropic':
        return this.config.anthropicApiKey;
      case 'openai':
        return this.config.openaiApiKey;
      case 'twitter':
        return this.config.twitterApiKey;
      default:
        return undefined;
    }
  }
}

export const configManager = new ConfigManager();
