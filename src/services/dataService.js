// src/services/dataService.js
import { config } from '../config/config.js';

class DataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

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

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Attempt ${i + 1} failed for ${url}:`, error.message);
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Get token price from Jupiter
  async getTokenPrice(tokenMint) {
    const cacheKey = `price_${tokenMint}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = `${config.jupiter.baseUrl}/price?ids=${tokenMint}`;
      const data = await this.fetchWithRetry(url);
      const price = data.data?.[tokenMint]?.price || 0;
      this.setCache(cacheKey, price);
      return price;
    } catch (error) {
      console.error('Error fetching token price:', error);
      return 0;
    }
  }

  // Get SOL price
  async getSolPrice() {
    return this.getTokenPrice(config.tokens.SOL);
  }

  // Get market data from Jupiter
  async getMarketData() {
    try {
      const [solPrice, usdcPrice] = await Promise.all([
        this.getSolPrice(),
        this.getTokenPrice(config.tokens.USDC),
      ]);

      return {
        solPrice,
        usdcPrice,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      return null;
    }
  }

  // Get quote from Jupiter
  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    try {
      const url = `${config.jupiter.baseUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
      return await this.fetchWithRetry(url);
    } catch (error) {
      console.error('Error getting quote:', error);
      return null;
    }
  }

  // Get swap transaction from Jupiter
  async getSwapTransaction(quoteResponse, userPublicKey) {
    try {
      const url = `${config.jupiter.baseUrl}/swap`;
      const data = await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });
      return data;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      return null;
    }
  }

  // Token list
  async getTokenList() {
    const cacheKey = 'token_list';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = 'https://token.jup.ag/strict';
      const data = await this.fetchWithRetry(url);
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching token list:', error);
      return [];
    }
  }

  // Token info
  async getTokenInfo(tokenMint) {
    try {
      const tokens = await this.getTokenList();
      return tokens.find(t => t.address === tokenMint);
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }
}

export const dataService = new DataService();
export default dataService;
