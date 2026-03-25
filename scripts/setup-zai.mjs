#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create z-ai-config file for SDK
const config = {
  baseUrl: process.env.Z_AI_BASE_URL || 'https://api.z-ai.chat/v1',
  apiKey: process.env.Z_AI_API_KEY || 'Z.ai'
};

const configPaths = [
  path.join(process.cwd(), '.z-ai-config'),
  path.join(os.homedir(), '.z-ai-config'),
];

for (const configPath of configPaths) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('[Setup] Z-AI config created at:', configPath);
    break;
  } catch (e) {
    console.log('[Setup] Could not write to:', configPath);
  }
}
