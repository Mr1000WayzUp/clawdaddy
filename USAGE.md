# Usage Examples

This document provides practical examples of how to use ClawDaddy AI Assistant.

## Starting the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

The server will start at http://localhost:3000

## Using the Dashboard

### 1. Configure API Keys

First, navigate to the **Configuration** tab and add your API keys:
- Anthropic API Key (required for most skills)
- OpenAI API Key (optional)
- Twitter API Key (optional)

### 2. Execute Workflows

Go to the **Workflows** tab and enter a natural language request:

**Example requests:**
- "Create a marketing strategy for launching a new AI-powered CRM product"
- "Research the top 5 competitors in the project management software space"
- "Generate a blog post about the benefits of AI in small business automation"
- "Analyze our competitor XYZ Corp and their recent marketing campaigns"
- "Create social media posts for our product launch next week"

The OpenClaw agent will automatically:
1. Understand your request
2. Select the appropriate skill
3. Execute the task
4. Return the results

### 3. Use Specific Skills

Go to the **Skills** tab to execute a specific skill with custom parameters.

## API Usage Examples

### Execute a Workflow (Orchestrated)

```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "request": "Create a marketing strategy for a new product launch"
  }'
```

### Marketing Skill

```bash
curl -X POST http://localhost:3000/api/skills/marketing \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a social media campaign for a SaaS product",
    "context": "Target audience: small business owners, Budget: $5000/month"
  }'
```

### Content Creation Skill

```bash
# Blog post
curl -X POST http://localhost:3000/api/skills/content-creation \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blog post",
    "topic": "AI trends in 2026",
    "tone": "professional",
    "length": "1000 words"
  }'

# Email
curl -X POST http://localhost:3000/api/skills/content-creation \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "topic": "product launch announcement",
    "tone": "friendly",
    "length": "short"
  }'

# Social media post
curl -X POST http://localhost:3000/api/skills/content-creation \
  -H "Content-Type: application/json" \
  -d '{
    "type": "social media post",
    "topic": "new feature release",
    "tone": "exciting"
  }'
```

### Research Skill

```bash
# Basic research
curl -X POST http://localhost:3000/api/skills/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Current trends in AI automation for small businesses",
    "depth": "basic"
  }'

# Detailed research
curl -X POST http://localhost:3000/api/skills/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Market analysis for project management tools",
    "depth": "detailed"
  }'
```

### Competitor Monitoring Skill

```bash
curl -X POST http://localhost:3000/api/skills/competitor-monitoring \
  -H "Content-Type: application/json" \
  -d '{
    "competitor": "Acme Corp",
    "aspects": ["pricing", "marketing", "features", "customer reviews"],
    "urls": ["https://acmecorp.com"]
  }'
```

### Lead Management Skill

```bash
# Add a lead
curl -X POST http://localhost:3000/api/skills/lead-management \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "lead": {
      "name": "John Doe",
      "company": "Example Corp",
      "email": "john@example.com",
      "phone": "+1-555-0123",
      "context": "Interested in our enterprise plan"
    }
  }'

# Qualify a lead
curl -X POST http://localhost:3000/api/skills/lead-management \
  -H "Content-Type: application/json" \
  -d '{
    "action": "qualify",
    "lead": {
      "name": "Jane Smith",
      "company": "Tech Startup Inc",
      "email": "jane@techstartup.com",
      "context": "CEO looking for AI automation, budget $50k"
    }
  }'

# List all leads
curl -X POST http://localhost:3000/api/skills/lead-management \
  -H "Content-Type: application/json" \
  -d '{
    "action": "list"
  }'
```

### Social Media Skill

```bash
curl -X POST http://localhost:3000/api/skills/social-media \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "content": "Excited to announce our new AI-powered features! 🚀 #AI #Innovation",
    "scheduledTime": "2026-02-20T10:00:00Z"
  }'
```

### Browser Automation Skill

```bash
curl -X POST http://localhost:3000/api/skills/browser-automation \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Monitor competitor pricing page",
    "url": "https://competitor.com/pricing",
    "actions": ["screenshot", "extract_pricing"]
  }'
```

## Configuration Management

### Get Configuration Status

```bash
curl http://localhost:3000/api/config
```

Response:
```json
{
  "port": 3000,
  "nodeEnv": "development",
  "hasAnthropicKey": true,
  "hasOpenAiKey": false,
  "hasTwitterKey": false
}
```

### Update API Key

```bash
curl -X POST http://localhost:3000/api/config/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "service": "anthropic",
    "apiKey": "sk-ant-your-api-key"
  }'
```

### List Available Skills

```bash
curl http://localhost:3000/api/skills
```

### Get Workflow Outputs

```bash
curl http://localhost:3000/api/workflows
```

## Integration Examples

### Node.js/JavaScript

```javascript
const axios = require('axios');

async function executeWorkflow(request) {
  try {
    const response = await axios.post('http://localhost:3000/api/workflows/execute', {
      request: request
    });
    
    console.log('Result:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example usage
executeWorkflow('Create a marketing plan for our new product');
```

### Python

```python
import requests
import json

def execute_workflow(request):
    url = 'http://localhost:3000/api/workflows/execute'
    payload = {'request': request}
    headers = {'Content-Type': 'application/json'}
    
    response = requests.post(url, data=json.dumps(payload), headers=headers)
    return response.json()

# Example usage
result = execute_workflow('Generate content for social media about AI')
print(json.dumps(result, indent=2))
```

### cURL Script

```bash
#!/bin/bash

# Daily marketing automation
echo "Generating daily content..."

# Morning: Research trends
curl -X POST http://localhost:3000/api/skills/research \
  -H "Content-Type: application/json" \
  -d '{"query": "AI industry trends today", "depth": "basic"}' \
  > /tmp/trends.json

# Afternoon: Create content
curl -X POST http://localhost:3000/api/skills/content-creation \
  -H "Content-Type: application/json" \
  -d '{"type": "blog post", "topic": "AI automation", "tone": "professional"}' \
  > /tmp/blog.json

# Evening: Monitor competitors
curl -X POST http://localhost:3000/api/skills/competitor-monitoring \
  -H "Content-Type: application/json" \
  -d '{"competitor": "CompetitorX", "aspects": ["pricing", "features"]}' \
  > /tmp/competitor.json

echo "Daily automation complete!"
```

## Common Use Cases

### 1. Product Launch Campaign

```bash
# Step 1: Research the market
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{"request": "Research the market for AI automation tools for small businesses"}'

# Step 2: Create marketing strategy
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{"request": "Create a comprehensive marketing strategy for launching an AI assistant product"}'

# Step 3: Generate content
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{"request": "Create blog posts, social media content, and email campaigns for our product launch"}'
```

### 2. Competitive Intelligence

```bash
# Monitor multiple competitors
for competitor in "CompanyA" "CompanyB" "CompanyC"; do
  curl -X POST http://localhost:3000/api/skills/competitor-monitoring \
    -H "Content-Type: application/json" \
    -d "{\"competitor\": \"$competitor\", \"aspects\": [\"pricing\", \"features\", \"marketing\"]}"
done
```

### 3. Lead Qualification Pipeline

```bash
# Qualify and analyze leads
curl -X POST http://localhost:3000/api/skills/lead-management \
  -H "Content-Type: application/json" \
  -d '{
    "action": "qualify",
    "lead": {
      "name": "Enterprise Customer",
      "company": "Big Corp",
      "context": "Looking for enterprise AI solution, 500+ employees"
    }
  }'
```

## Environment Variables

Create a `.env` file for configuration:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Optional
OPENAI_API_KEY=sk-your-openai-key
TWITTER_API_KEY=your-twitter-key
TWITTER_API_SECRET=your-twitter-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-secret

# Server
PORT=3000
NODE_ENV=production
```

## Troubleshooting

### API Key Not Configured
If you get "API key not configured" errors:
1. Go to the Configuration tab in the dashboard
2. Add your Anthropic API key
3. Or set `ANTHROPIC_API_KEY` in your `.env` file

### Rate Limiting
If you're being rate-limited (HTTP 429):
- Default limit: 100 requests per 15 minutes per IP
- Wait for the time window to reset
- Or increase limits in `src/index.ts`

### Server Not Starting
- Check if port 3000 is available
- Set a different PORT in `.env`
- Check for TypeScript compilation errors with `npm run build`
