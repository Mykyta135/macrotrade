import fs from 'fs/promises';
import path from 'path';

export async function loadPlaybook(playbookDir: string): Promise<{
  content: string;
  fileNames: string[];
}> {
  try {
    const files = await fs.readdir(playbookDir);
    const ruleFiles = files.filter((f) => f.endsWith('.md') || f.endsWith('.txt'));

    if (ruleFiles.length === 0) {
      return {
        content: '(No playbook rules loaded yet. Drop .md or .txt files in the /playbook directory.)',
        fileNames: [],
      };
    }

    const contents: string[] = [];
    for (const file of ruleFiles) {
      const filePath = path.join(playbookDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      contents.push(`=== RULE FILE: ${file} ===\n${fileContent}`);
    }

    return {
      content: contents.join('\n\n'),
      fileNames: ruleFiles,
    };
  } catch (error) {
    console.warn('Failed to load playbook:', (error as any).message);
    return {
      content: '(Playbook directory not accessible)',
      fileNames: [],
    };
  }
}
