import express from 'express';
import cors from 'cors';
import path from 'path';
import { configManager } from './config';
import { configRoutes, skillsRoutes, workflowsRoutes } from './routes';

const app = express();
const config = configManager.getConfig();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/config', configRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/workflows', workflowsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ClawDaddy AI Assistant running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});

export default app;
