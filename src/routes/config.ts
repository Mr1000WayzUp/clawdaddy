import express, { Request, Response } from 'express';
import { configManager } from '../config';

const router = express.Router();

// Get current configuration (without sensitive data)
router.get('/', (req: Request, res: Response) => {
  const config = configManager.getConfig();
  res.json({
    port: config.port,
    nodeEnv: config.nodeEnv,
    hasAnthropicKey: !!config.anthropicApiKey,
    hasOpenAiKey: !!config.openaiApiKey,
    hasTwitterKey: !!config.twitterApiKey,
  });
});

// Update configuration
router.post('/', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    configManager.updateConfig(updates);
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update API keys
router.post('/api-keys', (req: Request, res: Response) => {
  try {
    const { service, apiKey } = req.body;
    
    if (!service || !apiKey) {
      return res.status(400).json({ success: false, error: 'Service and apiKey are required' });
    }

    const updates: any = {};
    switch (service) {
      case 'anthropic':
        updates.anthropicApiKey = apiKey;
        break;
      case 'openai':
        updates.openaiApiKey = apiKey;
        break;
      case 'twitter':
        updates.twitterApiKey = apiKey;
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid service' });
    }

    configManager.updateConfig(updates);
    res.json({ success: true, message: `${service} API key updated successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
