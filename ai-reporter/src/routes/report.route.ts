import { Router, Request, Response } from 'express';
import { reporter } from '../reporter';

const router = Router();

/**
 * A forced refresh calls the paid model, so it is allowed at most once per
 * cooldown; anything more frequent gets the cached report. Error details stay
 * in the server log instead of the response.
 */
export const FORCE_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
let lastForcedAt = 0;

export function allowForcedRefresh(now = Date.now()): boolean {
  if (now - lastForcedAt < FORCE_REFRESH_COOLDOWN_MS) return false;
  lastForcedAt = now;
  return true;
}

async function respond(res: Response, wantsRefresh: boolean) {
  try {
    const force = wantsRefresh && allowForcedRefresh();
    const report = await reporter.generateReport(force);
    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
}

router.get('/report', (req: Request, res: Response) =>
  respond(res, req.query.refresh === '1'),
);

router.post('/report', (_req: Request, res: Response) => respond(res, true));

export default router;
