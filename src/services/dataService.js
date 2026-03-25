/**
 * Data Service - Real-time token data fetching
 * Fetches prices, volume, liquidity from multiple sources
 */

import axios from 'axios';
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

    // Create axios instance
    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Generic fetch with retry
  async fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await this.httpClient.get(url, options);
        return response.data;
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await this.delay(1000 * (i + 1));
      }
    }
  }

  // Cache management
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

  // Get SOL price
  async getSolPrice() {
    const cacheKey = 'sol_price';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchWithRetry(
        `${this.endpoints.coingecko}/simple/price?ids=solana&vs_currencies=usd`
      );
      const price = data.solana.usd;
      this.setCache(cacheKey, price);
      return price;
    } catch (error) {
      logger.warn('Failed to fetch SOL price from CoinGecko', { error: error.message });
      // Fallback to Jupiter
      return 150; // Default fallback
    }
  }

  // Get token price from Jupiter
  async getTokenPrice(tokenMint) {
    const cacheKey = `price_${tokenMint}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Use Jupiter price API
      const data = await this.fetchWithRetry(
        `${this.endpoints.jupiter}/price?ids=${tokenMint}`
      );

      const price = data.data?.[tokenMint]?.price || 0;

      // Store in price history
      this.addPriceHistory(tokenMint, price);

      this.setCache(cacheKey, price);
      return price;
    } catch (error) {
      logger.error('Failed to fetch token price', { tokenMint, error: error.message });
      return 0;
    }
  }

  // Get multiple token prices
  async getMultipleTokenPrices(tokenMints) {
    const cacheKey = `prices_${tokenMints.join(',')}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchWithRetry(
        `${this.endpoints.jupiter}/price?ids=${tokenMints.join(',')}`
      );

      const prices = {};
      for (const mint of tokenMints) {
        if (data.data?.[mint]) {
          prices[mint] = {
            price: data.data[mint].price,
            extraInfo: data.data[mint].extraInfo,
          };
          this.addPriceHistory(mint, data.data[mint].price);
        }
      }

      this.setCache(cacheKey, prices);
      return prices;
    } catch (error) {
      logger.error('Failed to fetch multiple prices', { error: error.message });
      return {};
    }
  }

  // Add to price history
  addPriceHistory(tokenMint, price) {
    if (!this.priceHistory.has(tokenMint)) {
      this.priceHistory.set(tokenMint, []);
    }

    const history = this.priceHistory.get(tokenMint);
    history.push({ price, timestamp: Date.now() });

    if (history.length > this.maxPriceHistory) {
      history.shift();
    }
  }

  // Get price history
  getPriceHistory(tokenMint, limit = 100) {
    const history = this.priceHistory.get(tokenMint) || [];
    return history.slice(-limit);
  }

  // Get token info from DexScreener
  async getTokenInfo(tokenMint) {
    const cacheKey = `token_info_${tokenMint}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchWithRetry(
        `${this.endpoints.dexscreener}/dex/tokens/${tokenMint}`
      );

      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0]; // Get most liquid pair
        const info = {
          address: tokenMint,
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown Token',
          price: parseFloat(pair.priceUsd) || 0,
          priceNative: parseFloat(pair.priceNative) || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume24h: pair.volume?.h24 || 0,
          volume6h: pair.volume?.h6 || 0,
          volume1h: pair.volume?.h1 || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          priceChange6h: pair.priceChange?.h6 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          fdv: pair.fdv || 0,
          marketCap: pair.marketCap || 0,
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          chainId: pair.chainId,
          createdAt: pair.pairCreatedAt,
        };

        this.setCache(cacheKey, info);
        return info;
      }

      return null;
    } catch (error) {
      logger.error('Failed to fetch token info', { tokenMint, error: error.message });
      return null;
    }
  }

  // Get token market data
  async getTokenMarketData(tokenMint) {
    const cacheKey = `market_${tokenMint}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Combine data from multiple sources
      const [tokenInfo, priceHistory] = await Promise.all([
        this.getTokenInfo(tokenMint),
        Promise.resolve(this.getPriceHistory(tokenMint, 50)),
      ]);

      const marketData = {
        ...tokenInfo,
        priceHistory,
        lastUpdate: Date.now(),
      };

      this.setCache(cacheKey, marketData);
      return marketData;
    } catch (error) {
      logger.error('Failed to fetch market data', { error: error.message });
      return null;
    }
  }

  // Scan for new tokens
  async scanNewTokens() {
    try {
      const data = await this.fetchWithRetry(
        `${this.endpoints.dexscreener}/dex/profiles/solana`
      );

      if (data.data) {
        return data.data.map(token => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          createdAt: token.createdAt,
        }));
      }

      return [];
    } catch (error) {
      logger.error('Failed to scan new tokens', { error: error.message });
      return [];
    }
  }

  // Get trending tokens
  async getTrendingTokens() {
    try {
      const data = await this.fetchWithRetry(
        `${this.endpoints.dexscreener}/dex/tokens/trending`
      );

      return data.tokens || [];
    } catch (error) {
      logger.error('Failed to fetch trending tokens', { error: error.message });
      return [];
    }
  }

  // Search tokens
  async searchTokens(query) {
    try {
      const data = await this.fetchWithRetry(
        `${this.endpoints.dexscreener}/dex/search?q=${encodeURIComponent(query)}`
      );

      return (data.pairs || []).map(pair => ({
        address: pair.baseToken?.address,
        symbol: pair.baseToken?.symbol,
        name: pair.baseToken?.name,
        price: parseFloat(pair.priceUsd) || 0,
        liquidity: pair.liquidity?.usd || 0,
      }));
    } catch (error) {
      logger.error('Failed to search tokens', { error: error.message });
      return [];
    }
  }

  // Helper delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
const dataService = new DataService();

export { DataService, dataService };
export default dataService;
