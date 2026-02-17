import express, { Request, Response } from 'express';
import { openClawAgent } from '../agents';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const outputsPath = path.join(__dirname, '../../data/outputs.json');

// Get all outputs
router.get('/', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(outputsPath)) {
      const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf-8'));
      res.json({ outputs });
    } else {
      res.json({ outputs: [] });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute a workflow (orchestrated request)
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { request } = req.body;
    
    if (!request) {
      return res.status(400).json({ error: 'Request is required' });
    }

    const result = await openClawAgent.orchestrate(request);
    
    // Save output
    saveOutput(result);
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

function saveOutput(output: any) {
  try {
    let outputs = [];
    if (fs.existsSync(outputsPath)) {
      outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf-8'));
    }
    
    outputs.push(output);
    
    // Keep only last 100 outputs
    if (outputs.length > 100) {
      outputs = outputs.slice(-100);
    }
    
    const dir = path.dirname(outputsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputsPath, JSON.stringify(outputs, null, 2));
  } catch (error) {
    console.error('Error saving output:', error);
  }
}

export default router;
