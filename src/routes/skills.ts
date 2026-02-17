import express, { Request, Response } from 'express';
import { openClawAgent } from '../agents';

const router = express.Router();

// List all available skills
router.get('/', (req: Request, res: Response) => {
  const skills = openClawAgent.listSkills();
  res.json({ skills });
});

// Execute a specific skill
router.post('/:skillName', async (req: Request, res: Response) => {
  try {
    const skillName = req.params.skillName as string;
    const input = req.body;
    
    const result = await openClawAgent.executeSkill(skillName, input);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

export default router;
