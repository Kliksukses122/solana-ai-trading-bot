/**
 * Risk Agent - Risk Management
 * 
 * Responsibilities:
 * - Check risk parameters
 * - Approve/reject trades
 * - Monitor exposure
 * - Emergency stop
 */

import { eventBus, EventTypes } from '../core/eventBus.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import positionManager from '../core/positionManager.js';

class RiskAgent {
  constructor() {
    this.name = 'Risk';
    
    this.limits = {
      maxDailyLoss: config.risk.maxDailyLossPercent / 100, // 5%
      maxDailyTrades: config.risk.maxDailyTrades, // 15
      maxConsecutiveLosses: config.risk.maxConsecutiveLosses, // 3
      maxPositionSize: 0.03, // 3% of portfolio
      maxOpenPositions: config.trading.maxOpenTrades, // 5
      minLiquidity: config.trading.minLiquidityUsd, // $5000
      minVolume: config.trading.minVolume24h, // $2000
    };

    this.state = {
      dailyPnL: 0,
      dailyTrades: 0,
      consecutiveLosses: 0,
      lastTradeTime: 0,
      emergencyStop: false,
      emergencyStopReason: null,
    };

    this.blacklist = new Set(config.risk.blacklistTokens || []);
    this.whitelist = new Set(config.risk.whitelistTokens || []);
  }

  /**
   * Initialize agent
   */
  async initialize() {
    logger.agent(this.name, 'Initializing Risk Agent...');

    // Subscribe to events
    eventBus.subscribe(EventTypes.ANALYST_SIGNAL_GENERATED, (event) => {
      this.evaluateRisk(event.data);
    });

    eventBus.subscribe(EventTypes.TRADER_POSITION_CLOSED, (event) => {
      this.updateRiskState(event.data);
    });

    // Reset daily stats at midnight
    this.scheduleDailyReset();

    logger.agent(this.name, '✅ Risk Agent initialized');
    return this;
  }

  /**
   * Evaluate risk for trade
   */
  evaluateRisk(signalData) {
    const { tokenMint, tokenSymbol, evaluation, marketData } = signalData;

    const checks = [];
    let approved = true;
    let reason = null;
    let adjustedSize = evaluation?.decision?.positionSize || 0.01;

    // 1. Emergency stop check
    if (this.state.emergencyStop) {
      checks.push({ check: 'EMERGENCY_STOP', passed: false, reason: this.state.emergencyStopReason });
      approved = false;
      reason = 'Emergency stop active';
    }

    // 2. Blacklist check
    if (this.blacklist.has(tokenMint)) {
      checks.push({ check: 'BLACKLIST', passed: false, reason: 'Token is blacklisted' });
      approved = false;
      reason = 'Token blacklisted';
    }

    // 3. Daily trade limit
    if (this.state.dailyTrades >= this.limits.maxDailyTrades) {
      checks.push({ check: 'DAILY_TRADE_LIMIT', passed: false, current: this.state.dailyTrades, max: this.limits.maxDailyTrades });
      approved = false;
      reason = 'Daily trade limit reached';
    }

    // 4. Daily loss limit
    if (this.state.dailyPnL <= -this.limits.maxDailyLoss) {
      checks.push({ check: 'DAILY_LOSS_LIMIT', passed: false, current: this.state.dailyPnL.toFixed(4), max: this.limits.maxDailyLoss });
      approved = false;
      reason = 'Daily loss limit reached';
    }

    // 5. Consecutive losses
    if (this.state.consecutiveLosses >= this.limits.maxConsecutiveLosses) {
      checks.push({ check: 'CONSECUTIVE_LOSSES', passed: false, current: this.state.consecutiveLosses, max: this.limits.maxConsecutiveLosses });
      approved = false;
      reason = 'Too many consecutive losses';
    }

    // 6. Max positions
    const openPositions = positionManager.getPositionCount();
    if (openPositions >= this.limits.maxOpenPositions) {
      checks.push({ check: 'MAX_POSITIONS', passed: false, current: openPositions, max: this.limits.maxOpenPositions });
      approved = false;
      reason = 'Max positions reached';
    }

    // 7. Liquidity check
    if (marketData?.liquidityUsd && marketData.liquidityUsd < this.limits.minLiquidity) {
      checks.push({ check: 'LIQUIDITY', passed: false, current: marketData.liquidityUsd, min: this.limits.minLiquidity });
      approved = false;
      reason = 'Insufficient liquidity';
    }

    // 8. Volume check
    if (marketData?.volume24h && marketData.volume24h < this.limits.minVolume) {
      checks.push({ check: 'VOLUME', passed: false, current: marketData.volume24h, min: this.limits.minVolume });
      approved = false;
      reason = 'Insufficient volume';
    }

    // 9. Position size adjustment based on risk
    if (approved) {
      adjustedSize = this.adjustPositionSize(adjustedSize, evaluation, marketData);
      checks.push({ check: 'POSITION_SIZE', passed: true, size: adjustedSize });
    }

    const riskDecision = {
      tokenMint,
      tokenSymbol,
      approved,
      reason,
      checks,
      adjustedSize,
      riskLevel: this.calculateRiskLevel(checks),
      timestamp: Date.now(),
    };

    if (approved) {
      logger.agent(this.name, `✅ Approved: ${tokenSymbol}`, {
        size: (adjustedSize * 100).toFixed(2) + '%',
        riskLevel: riskDecision.riskLevel,
      });
      eventBus.emitEvent(EventTypes.RISK_APPROVED, riskDecision);
    } else {
      logger.agent(this.name, `❌ Rejected: ${tokenSymbol}`, { reason });
      eventBus.emitEvent(EventTypes.RISK_REJECTED, riskDecision);
    }

    return riskDecision;
  }

  /**
   * Adjust position size based on risk factors
   */
  adjustPositionSize(baseSize, evaluation, marketData) {
    let size = baseSize;

    // Reduce for low liquidity
    if (marketData?.liquidityUsd && marketData.liquidityUsd < 20000) {
      size *= 0.7;
    }

    // Reduce for high volatility
    if (marketData?.priceChange5m && Math.abs(marketData.priceChange5m) > 10) {
      size *= 0.8;
    }

    // Reduce for low RSI (potential dump)
    if (marketData?.rsi && marketData.rsi > 70) {
      size *= 0.6;
    }

    // Reduce after consecutive losses
    if (this.state.consecutiveLosses > 0) {
      size *= Math.pow(0.8, this.state.consecutiveLosses);
    }

    // Cap at max
    size = Math.min(size, this.limits.maxPositionSize);

    return size;
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(checks) {
    const failedChecks = checks.filter(c => !c.passed).length;
    if (failedChecks === 0) return 'LOW';
    if (failedChecks <= 2) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Update risk state after trade
   */
  updateRiskState(tradeData) {
    this.state.dailyTrades++;
    this.state.dailyPnL += tradeData.pnl || 0;
    this.state.lastTradeTime = Date.now();

    if (tradeData.pnl < 0) {
      this.state.consecutiveLosses++;
    } else {
      this.state.consecutiveLosses = 0;
    }

    // Check for emergency stop conditions
    if (this.state.dailyPnL <= -this.limits.maxDailyLoss) {
      this.triggerEmergencyStop('Daily loss limit reached');
    }

    if (this.state.consecutiveLosses >= this.limits.maxConsecutiveLosses) {
      // Cooldown instead of full stop
      eventBus.emitEvent(EventTypes.RISK_WARNING, {
        type: 'CONSECUTIVE_LOSSES',
        count: this.state.consecutiveLosses,
        message: 'Taking cooldown due to consecutive losses',
      });
    }

    logger.agent(this.name, 'Risk state updated', {
      dailyTrades: this.state.dailyTrades,
      dailyPnL: this.state.dailyPnL.toFixed(4),
      consecutiveLosses: this.state.consecutiveLosses,
    });
  }

  /**
   * Trigger emergency stop
   */
  triggerEmergencyStop(reason) {
    this.state.emergencyStop = true;
    this.state.emergencyStopReason = reason;

    logger.error(`[RISK] 🚨 EMERGENCY STOP: ${reason}`);

    eventBus.emitEvent(EventTypes.RISK_EMERGENCY_STOP, {
      reason,
      timestamp: Date.now(),
      dailyPnL: this.state.dailyPnL,
      dailyTrades: this.state.dailyTrades,
    });

    // Close all positions
    positionManager.closeAllPositions(null, 'EMERGENCY_STOP');
  }

  /**
   * Clear emergency stop
   */
  clearEmergencyStop() {
    this.state.emergencyStop = false;
    this.state.emergencyStopReason = null;
    logger.agent(this.name, 'Emergency stop cleared');
  }

  /**
   * Schedule daily reset
   */
  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow - now;

    setTimeout(() => {
      this.resetDailyStats();
      this.scheduleDailyReset();
    }, msUntilMidnight);
  }

  /**
   * Reset daily stats
   */
  resetDailyStats() {
    this.state.dailyPnL = 0;
    this.state.dailyTrades = 0;
    this.state.consecutiveLosses = 0;

    // Clear emergency stop at new day
    this.state.emergencyStop = false;
    this.state.emergencyStopReason = null;

    logger.agent(this.name, '🔄 Daily stats reset');
  }

  /**
   * Add to blacklist
   */
  addToBlacklist(tokenMint, reason = '') {
    this.blacklist.add(tokenMint);
    logger.agent(this.name, `Added to blacklist: ${tokenMint.slice(0, 8)}...`, { reason });
  }

  /**
   * Add to whitelist
   */
  addToWhitelist(tokenMint) {
    this.whitelist.add(tokenMint);
    logger.agent(this.name, `Added to whitelist: ${tokenMint.slice(0, 8)}...`);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      limits: this.limits,
      blacklistSize: this.blacklist.size,
      whitelistSize: this.whitelist.size,
    };
  }
}

const riskAgent = new RiskAgent();
export { RiskAgent, riskAgent };
export default riskAgent;
