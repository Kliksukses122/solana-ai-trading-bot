/**
 * Analyst Agent - Token Analyzer
 * 
 * Responsibilities:
 * - Analyze token metrics
 * - Calculate scores
 * - Generate signals
 * - Assess risk indicators
 */

import { eventBus, EventTypes } from '../core/eventBus.js';
import logger from '../utils/logger.js';
import strategyEngine from '../core/strategyEngine.js';

class AnalystAgent {
  constructor() {
    this.name = 'Analyst';
    this.analysisCache = new Map();
    this.cacheExpiry = 60000; // 1 minute

    this.metrics = {
      totalAnalyzed: 0,
      signalsGenerated: 0,
      avgScore: 0,
    };
  }

  /**
   * Initialize agent
   */
  async initialize() {
    logger.agent(this.name, 'Initializing Analyst Agent...');

    // Subscribe to scout events
    eventBus.subscribe(EventTypes.SCOUT_NEW_TOKEN, (event) => {
      this.analyzeToken(event.data);
    });

    eventBus.subscribe(EventTypes.SCOUT_WHALE_ACTIVITY, (event) => {
      this.analyzeWhaleSignal(event.data);
    });

    eventBus.subscribe(EventTypes.SCOUT_VOLUME_SPIKE, (event) => {
      this.analyzeVolumeSignal(event.data);
    });

    logger.agent(this.name, '✅ Analyst Agent initialized');
    return this;
  }

  /**
   * Analyze token
   */
  async analyzeToken(tokenData) {
    const { tokenMint, tokenSymbol } = tokenData;

    // Check cache
    const cached = this.analysisCache.get(tokenMint);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.analysis;
    }

    logger.agent(this.name, `📊 Analyzing ${tokenSymbol}...`);

    try {
      // Gather market data
      const marketData = await this.gatherMarketData(tokenData);

      // Run through strategy engine
      const evaluation = strategyEngine.evaluate(tokenData, marketData);

      // Store in cache
      this.analysisCache.set(tokenMint, {
        analysis: evaluation,
        timestamp: Date.now(),
      });

      // Update metrics
      this.metrics.totalAnalyzed++;
      this.metrics.avgScore = (this.metrics.avgScore + evaluation.totalScore) / 2;

      // Emit signal if actionable
      if (evaluation.decision.level !== 'SKIP') {
        eventBus.emitEvent(EventTypes.ANALYST_SIGNAL_GENERATED, {
          tokenMint,
          tokenSymbol,
          evaluation,
          marketData,
          timestamp: Date.now(),
        });

        this.metrics.signalsGenerated++;
        logger.agent(this.name, `📈 Signal generated: ${tokenSymbol}`, {
          decision: evaluation.decision.level,
          score: evaluation.totalScore,
          strategy: evaluation.bestStrategy,
        });
      }

      return evaluation;
    } catch (error) {
      logger.error(`[${this.name}] Analysis error for ${tokenSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Analyze whale signal
   */
  async analyzeWhaleSignal(data) {
    const { tokenMint, tokenSymbol, type, amount } = data;

    logger.agent(this.name, `🐋 Analyzing whale ${type}: ${tokenSymbol}`, { amount });

    // Whale buy is strong signal
    if (type === 'BUY' && amount >= 50000) {
      const signal = {
        tokenMint,
        tokenSymbol,
        signalType: 'WHALE_BUY',
        strength: amount >= 100000 ? 'STRONG' : 'MODERATE',
        data: { amount, type },
        score: amount >= 100000 ? 8 : 6,
        timestamp: Date.now(),
      };

      eventBus.emitEvent(EventTypes.ANALYST_SIGNAL_GENERATED, signal);
      this.metrics.signalsGenerated++;
    }

    // Whale sell is warning
    if (type === 'SELL' && amount >= 30000) {
      const signal = {
        tokenMint,
        tokenSymbol,
        signalType: 'WHALE_SELL',
        strength: 'WARNING',
        data: { amount, type },
        score: -2,
        timestamp: Date.now(),
      };

      eventBus.emitEvent(EventTypes.ANALYST_SIGNAL_GENERATED, signal);
    }
  }

  /**
   * Analyze volume signal
   */
  async analyzeVolumeSignal(data) {
    const { tokenMint, tokenSymbol, volumeChange } = data;

    logger.agent(this.name, `📉 Volume spike: ${tokenSymbol}`, { change: volumeChange + '%' });

    if (volumeChange >= 100) {
      const signal = {
        tokenMint,
        tokenSymbol,
        signalType: 'VOLUME_SPIKE',
        strength: volumeChange >= 200 ? 'STRONG' : 'MODERATE',
        data: { volumeChange },
        score: volumeChange >= 200 ? 6 : 4,
        timestamp: Date.now(),
      };

      eventBus.emitEvent(EventTypes.ANALYST_SIGNAL_GENERATED, signal);
      this.metrics.signalsGenerated++;
    }
  }

  /**
   * Gather market data for token
   */
  async gatherMarketData(tokenData) {
    // In real implementation, this would fetch from:
    // - DexScreener API
    // - Birdeye API
    // - Jupiter API
    // - Helius for transaction data

    // Simulate market data
    return {
      // Price data
      currentPrice: tokenData.price || Math.random() * 0.0001,
      priceChange5m: (Math.random() - 0.4) * 10,
      priceChange1h: (Math.random() - 0.3) * 20,
      priceChange24h: (Math.random() - 0.5) * 50,

      // Volume data
      volume24h: tokenData.volume || Math.random() * 100000,
      volumeChangePercent: (Math.random() - 0.3) * 100,
      initialVolumeUsd: Math.random() * 50000,

      // Liquidity
      liquidityUsd: tokenData.liquidity || Math.random() * 100000,

      // Market metrics
      marketCapUsd: tokenData.marketCap || Math.random() * 500000,
      fdv: Math.random() * 1000000,
      tokenAgeMinutes: tokenData.createdAt ? (Date.now() - tokenData.createdAt) / 60000 : Math.random() * 60,

      // Technical indicators
      rsi: Math.random() * 100,
      buyPressure: 0.3 + Math.random() * 0.5,

      // Whale data
      whaleBuys: this.simulateWhaleBuys(),
      whaleSells: [],
      largeTransactions: this.simulateLargeTxns(),
      knownWalletBuys: [],

      // Momentum
      momentumReversal: Math.random() < 0.1,
    };
  }

  /**
   * Simulate whale buys
   */
  simulateWhaleBuys() {
    const buys = [];
    if (Math.random() < 0.3) {
      const count = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < count; i++) {
        buys.push({
          wallet: Math.random().toString(36).substr(2, 44),
          amount: Math.random() * 100000 + 10000,
          timestamp: Date.now() - Math.random() * 3600000,
        });
      }
    }
    return buys;
  }

  /**
   * Simulate large transactions
   */
  simulateLargeTxns() {
    const txns = [];
    if (Math.random() < 0.2) {
      const count = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < count; i++) {
        txns.push({
          signature: Math.random().toString(36).substr(2, 88),
          amount: Math.random() * 50000 + 5000,
          type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        });
      }
    }
    return txns;
  }

  /**
   * Quick analyze for opportunity
   */
  quickAnalyze(tokenMint, tokenSymbol, basicData) {
    return this.analyzeToken({
      tokenMint,
      tokenSymbol,
      ...basicData,
    });
  }

  /**
   * Get cached analysis
   */
  getCachedAnalysis(tokenMint) {
    const cached = this.analysisCache.get(tokenMint);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.analysis;
    }
    return null;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.analysisCache.clear();
    logger.agent(this.name, 'Cache cleared');
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      metrics: this.metrics,
      cacheSize: this.analysisCache.size,
    };
  }
}

const analystAgent = new AnalystAgent();
export { AnalystAgent, analystAgent };
export default analystAgent;
