/**
 * Learning Engine - Auto-Learning System
 * 
 * Loop: Trade → Result → Evaluate → Adjust → Improve
 * Learning Interval: Every 20 trades
 */

import { eventBus, EventTypes } from './eventBus.js';
import logger from '../utils/logger.js';
import adaptiveConfig from './adaptiveConfig.js';
import performanceTracker from './performanceTracker.js';

class LearningEngine {
  constructor() {
    this.name = 'LearningEngine';

    this.config = {
      learningInterval: 20,
      minTradesForLearning: 10,
      poorWinRateThreshold: 0.35,
      lowWinRateThreshold: 0.45,
      goodWinRateThreshold: 0.55,
      excellentWinRateThreshold: 0.65,
      highDrawdownThreshold: 0.15,
      moderateDrawdownThreshold: 0.10,
    };

    this.state = {
      lastLearningTime: null,
      lastLearningTrades: 0,
      learningCount: 0,
    };

    this.metrics = {
      totalAdaptations: 0,
      conservativeAdaptations: 0,
      aggressiveAdaptations: 0,
    };

    this.learningHistory = [];
  }

  /**
   * Initialize
   */
  async initialize() {
    logger.agent(this.name, 'Initializing Auto-Learning System...');
    this.setupEventListeners();
    logger.agent(this.name, '✅ Learning Engine ready', {
      learningInterval: this.config.learningInterval,
    });
    return this;
  }

  setupEventListeners() {
    eventBus.subscribe(EventTypes.TRADER_POSITION_CLOSED, (event) => {
      this.processTradeResult(event.data);
    });
  }

  /**
   * Process trade result
   */
  processTradeResult(tradeData) {
    // Record trade
    performanceTracker.recordTrade({
      tokenMint: tradeData.tokenMint,
      strategy: tradeData.strategy,
      decision: tradeData.decision,
      signals: this.extractSignals(tradeData),
      entryPrice: tradeData.entryPrice,
      exitPrice: tradeData.exitPrice,
      profit: tradeData.pnl,
      profitPercent: tradeData.pnlPercent,
      duration: tradeData.holdTime,
      score: tradeData.score,
    });

    // Check if should learn
    if (this.shouldRunLearning()) {
      this.runLearning();
    }
  }

  shouldRunLearning() {
    const totalTrades = performanceTracker.stats.totalTrades;
    if (totalTrades < this.config.minTradesForLearning) return false;
    
    const tradesSinceLastLearning = totalTrades - this.state.lastLearningTrades;
    return tradesSinceLastLearning >= this.config.learningInterval;
  }

  /**
   * Main Learning Function
   */
  runLearning() {
    const analysis = performanceTracker.analyzePerformance(20);
    logger.agent(this.name, '🧠 Running Learning Cycle...', {
      trades: analysis.recentTrades,
      winRate: (analysis.winRate * 100).toFixed(1) + '%',
      avgProfit: analysis.avgProfit.toFixed(4),
    });

    const adaptations = [];

    // 1. Win Rate Adaptation
    const winRateAdaptations = this.adaptByWinRate(analysis.winRate);
    adaptations.push(...winRateAdaptations);

    // 2. Drawdown Adaptation
    const drawdown = performanceTracker.stats.currentDrawdown;
    const drawdownAdaptations = this.adaptByDrawdown(drawdown);
    adaptations.push(...drawdownAdaptations);

    // 3. Average Profit Adaptation
    const profitAdaptations = this.adaptByAvgProfit(analysis.avgProfit);
    adaptations.push(...profitAdaptations);

    // 4. Strategy Performance Adaptation
    const strategyAdaptations = this.adaptByStrategyPerformance();
    adaptations.push(...strategyAdaptations);

    // 5. Signal Performance Adaptation
    const signalAdaptations = this.adaptBySignalPerformance();
    adaptations.push(...signalAdaptations);

    // Update state
    this.state.lastLearningTime = Date.now();
    this.state.lastLearningTrades = performanceTracker.stats.totalTrades;
    this.state.learningCount++;
    this.metrics.totalAdaptations += adaptations.length;

    // Record in history
    const record = {
      timestamp: Date.now(),
      analysis,
      adaptations,
      newConfig: adaptiveConfig.getConfig(),
    };
    this.learningHistory.push(record);
    if (this.learningHistory.length > 50) this.learningHistory.shift();

    logger.success('✅ Learning Cycle Complete', {
      adaptations: adaptations.length,
      newMinScore: adaptiveConfig.get('minScore'),
      newTradeSize: (adaptiveConfig.get('tradeSize') * 100).toFixed(1) + '%',
    });

    // Emit event
    eventBus.emitEvent(EventTypes.LEARNING_CONFIG_ADAPTED, record);

    return record;
  }

  adaptByWinRate(winRate) {
    const adaptations = [];
    const changes = adaptiveConfig.adaptByWinRate(winRate);

    if (changes.length > 0) {
      adaptations.push({ type: 'WIN_RATE', winRate, changes });
      this.metrics.conservativeAdaptations++;
    }

    return adaptations;
  }

  adaptByDrawdown(drawdown) {
    const adaptations = [];
    const changes = adaptiveConfig.adaptByDrawdown(drawdown);

    if (changes.length > 0) {
      adaptations.push({ type: 'DRAWDOWN', drawdown, changes });
    }

    return adaptations;
  }

  adaptByAvgProfit(avgProfit) {
    const adaptations = [];
    const changes = adaptiveConfig.adaptByAvgProfit(avgProfit);

    if (changes.length > 0) {
      adaptations.push({ type: 'AVG_PROFIT', avgProfit, changes });
    }

    return adaptations;
  }

  adaptByStrategyPerformance() {
    const adaptations = [];
    const changes = adaptiveConfig.adaptStrategyBias(performanceTracker.strategyStats);

    if (changes.length > 0) {
      adaptations.push({ type: 'STRATEGY', changes });
    }

    return adaptations;
  }

  adaptBySignalPerformance() {
    const adaptations = [];
    const signalPerf = performanceTracker.getSignalPerformance();
    const changes = adaptiveConfig.adaptWeights(signalPerf);

    if (changes.length > 0) {
      adaptations.push({ type: 'SIGNAL', changes });
    }

    return adaptations;
  }

  extractSignals(tradeData) {
    const signals = [];
    if (tradeData.strategy === 'SNIPER' || tradeData.strategy === 'COMBO') signals.push('early');
    if (tradeData.strategy === 'WHALE' || tradeData.strategy === 'COMBO') signals.push('whale');
    if (tradeData.strategy === 'MOMENTUM') signals.push('momentum');
    if (tradeData.strategy === 'COMBO') signals.push('combo');
    return signals;
  }

  /**
   * Get best strategy recommendation
   */
  getBestStrategy(minTrades = 10) {
    return performanceTracker.getBestStrategy(minTrades);
  }

  /**
   * Force learning
   */
  forceLearn() {
    logger.agent(this.name, '🔧 Force learning triggered');
    return this.runLearning();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      metrics: this.metrics,
      performance: performanceTracker.getAllStats(),
      adaptiveConfig: adaptiveConfig.getStatus(),
    };
  }

  /**
   * Get summary
   */
  getSummary() {
    const stats = performanceTracker.stats;
    return {
      totalTrades: stats.totalTrades,
      winRate: (stats.winRate * 100).toFixed(1) + '%',
      maxDrawdown: (stats.maxDrawdown * 100).toFixed(1) + '%',
      bestStrategy: this.getBestStrategy() || 'N/A',
      learningCount: this.state.learningCount,
      currentConfig: {
        minScore: adaptiveConfig.get('minScore'),
        tradeSize: (adaptiveConfig.get('tradeSize') * 100).toFixed(1) + '%',
        takeProfit: (adaptiveConfig.get('takeProfit') * 100).toFixed(0) + '%',
        stopLoss: (adaptiveConfig.get('stopLoss') * 100).toFixed(0) + '%',
      },
    };
  }

  reset() {
    this.state = { lastLearningTime: null, lastLearningTrades: 0, learningCount: 0 };
    this.metrics = { totalAdaptations: 0, conservativeAdaptations: 0, aggressiveAdaptations: 0 };
    performanceTracker.reset();
    adaptiveConfig.reset();
    logger.agent(this.name, '🔄 Learning engine reset');
  }
}

const learningEngine = new LearningEngine();
export { LearningEngine, learningEngine };
export default learningEngine;
