# Contributing to ClawDaddy

Thank you for your interest in contributing to ClawDaddy! This guide will help you add new skills, extend functionality, and improve the project.

## Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/Mr1000WayzUp/clawdaddy.git
cd clawdaddy
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. **Start development server**
```bash
npm run dev
```

## Project Structure

```
clawdaddy/
├── src/
│   ├── agents/          # OpenClaw agent orchestration
│   │   ├── openclaw.ts  # Main orchestration logic
│   │   └── index.ts     # Exports
│   ├── skills/          # Individual skill implementations
│   │   ├── base.ts      # Base skill class
│   │   ├── marketing.ts # Marketing skill
│   │   ├── content.ts   # Content creation skill
│   │   └── ...          # Other skills
│   ├── routes/          # Express API routes
│   │   ├── config.ts    # Configuration endpoints
│   │   ├── skills.ts    # Skill execution endpoints
│   │   └── workflows.ts # Workflow orchestration
│   ├── config/          # Configuration management
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Server entry point
├── public/              # Web dashboard
│   ├── css/            # Styles
│   ├── js/             # Frontend JavaScript
│   └── index.html      # Dashboard HTML
└── data/               # Persistent data (gitignored)
```

## Adding a New Skill

### 1. Create the Skill File

Create a new file in `src/skills/your-skill.ts`:

```typescript
import { BaseSkill } from './base';
import { Output } from '../types';
import { configManager } from '../config';
import Anthropic from '@anthropic-ai/sdk';

export class YourSkill extends BaseSkill {
  private client: Anthropic | null = null;

  constructor() {
    super('your-skill', 'Description of what your skill does');
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = configManager.getApiKey('anthropic');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async execute(input: YourInputType): Promise<Output> {
    try {
      if (!this.client) {
        this.initializeClient();
        if (!this.client) {
          throw new Error('Anthropic API key not configured');
        }
      }

      // Your skill logic here
      const result = await this.performTask(input);

      return this.createOutput({
        input,
        result,
        // ... other output data
      });
    } catch (error: any) {
      return this.createOutput(
        { input },
        'error',
        error.message || 'Skill execution failed'
      );
    }
  }

  private async performTask(input: YourInputType): Promise<any> {
    // Implement your skill logic
    // Can use Claude AI, external APIs, etc.
  }
}
```

### 2. Export the Skill

Add to `src/skills/index.ts`:

```typescript
export { YourSkill } from './your-skill';
```

### 3. Register in Agent

Add to `src/agents/openclaw.ts` in the `initializeSkills()` method:

```typescript
private initializeSkills() {
  const skillInstances = [
    new MarketingSkill(),
    new ContentCreationSkill(),
    // ... existing skills
    new YourSkill(), // Add your skill here
  ];

  skillInstances.forEach(skill => {
    this.skills.set(skill.getName(), skill);
  });
}
```

### 4. Test Your Skill

```bash
# Via API
curl -X POST http://localhost:3000/api/skills/your-skill \
  -H "Content-Type: application/json" \
  -d '{"param1": "value1", "param2": "value2"}'

# Via dashboard
# Go to Skills tab and select your skill from the dropdown
```

## Skill Development Guidelines

### Input/Output Design

- **Input**: Design clear, JSON-serializable input parameters
- **Output**: Use the `Output` type from `../types`
- **Error Handling**: Always catch errors and return error status

### Using AI Models

```typescript
// Claude (Anthropic)
const message = await this.client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  messages: [{ role: 'user', content: prompt }],
});

const content = message.content[0].type === 'text' 
  ? message.content[0].text 
  : '';
```

### External API Integration

```typescript
import axios from 'axios';

const response = await axios.get('https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
  },
});
```

### Stateful Skills

If your skill needs to maintain state:

```typescript
export class StatefulSkill extends BaseSkill {
  private state: Map<string, any>;
  private persistencePath: string;

  constructor() {
    super('stateful-skill', 'Description');
    this.state = new Map();
    this.persistencePath = path.join(__dirname, '../../data/stateful-skill.json');
    this.loadState();
  }

  private loadState() {
    if (fs.existsSync(this.persistencePath)) {
      const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf-8'));
      this.state = new Map(Object.entries(data));
    }
  }

  private saveState() {
    const data = Object.fromEntries(this.state);
    fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
  }
}
```

## Adding API Endpoints

### 1. Create Route Handler

In `src/routes/your-route.ts`:

```typescript
import express, { Request, Response } from 'express';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  // GET handler
});

router.post('/', async (req: Request, res: Response) => {
  try {
    // POST handler
    const result = await someAsyncOperation(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 2. Register Route

In `src/index.ts`:

```typescript
import yourRoutes from './routes/your-route';

// ...
app.use('/api/your-endpoint', yourRoutes);
```

## Frontend Development

### Adding Dashboard Features

Edit `public/index.html` and `public/js/app.js`:

```javascript
// Add new tab
document.getElementById('new-tab-btn').addEventListener('click', async () => {
  const response = await fetch(`${API_URL}/your-endpoint`);
  const data = await response.json();
  displayData(data);
});
```

### Styling

Edit `public/css/styles.css` for custom styles.

## Testing

### Manual Testing

```bash
# Start server
npm run dev

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/skills
```

### Integration Testing

Create test scripts in `tests/` directory:

```bash
#!/bin/bash
# test-skill.sh

echo "Testing marketing skill..."
curl -X POST http://localhost:3000/api/skills/marketing \
  -H "Content-Type: application/json" \
  -d '{"task": "Create a campaign", "context": "Tech startup"}'

echo "✅ Test passed"
```

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Use async/await instead of promises
- Handle all errors gracefully
- Add JSDoc comments for complex functions

### Example

```typescript
/**
 * Analyzes competitor data and generates insights
 * @param competitor - Name of the competitor
 * @param aspects - Aspects to analyze (pricing, features, etc.)
 * @returns Analysis results and recommendations
 */
async function analyzeCompetitor(
  competitor: string,
  aspects: string[]
): Promise<AnalysisResult> {
  // Implementation
}
```

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow code style guidelines
   - Add tests if applicable
   - Update documentation

4. **Build and test**
   ```bash
   npm run build
   npm run dev
   # Test your changes
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Common Tasks

### Adding a Configuration Option

1. Add to `src/types/index.ts`:
```typescript
export interface Config {
  // ... existing fields
  yourNewOption?: string;
}
```

2. Add to `src/config/index.ts` in `loadConfig()`:
```typescript
yourNewOption: process.env.YOUR_NEW_OPTION,
```

3. Update `.env.example`

### Adding a New AI Model

1. Install SDK: `npm install new-ai-sdk`
2. Add API key to config
3. Create skill using new model
4. Update documentation

## Debugging

### Enable Debug Logging

```typescript
// Add to your skill
console.log('[YourSkill] Debug info:', data);
```

### Common Issues

**TypeScript Errors**
```bash
npm run build
# Fix errors shown in output
```

**Runtime Errors**
- Check API keys are configured
- Verify input parameters
- Check server logs

**Rate Limiting**
- Adjust limits in `src/index.ts`
- Use caching for repeated requests

## Resources

- [Anthropic API Docs](https://docs.anthropic.com/)
- [Express Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Questions?

- Open an issue on GitHub
- Check existing issues for solutions
- Review the code examples in this guide

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
