/**
 * Memory Agent - Data Storage & Retrieval
 * 
 * Responsibilities:
 * - Store trade history
 * - Track token data
 * - Manage whale wallet history
 * - Cache frequently accessed data
 */

import { eventBus, EventTypes } from '../core/eventBus.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class MemoryAgent {
  constructor() {
    this.name = 'Memory';

    this.stores = {
      trades: [],
      tokens: new Map(),
      whales: new Map(),
      signals: [],
      events: [],
    };

    this.limits = {
      trades: config.memory.maxTradeHistory || 1000,
      signals: 500,
      events: 1000,
      tokens: 10000,
      whales: 100,
    };

    this.cache = new Map();
    this.cacheExpiry = 60000; // 1 minute
  }

  /**
   * Initialize agent
   */
  async initialize() {
    logger.agent(this.name, 'Initializing Memory Agent...');

    // Subscribe to all relevant events
    eventBus.subscribe(EventTypes.TRADER_POSITION_OPENED, (event) => {
      this.storePosition(event.data);
    });

    eventBus.subscribe(EventTypes.TRADER_POSITION_CLOSED, (event) => {
      this.storeTrade(event.data);
    });

    eventBus.subscribe(EventTypes.SCOUT_WHALE_ACTIVITY, (event) => {
      this.storeWhaleActivity(event.data);
    });

    eventBus.subscribe(EventTypes.ANALYST_SIGNAL_GENERATED, (event) => {
      this.storeSignal(event.data);
    });

    eventBus.subscribe('*', (event) => {
      this.storeEvent(event);
    });

    logger.agent(this.name, '✅ Memory Agent initialized');
    return this;
  }

  /**
   * Store position
   */
  storePosition(position) {
    const record = {
      ...position,
      storedAt: Date.now(),
      type: 'POSITION_OPEN',
    };

    // Update token data
    this.updateTokenData(position.tokenMint, {
      lastPosition: record,
    });

    logger.debug(`[Memory] Stored position: ${position.tokenSymbol}`);
  }

  /**
   * Store trade
   */
  storeTrade(tradeData) {
    const record = {
      ...tradeData,
      storedAt: Date.now(),
      type: 'TRADE',
    };

    this.stores.trades.unshift(record);

    // Maintain limit
    if (this.stores.trades.length > this.limits.trades) {
      this.stores.trades = this.stores.trades.slice(0, this.limits.trades);
    }

    // Update token stats
    this.updateTokenStats(tradeData.tokenMint, tradeData);

    logger.debug(`[Memory] Stored trade: ${tradeData.tokenMint?.slice(0, 8)}...`);
  }

  /**
   * Store whale activity
   */
  storeWhaleActivity(data) {
    const { wallet, tokenMint, type, amount } = data;

    if (!wallet) return;

    // Get or create whale record
    let whale = this.stores.whales.get(wallet);
    if (!whale) {
      whale = {
        wallet,
        firstSeen: Date.now(),
        totalTrades: 0,
        totalVolume: 0,
        tokens: new Set(),
        accuracy: 0,
      };
    }

    // Update whale data
    whale.totalTrades++;
    whale.totalVolume += amount || 0;
    whale.tokens.add(tokenMint);
    whale.lastActivity = Date.now();

    this.stores.whales.set(wallet, whale);

    // Maintain limit
    if (this.stores.whales.size > this.limits.whales) {
      // Remove oldest
      const oldest = [...this.stores.whales.entries()]
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity)[0];
      if (oldest) {
        this.stores.whales.delete(oldest[0]);
      }
    }
  }

  /**
   * Store signal
   */
  storeSignal(signalData) {
    const record = {
      ...signalData,
      storedAt: Date.now(),
    };

    this.stores.signals.unshift(record);

    if (this.stores.signals.length > this.limits.signals) {
      this.stores.signals = this.stores.signals.slice(0, this.limits.signals);
    }
  }

  /**
   * Store event
   */
  storeEvent(event) {
    this.stores.events.unshift({
      name: event.name,
      data: event.data,
      timestamp: event.timestamp,
    });

    if (this.stores.events.length > this.limits.events) {
      this.stores.events = this.stores.events.slice(0, this.limits.events);
    }
  }

  /**
   * Update token data
   */
  updateTokenData(tokenMint, data) {
    let token = this.stores.tokens.get(tokenMint);
    if (!token) {
      token = {
        mint: tokenMint,
        firstSeen: Date.now(),
        trades: 0,
        wins: 0,
        totalPnL: 0,
      };
    }

    Object.assign(token, data);
    this.stores.tokens.set(tokenMint, token);

    // Maintain limit
    if (this.stores.tokens.size > this.limits.tokens) {
      const oldest = [...this.stores.tokens.entries()]
        .sort((a, b) => a[1].firstSeen - b[1].firstSeen)[0];
      if (oldest) {
        this.stores.tokens.delete(oldest[0]);
      }
    }
  }

  /**
   * Update token stats after trade
   */
  updateTokenStats(tokenMint, tradeData) {
    let token = this.stores.tokens.get(tokenMint);
    if (!token) {
      token = {
        mint: tokenMint,
        firstSeen: Date.now(),
        trades: 0,
        wins: 0,
        totalPnL: 0,
      };
    }

    token.trades++;
    token.totalPnL += tradeData.pnl || 0;
    if (tradeData.pnl >= 0) token.wins++;
    token.lastTrade = Date.now();
    token.winRate = token.trades > 0 ? token.wins / token.trades : 0;

    this.stores.tokens.set(tokenMint, token);
  }

  /**
   * Get trade history
   */
  getTradeHistory(limit = 100) {
    return this.stores.trades.slice(0, limit);
  }

  /**
   * Get token data
   */
  getTokenData(tokenMint) {
    return this.stores.tokens.get(tokenMint);
  }

  /**
   * Get whale data
   */
  getWhaleData(wallet) {
    return this.stores.whales.get(wallet);
  }

  /**
   * Get top whales
   */
  getTopWhales(limit = 10) {
    return [...this.stores.whales.values()]
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);
  }

  /**
   * Get recent signals
   */
  getRecentSignals(limit = 50) {
    return this.stores.signals.slice(0, limit);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 100) {
    return this.stores.events.slice(0, limit);
  }

  /**
   * Search trades
   */
  searchTrades(query) {
    const { tokenMint, strategy, result, limit = 50 } = query;

    return this.stores.trades.filter(trade => {
      if (tokenMint && trade.tokenMint !== tokenMint) return false;
      if (strategy && trade.strategy !== strategy) return false;
      if (result === 'WIN' && trade.pnl < 0) return false;
      if (result === 'LOSS' && trade.pnl >= 0) return false;
      return true;
    }).slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const trades = this.stores.trades;
    const wins = trades.filter(t => t.pnl >= 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      totalTrades: trades.length,
      wins,
      losses: trades.length - wins,
      winRate: trades.length > 0 ? wins / trades.length : 0,
      totalPnL,
      avgPnL: trades.length > 0 ? totalPnL / trades.length : 0,
      tokensTracked: this.stores.tokens.size,
      whalesTracked: this.stores.whales.size,
    };
  }

  /**
   * Cache operations
   */
  setCache(key, value, ttl = this.cacheExpiry) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return cached.value;
  }

  /**
   * Clear all data
   */
  clear() {
    this.stores.trades = [];
    this.stores.tokens.clear();
    this.stores.whales.clear();
    this.stores.signals = [];
    this.stores.events = [];
    this.cache.clear();

    logger.agent(this.name, 'Memory cleared');
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      stores: {
        trades: this.stores.trades.length,
        tokens: this.stores.tokens.size,
        whales: this.stores.whales.size,
        signals: this.stores.signals.length,
        events: this.stores.events.length,
      },
      cache: this.cache.size,
      statistics: this.getStatistics(),
    };
  }
}

const memoryAgent = new MemoryAgent();
export { MemoryAgent, memoryAgent };
export default memoryAgent;
