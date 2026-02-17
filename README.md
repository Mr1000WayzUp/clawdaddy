# 🦞 ClawDaddy - AI Assistant for Small Business

ClawDaddy is a comprehensive AI-powered assistant built with OpenClaw framework, designed to help small businesses automate marketing, content creation, research, and more.

## Features

### Core Skills
- **Marketing** - Generate marketing strategies and campaigns
- **Content Creation** - Create blog posts, social media content, and emails
- **Research** - Conduct market research and analysis
- **Browser Automation** - Automate web tasks (configurable)
- **Social Media** - Post and manage social media content
- **Competitor Monitoring** - Track and analyze competitors
- **Lead Management** - Qualify and manage sales leads

### Dashboard
- 📊 Web-based dashboard for easy management
- 🔑 API key configuration interface
- 📝 Review and manage outputs
- ⚡ Trigger workflows with natural language
- 🎯 Execute specific skills with custom parameters

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Anthropic API key (for Claude AI)
- Optional: OpenAI API key, Twitter API credentials

### Installation

**Option 1: Quick Start Script (Recommended)**
```bash
git clone https://github.com/Mr1000WayzUp/clawdaddy.git
cd clawdaddy
./start.sh
```

**Option 2: Manual Setup**

1. Clone the repository:
```bash
git clone https://github.com/Mr1000WayzUp/clawdaddy.git
cd clawdaddy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:3000`

## Usage

### Starting the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Build and run production:
```bash
npm run build
npm start
```

### Using the Dashboard

1. **Configure API Keys** - Go to the Configuration tab and add your API keys
2. **Execute Workflows** - Use natural language to describe what you want
3. **Use Specific Skills** - Select a skill and provide JSON parameters
4. **Review Outputs** - Check the Outputs tab for all execution history

### API Examples

Execute a workflow:
```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{"request": "Create a marketing strategy for a new product launch"}'
```

Execute a specific skill:
```bash
curl -X POST http://localhost:3000/api/skills/content-creation \
  -H "Content-Type: application/json" \
  -d '{"type": "blog post", "topic": "AI trends in 2026", "tone": "professional"}'
```

List available skills:
```bash
curl http://localhost:3000/api/skills
```

## Skills Reference

### Marketing Skill
```json
{
  "task": "Create a social media campaign",
  "context": "Launching a new SaaS product"
}
```

### Content Creation Skill
```json
{
  "type": "blog post",
  "topic": "AI in business",
  "tone": "professional",
  "length": "1000 words"
}
```

### Research Skill
```json
{
  "query": "Market trends in AI assistants",
  "depth": "detailed"
}
```

### Lead Management Skill
```json
{
  "action": "qualify",
  "lead": {
    "name": "John Doe",
    "company": "Example Corp",
    "email": "john@example.com",
    "context": "Interested in AI automation"
  }
}
```

### Competitor Monitoring Skill
```json
{
  "competitor": "CompanyName",
  "aspects": ["pricing", "marketing", "features"],
  "urls": ["https://competitor.com"]
}
```

### Social Media Skill
```json
{
  "platform": "twitter",
  "content": "Excited to announce our new feature!",
  "scheduledTime": "2026-02-20T10:00:00Z"
}
```

## Architecture

```
clawdaddy/
├── src/
│   ├── agents/          # OpenClaw agent orchestration
│   ├── skills/          # Individual skill implementations
│   ├── routes/          # Express API routes
│   ├── config/          # Configuration management
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main server entry point
├── public/              # Web dashboard
│   ├── css/            # Styles
│   ├── js/             # Frontend JavaScript
│   └── index.html      # Dashboard HTML
└── data/               # Persistent data (config, outputs)
```

## Configuration

### Environment Variables

Create a `.env` file with:

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
TWITTER_API_KEY=your_key_here
PORT=3000
NODE_ENV=development
```

### Runtime Configuration

Configuration can also be updated via:
- Dashboard Configuration tab
- API endpoint: `POST /api/config/api-keys`

## Development

### Building
```bash
npm run build
```

### Project Structure
- `src/skills/` - Add new skills by extending `BaseSkill`
- `src/agents/` - Agent orchestration logic
- `src/routes/` - API endpoints
- `public/` - Frontend dashboard

### Adding a New Skill

1. Create a new file in `src/skills/your-skill.ts`
2. Extend `BaseSkill` class
3. Implement `execute()` method
4. Add to `src/skills/index.ts`
5. Register in `src/agents/openclaw.ts`

## API Reference

### Endpoints

- `GET /api/health` - Health check
- `GET /api/config` - Get configuration status
- `POST /api/config/api-keys` - Update API keys
- `GET /api/skills` - List available skills
- `POST /api/skills/:skillName` - Execute a specific skill
- `GET /api/workflows` - Get workflow outputs
- `POST /api/workflows/execute` - Execute orchestrated workflow

## License

MIT License - see [LICENSE](LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.
