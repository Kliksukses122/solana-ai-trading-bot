import fs from 'fs';
import path from 'path';
import os from 'os';

// Z-AI SDK Configuration
// This ensures the config file exists before the SDK tries to load it

const ZAI_CONFIG = {
  baseUrl: process.env.Z_AI_BASE_URL || 'https://api.z-ai.chat/v1',
  apiKey: process.env.Z_AI_API_KEY || 'Z.ai'
};

export function ensureZaiConfig() {
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
  ];

  for (const configPath of configPaths) {
    try {
      fs.writeFileSync(configPath, JSON.stringify(ZAI_CONFIG, null, 2));
      console.log('[Z-AI] Config written to:', configPath);
      return;
    } catch (e) {
      // Try next path
    }
  }
}

// Auto-ensure on import
if (typeof window === 'undefined') {
  ensureZaiConfig();
}

export default ZAI_CONFIG;
