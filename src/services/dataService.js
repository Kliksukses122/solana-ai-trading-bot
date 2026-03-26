/**
 * Data Service - Real-time token data fetching
 * Fetches prices, volume, liquidity from multiple sources
 */

import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class DataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds
    this.priceHistory = new Map();
    this.maxPriceHistory = 1000;

    // API endpoints
    this.endpoints = {
      jupiter: 'https://quote-api.jup.ag/v6',
      birdeye: 'https://public-api.birdeye.so/defi',
      coingecko: 'https://api.coingecko.com/api/v3',
      dexscreener: 'https://api.dexscreener.com/latest',
      solscan: 'https://api.solscan.io',
    };
  }

  // Generic fetch with retry
  async fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await this.delay(1000 * (i + 1));
      }
    }
  }

  // Cache management
