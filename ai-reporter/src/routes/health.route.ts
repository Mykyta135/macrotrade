import { Router, Request, Response } from 'express';
import { reporter } from '../reporter';

const router = Router();
const startTime = Date.now();

router.get('/health', (req: Request, res: Response) => {
  const lastReport = reporter.getLastReport();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: 'ok',
    uptime,
    lastReportAt: lastReport?.generatedAt || null,
    lastReportId: lastReport?.reportId || null,
  });
});

export default router;
