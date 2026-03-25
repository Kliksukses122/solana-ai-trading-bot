/**
 * Manager Agent - Bot Orchestrator with Learning Integration
 * 
 * Responsibilities:
 * - Coordinate all agents
 * - Run main trading loop
 * - Integrate learning engine
 * - Monitor bot health
 */

import { eventBus, EventTypes } from '../core/eventBus.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import learningEngine from '../core/learningEngine.js';
import performanceTracker from '../core/performanceTracker.js';
import positionManager from '../core/positionManager.js';
import strategyEngine from '../core/strategyEngine.js';
import adaptiveConfig from '../core/adaptiveConfig.js';

import scoutAgent from './scoutAgent.js';
import analystAgent from './analystAgent.js';
import riskAgent from './riskAgent.js';
import traderAgent from './traderAgent.js';
import memoryAgent from './memoryAgent.js';

class ManagerAgent {
  constructor() {
    this.name = 'Manager';
    this.isRunning = false;
    this.loopInterval = null;
    this.loopIntervalMs = 5000;

    this.agents = {
      scout: scoutAgent,
      analyst: analystAgent,
      risk: riskAgent,
      trader: traderAgent,
      memory: memoryAgent,
      learning: learningEngine,
    };

    this.stats = {
      loopsCompleted: 0,
      tradesExecuted: 0,
      errors: 0,
      startTime: null,
    };
  }

  /**
   * Initialize all agents
   */
  async initialize() {
    logger.agent(this.name, '🚀 Initializing Solana AI Trading Bot...');
    logger.agent(this.name, 'Mode: ' + (config.bot.mockMode ? 'MOCK' : 'LIVE'));
    logger.agent(this.name, 'Strategies: SNIPER | WHALE | MOMENTUM | COMBO');
    logger.agent(this.name, 'Learning: ' + (config.learning.enabled ? 'ENABLED' : 'DISABLED'));

    // Initialize all agents
    await scoutAgent.initialize();
    await analystAgent.initialize();
    await riskAgent.initialize();
    await traderAgent.initialize();
    await memoryAgent.initialize();
    await learningEngine.initialize();

    // Setup event listeners
    this.setupEventListeners();

    logger.agent(this.name, '✅ All agents initialized');
    return this;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Track trades for learning
    eventBus.subscribe(EventTypes.TRADER_POSITION_CLOSED, (event) => {
      this.handleTradeComplete(event.data);
    });

    // Error handling
    eventBus.subscribe(EventTypes.SYSTEM_ERROR, (event) => {
      this.handleError(event.data);
    });

    // Emergency stop
    eventBus.subscribe(EventTypes.RISK_EMERGENCY_STOP, (event) => {
      this.handleEmergencyStop(event.data);
    });
  }

  /**
   * Start the bot
   */
  start() {
    if (this.isRunning) {
      logger.agent(this.name, 'Bot already running');
      return;
    }

    this.isRunning = true;
    this.stats.startTime = Date.now();

    logger.agent(this.name, '🟢 Starting trading bot...');

    // Start scout agent
    scoutAgent.start();

    // Start main loop
    this.loopInterval = setInterval(() => {
      this.runLoop();
    }, this.loopIntervalMs);

    // Emit start event
    eventBus.emitEvent(EventTypes.SYSTEM_START, {
      timestamp: Date.now(),
      config: config.getConfigSummary(),
    });

    logger.agent(this.name, '✅ Trading bot started');
  }

  /**
   * Stop the bot
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    logger.agent(this.name, '🛑 Stopping trading bot...');

    // Stop scout
    scoutAgent.stop();

    // Clear interval
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    // Emit stop event
    eventBus.emitEvent(EventTypes.SYSTEM_STOP, {
      timestamp: Date.now(),
      stats: this.stats,
    });

    logger.agent(this.name, '✅ Trading bot stopped');
  }

  /**
   * Main trading loop
   */
  async runLoop() {
    try {
      this.stats.loopsCompleted++;

      // Health check
      if (this.stats.loopsCompleted % 12 === 0) { // Every minute
        this.runHealthCheck();
      }

      // Check if learning should run
      if (performanceTracker.shouldAdapt()) {
        learningEngine.runLearning();
      }

      // Log status periodically
      if (this.stats.loopsCompleted % 60 === 0) { // Every 5 minutes
        this.logStatus();
      }
    } catch (error) {
      this.stats.errors++;
      logger.error(`[Manager] Loop error: ${error.message}`);
    }
  }

  /**
   * Handle completed trade
   */
  handleTradeComplete(tradeData) {
    this.stats.tradesExecuted++;

    // Record in performance tracker (learning engine will handle this)
    const result = tradeData.pnl >= 0 ? 'WIN' : 'LOSS';

    logger.agent(this.name, `📊 Trade complete: ${result}`, {
      token: tradeData.tokenMint?.slice(0, 8) + '...',
      strategy: tradeData.strategy,
      pnl: tradeData.pnl?.toFixed(6),
      pnlPercent: (tradeData.pnlPercent * 100)?.toFixed(2) + '%',
    });

    // Store in memory
    memoryAgent.storeTrade(tradeData);
  }

  /**
   * Handle error
   */
  handleError(errorData) {
    this.stats.errors++;
    logger.error(`[Manager] System error:`, errorData);
  }

  /**
   * Handle emergency stop
   */
  handleEmergencyStop(data) {
    logger.agent(this.name, '🚨 EMERGENCY STOP TRIGGERED', data);
    this.stop();
  }

  /**
   * Run health check
   */
  runHealthCheck() {
    const health = {
      timestamp: Date.now(),
      isRunning: this.isRunning,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      positions: positionManager.getPositionCount(),
      dailyTrades: riskAgent.state.dailyTrades,
      dailyPnL: riskAgent.state.dailyPnL,
      winRate: performanceTracker.stats.winRate,
      learningCycles: learningEngine.state.learningCount,
    };

    eventBus.emitEvent(EventTypes.SYSTEM_HEALTH_CHECK, health);

    // Check for issues
    if (health.winRate < 0.3 && performanceTracker.stats.totalTrades > 20) {
      logger.warn('[Manager] ⚠️ Low win rate detected');
    }

    return health;
  }

  /**
   * Log current status
   */
  logStatus() {
    const summary = learningEngine.getSummary();
    const positions = positionManager.getPositionCount();
    const dailyTrades = riskAgent.state.dailyTrades;

    logger.agent(this.name, '📈 Status', {
      positions,
      dailyTrades,
      winRate: summary.winRate,
      totalTrades: summary.totalTrades,
      learningCycles: summary.learningCount,
      bestStrategy: summary.bestStrategy,
    });
  }

  /**
   * Force learning cycle
   */
  forceLearn() {
    return learningEngine.forceLearn();
  }

  /**
   * Enable/disable strategy
   */
  setStrategy(strategy, enabled) {
    strategyEngine.setStrategyEnabled(strategy, enabled);
    logger.agent(this.name, `Strategy ${strategy} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get full status
   */
  getStatus() {
    return {
      name: this.name,
      isRunning: this.isRunning,
      stats: this.stats,
      agents: {
        scout: scoutAgent.getStatus(),
        analyst: analystAgent.getStatus(),
        risk: riskAgent.getStatus(),
        trader: traderAgent.getStatus(),
        memory: memoryAgent.getStatus(),
      },
      performance: performanceTracker.getAllStats(),
      learning: learningEngine.getStatus(),
      positions: positionManager.getStatus(),
      adaptiveConfig: adaptiveConfig.getStatus(),
    };
  }

  /**
   * Get summary for dashboard
   */
  getSummary() {
    return {
      isRunning: this.isRunning,
      mode: config.bot.mockMode ? 'MOCK' : 'LIVE',
      stats: {
        balance: 10.5, // Would get from wallet in real impl
        totalPnL: performanceTracker.stats.totalProfit - performanceTracker.stats.totalLoss,
        totalTrades: performanceTracker.stats.totalTrades,
        winRate: performanceTracker.stats.winRate,
        currentDrawdown: performanceTracker.stats.currentDrawdown,
      },
      strategies: performanceTracker.strategyStats,
      learning: learningEngine.getSummary(),
      adaptiveConfig: adaptiveConfig.getConfig(),
      recentTrades: performanceTracker.getRecentTrades(20),
    };
  }

  /**
   * Reset everything
   */
  reset() {
    performanceTracker.reset();
    positionManager.reset();
    learningEngine.reset();
    adaptiveConfig.reset();
    riskAgent.resetDailyStats();

    this.stats = {
      loopsCompleted: 0,
      tradesExecuted: 0,
      errors: 0,
      startTime: null,
    };

    logger.agent(this.name, '🔄 Bot reset complete');
  }
}

const managerAgent = new ManagerAgent();
export { ManagerAgent, managerAgent };
export default managerAgent;
