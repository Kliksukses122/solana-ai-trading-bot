/**
 * Scout Agent - Market Scanner & Signal Detector
 * 
 * Responsibilities:
 * - Scan for new tokens
 * - Detect whale movements
 * - Monitor volume spikes
 * - Track price changes
 */

import { eventBus, EventTypes } from '../core/eventBus.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class ScoutAgent {
  constructor() {
    this.name = 'Scout';
    this.isRunning = false;
    this.scanInterval = null;
    this.scanIntervalMs = config.trading.scanIntervalMs || 3000;

    this.trackedTokens = new Map();
    this.whaleWallets = new Set(config.whaleTracking.trackedWallets || []);
    this.knownTokens = new Set();

    this.stats = {
      tokensScanned: 0,
      signalsDetected: 0,
      whaleMovements: 0,
      volumeSpikes: 0,
    };
  }

  /**
   * Initialize agent
   */
  async initialize() {
    logger.agent(this.name, 'Initializing Scout Agent...');
    
    // Subscribe to events
    eventBus.subscribe(EventTypes.SYSTEM_START, () => this.start());
    eventBus.subscribe(EventTypes.SYSTEM_STOP, () => this.stop());

    // Load known tokens
    for (const mint of config.tokenLists.memeTokens) {
      this.knownTokens.add(mint);
    }

    logger.agent(this.name, '✅ Scout Agent initialized');
    return this;
  }

  /**
   * Start scanning
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.agent(this.name, '🔍 Starting market scan...');

    // Start scanning loop
    this.scanInterval = setInterval(() => {
      this.scan();
    }, this.scanIntervalMs);

    // Initial scan
    this.scan();
  }

  /**
   * Stop scanning
   */
  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    logger.agent(this.name, '🛑 Scanner stopped');
  }

  /**
   * Main scan function
   */
  async scan() {
    try {
      // Scan for new tokens
      await this.scanNewTokens();

      // Check tracked tokens for updates
      await this.checkTrackedTokens();

      // Look for whale activity
      await this.detectWhaleActivity();

      this.stats.tokensScanned++;
    } catch (error) {
      logger.error(`[${this.name}] Scan error:`, error.message);
    }
  }

  /**
   * Scan for new token listings
   */
  async scanNewTokens() {
    // In real implementation, this would connect to:
    // - Jupiter API for new pairs
    // - Raydium/Pump.fun for new listings
    // - DEX Screener for new tokens

    // Simulate finding new token (for demo)
    if (Math.random() < 0.05) { // 5% chance
      const newToken = this.simulateNewToken();
      await this.processNewToken(newToken);
    }
  }

  /**
   * Process new token
   */
  async processNewToken(tokenData) {
    const { mint, symbol, name, liquidity, volume } = tokenData;

    logger.agent(this.name, `🆕 New token detected: ${symbol}`, {
      mint: mint.slice(0, 8) + '...',
      liquidity: '$' + liquidity,
    });

    // Add to tracked tokens
    this.trackedTokens.set(mint, {
      ...tokenData,
      addedAt: Date.now(),
      lastUpdate: Date.now(),
    });

    // Emit event
    eventBus.emitEvent(EventTypes.SCOUT_NEW_TOKEN, {
      tokenMint: mint,
      tokenSymbol: symbol,
      tokenName: name,
      liquidity,
      volume,
      timestamp: Date.now(),
    });

    this.stats.signalsDetected++;
  }

  /**
   * Check tracked tokens for updates
   */
  async checkTrackedTokens() {
    for (const [mint, data] of this.trackedTokens) {
      // Check for volume spike
      const volumeChange = await this.checkVolumeChange(mint, data);
      if (volumeChange && volumeChange.percent > 50) {
        eventBus.emitEvent(EventTypes.SCOUT_VOLUME_SPIKE, {
          tokenMint: mint,
          tokenSymbol: data.symbol,
          volumeChange: volumeChange.percent,
          newVolume: volumeChange.newVolume,
          timestamp: Date.now(),
        });

        this.stats.volumeSpikes++;
      }

      // Check for price update
      const priceData = await this.checkPriceUpdate(mint, data);
      if (priceData) {
        eventBus.emitEvent(EventTypes.SCOUT_PRICE_UPDATE, {
          tokenMint: mint,
          tokenSymbol: data.symbol,
          price: priceData.price,
          change24h: priceData.change24h,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Detect whale activity
   */
  async detectWhaleActivity() {
    // In real implementation, this would:
    // - Monitor Helius websocket for large transactions
    // - Track known whale wallets
    // - Parse transaction logs

    // Simulate whale activity (for demo)
    if (Math.random() < 0.02) { // 2% chance
      const activity = this.simulateWhaleActivity();
      
      logger.agent(this.name, `🐋 Whale activity: ${activity.type}`, {
        token: activity.tokenSymbol,
        amount: '$' + activity.amount,
      });

      eventBus.emitEvent(EventTypes.SCOUT_WHALE_ACTIVITY, {
        tokenMint: activity.tokenMint,
        tokenSymbol: activity.tokenSymbol,
        type: activity.type, // 'BUY' or 'SELL'
        amount: activity.amount,
        wallet: activity.wallet,
        timestamp: Date.now(),
      });

      this.stats.whaleMovements++;
    }
  }

  /**
   * Simulate new token (for demo)
   */
  simulateNewToken() {
    const symbols = ['PEPE2', 'DOGE3000', 'MOONSHOT', 'LAMBO', 'GIGA', 'BASED', 'WOJAK', 'CHAD'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)] + Math.floor(Math.random() * 1000);
    
    return {
      mint: Math.random().toString(36).substr(2, 44),
      symbol,
      name: `${symbol} Token`,
      liquidity: Math.floor(Math.random() * 50000) + 5000,
      volume: Math.floor(Math.random() * 100000) + 10000,
      price: Math.random() * 0.0001,
      marketCap: Math.floor(Math.random() * 100000) + 10000,
      createdAt: Date.now(),
    };
  }

  /**
   * Simulate whale activity (for demo)
   */
  simulateWhaleActivity() {
    const tokens = Array.from(this.trackedTokens.values());
    if (tokens.length === 0) {
      const knownTokens = ['WIF', 'BONK', 'POPCAT', 'MYRO'];
      const symbol = knownTokens[Math.floor(Math.random() * knownTokens.length)];
      return {
        tokenMint: Math.random().toString(36).substr(2, 44),
        tokenSymbol: symbol,
        type: Math.random() > 0.3 ? 'BUY' : 'SELL',
        amount: Math.floor(Math.random() * 50000) + 10000,
        wallet: Math.random().toString(36).substr(2, 44),
      };
    }

    const token = tokens[Math.floor(Math.random() * tokens.length)];
    return {
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      type: Math.random() > 0.3 ? 'BUY' : 'SELL',
      amount: Math.floor(Math.random() * 50000) + 10000,
      wallet: Math.random().toString(36).substr(2, 44),
    };
  }

  /**
   * Check volume change
   */
  async checkVolumeChange(mint, data) {
    // Simulate volume check
    const change = (Math.random() - 0.3) * 100;
    if (Math.abs(change) > 30) {
      return {
        percent: change,
        newVolume: data.volume * (1 + change / 100),
      };
    }
    return null;
  }

  /**
   * Check price update
   */
  async checkPriceUpdate(mint, data) {
    // Simulate price update
    const change = (Math.random() - 0.5) * 20;
    return {
      price: data.price * (1 + change / 100),
      change24h: change,
    };
  }

  /**
   * Track token manually
   */
  trackToken(tokenData) {
    this.trackedTokens.set(tokenData.mint, {
      ...tokenData,
      addedAt: Date.now(),
      lastUpdate: Date.now(),
    });
    logger.agent(this.name, `Now tracking: ${tokenData.symbol}`);
  }

  /**
   * Untrack token
   */
  untrackToken(mint) {
    this.trackedTokens.delete(mint);
    logger.agent(this.name, `Stopped tracking: ${mint.slice(0, 8)}...`);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      isRunning: this.isRunning,
      trackedTokens: this.trackedTokens.size,
      stats: this.stats,
    };
  }
}

const scoutAgent = new ScoutAgent();
export { ScoutAgent, scoutAgent };
export default scoutAgent;
