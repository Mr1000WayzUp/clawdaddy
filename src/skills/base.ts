import { Output } from '../types';

export abstract class BaseSkill {
  protected name: string;
  protected description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  public getName(): string {
    return this.name;
  }

  public getDescription(): string {
    return this.description;
  }

  public abstract execute(input: any): Promise<Output>;

  protected createOutput(content: any, status: 'success' | 'error' = 'success', error?: string): Output {
    return {
      id: `${this.name}-${Date.now()}`,
      timestamp: new Date(),
      skillName: this.name,
      content,
      status,
      error,
    };
  }
}
