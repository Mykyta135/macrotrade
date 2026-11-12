import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config';
import { reporter } from './reporter';
import reportRoute from './routes/report.route';
import healthRoute from './routes/health.route';
import playbookRoute from './routes/playbook.route';

const app = express();

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));
app.use(express.json());

// Static files (standalone dashboard)
app.use(express.static('public'));

// API routes
app.use('/api', reportRoute);
app.use('/api', healthRoute);
app.use('/api', playbookRoute);

// Root endpoint for health check
app.get('/', (req, res) => {
  res.send('AI Reporter is running. Visit http://localhost:3002 for dashboard.');
});

// Schedule cron job for periodic report generation
cron.schedule(config.cronSchedule, async () => {
  try {
    console.log(`[CRON] Generating report on schedule: ${config.cronSchedule}`);
    await reporter.generateReport(true);
    console.log('[CRON] Report generated successfully');
  } catch (error) {
    console.error('[CRON] Failed to generate report:', error);
  }
});

// Warmup: generate initial report on startup
if (config.warmupOnStart) {
  setTimeout(async () => {
    try {
      console.log('[WARMUP] Checking for cached report...');
      const report = await reporter.generateReport(false);
      console.log(`[WARMUP] Report generated: ${report.reportId}`);
    } catch (error) {
      console.warn('[WARMUP] Failed to generate initial report:', error);
    }
  }, 3000);
}

app.listen(config.port, () => {
  console.log(`AI Reporter listening on http://localhost:${config.port}`);
  console.log(`Cron schedule: ${config.cronSchedule}`);
  console.log(`Backend URL: ${config.backendUrl}`);
});
