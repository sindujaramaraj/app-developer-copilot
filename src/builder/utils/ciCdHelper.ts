import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export function setupCiCdPipeline(projectDir: string) {
  const ciCdConfig = `
name: CI/CD Pipeline

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '14'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Build project
        run: npm run build

      - name: Deploy
        run: npm run deploy
  `;

  const ciCdDir = path.join(projectDir, '.github', 'workflows');
  if (!fs.existsSync(ciCdDir)) {
    fs.mkdirSync(ciCdDir, { recursive: true });
  }

  const ciCdFile = path.join(ciCdDir, 'ci-cd-pipeline.yml');
  fs.writeFileSync(ciCdFile, ciCdConfig);

  console.log('CI/CD pipeline setup completed.');
}

export function runCiCdPipeline(projectDir: string) {
  const ciCdCommand = 'gh workflow run ci-cd-pipeline.yml';
  child_process.execSync(ciCdCommand, { cwd: projectDir, stdio: 'inherit' });
  console.log('CI/CD pipeline executed.');
}
