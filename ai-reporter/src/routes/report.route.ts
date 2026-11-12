import { Router, Request, Response } from 'express';
import { reporter } from '../reporter';

const router = Router();

router.get('/report', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const report = await reporter.generateReport(forceRefresh);
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: (error as any).message,
    });
  }
});

router.post('/report', async (req: Request, res: Response) => {
  try {
    const report = await reporter.generateReport(true);
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      error: 'Failed to generate report',
      message: (error as any).message,
    });
  }
});

export default router;
