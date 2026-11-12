const fs = require('fs');
const path = require('path');

const ignoreList = [
  'node_modules',
  '.git',
  '.vscode',
  'dist',
  'build',
  '.env',
  'fetch_all_text.js',
  '.DS_Store',
  'Thumbs.db',
  '.env',
  'package-lock.json',
  'yarn.lock',
  'fetch-all-text.js',
  'all_code.txt',
  'all_code.md',
  'README.md',
  'LICENSE',
  '.github',
  '.idea',
  '.eslintcache',
  '.nyc_output',
  '.turbo',
  '.next',
  'coverage',
  'logs',
  'tmp',
  'temp',
  'out',
  'public',
  'static',
  'scripts',
  'tests',
  'test',
  '__tests__',
  '__mocks__',
  '.babelrc',
  '.eslintrc',
  '.prettierrc',
  '.stylelintrc',
  '.commitlintrc',
  '.lintstagedrc',
  '.dockerignore',
  'Dockerfile',
  'Makefile',
  'webpack.config.js',
  'rollup.config.js',
  'vite.config.js',
  'jest.config.js',
  'tsconfig.json',
  'yarn-error.log',
  'pnpm-lock.yaml',
  '.parcelrc',
  '.swcrc',
  '.watchmanconfig',
  '.flowconfig',
  '.prettierignore',
  '.stylelintignore',
  '.eslintignore',
  '.gitignore',
  '.npmignore',
  '.nvmrc',
  '.yarnrc',
  '.yarnrc.yml',
  '.ncurc.json',
  '.husky',
  '.vscodeignore',
  '.vscode',
  '.idea',
  '.DS_Store',
  'Thumbs.db',
];

function getAllFilePaths(dirPath) {
  let filePaths = [];
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    if (ignoreList.includes(file)) {
      continue;
    }

    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      filePaths = filePaths.concat(getAllFilePaths(filePath));
    } else {
      filePaths.push(filePath);
    }
  }

  return filePaths;
}

function concatenateFiles(filePaths) {
  let combinedContent = '';

  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      combinedContent += `// File: ${filePath}\n\n${content}\n\n---\n\n`;
    } catch (error) {
      console.warn(`Could not read file: ${filePath}. Skipping.`);
    }
  }

  return combinedContent;
}

function main() {
  const projectRoot = '.';
  const outputFile = 'all_code.txt';

  try {
    console.log('Starting to read files...');
    const allFiles = getAllFilePaths(projectRoot);
    console.log(`Found ${allFiles.length} files to include.`);

    const combinedCode = concatenateFiles(allFiles);

    if (combinedCode.length === 0) {
      console.log(
        'No files found to combine. The output file will not be created.',
      );
      return;
    }

    fs.writeFileSync(outputFile, combinedCode);
    console.log(`Successfully created ${outputFile}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();
