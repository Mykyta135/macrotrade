import { Router, Request, Response } from 'express';
import { loadPlaybook } from '../playbook/loader';

const router = Router();

router.get('/playbook', async (req: Request, res: Response) => {
  try {
    const playbookDir = '/Users/admin/Documents/macrotrade/ai-reporter/playbook';
    const { content, fileNames } = await loadPlaybook(playbookDir);

    res.json({
      files: fileNames,
      totalChars: content.length,
      loaded: fileNames.length > 0,
    });
  } catch (error) {
    console.error('Error loading playbook:', error);
    res.status(500).json({
      error: 'Failed to load playbook',
      message: (error as any).message,
    });
  }
});

export default router;
