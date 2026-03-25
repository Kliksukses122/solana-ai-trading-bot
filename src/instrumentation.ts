import fs from 'fs';
import path from 'path';
import os from 'os';

// This runs when the Next.js server starts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Ensure z-ai-config exists before SDK tries to load it
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
        console.log('[Z-AI] Config initialized at:', configPath);
        break;
      } catch (e) {
        console.log('[Z-AI] Could not write to:', configPath);
      }
    }
  }
}
