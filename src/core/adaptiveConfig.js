/**
 * Adaptive Config - Dynamic Parameters That Learn
 */

import logger from '../utils/logger.js';

class AdaptiveConfig {
  constructor() {
    this.name = 'AdaptiveConfig';

    this.config = {
      minScore: 6,
      takeProfit: 0.08,
      stopLoss: 0.02,
      tradeSize: 0.01,

      weights: {
        whale: 5,
        early: 3,
        momentum: 2,
        volume: 2,
        liquidity: 2,
        combo: 3,
      },

      strategyBias: {
        SNIPER: 1.0,
        WHALE: 1.0,
        MOMENTUM: 1.0,
        COMBO: 1.0,
      },
    };

    this.limits = {
      minScore: { min: 4, max: 10 },
      takeProfit: { min: 0.03, max: 0.20 },
      stopLoss: { min: 0.01, max: 0.05 },
      tradeSize: { min: 0.005, max: 0.03 },
      weight: { min: 1, max: 10 },
      bias: { min: 0.5, max: 2.0 },
    };

    this.adaptationHistory = [];
    this.snapshots = [];
  }

  adaptByWinRate(winRate) {
    const changes = [];
    if (winRate < 0.35) {
      this.config.minScore = this.clamp(this.config.minScore + 1, 'minScore');
      changes.push('minScore +1');
      this.config.tradeSize = this.clamp(this.config.tradeSize * 0.8, 'tradeSize');
      changes.push('tradeSize -20%');
    } else if (winRate < 0.45) {
      this.config.minScore = this.clamp(this.config.minScore + 0.5, 'minScore');
      changes.push('minScore +0.5');
    } else if (winRate > 0.55) {
      this.config.minScore = this.clamp(this.config.minScore - 0.5, 'minScore');
      changes.push('minScore -0.5');
      this.config.tradeSize = this.clamp(this.config.tradeSize * 1.1, 'tradeSize');
      changes.push('tradeSize +10%');
    } else if (winRate > 0.65) {
      this.config.minScore = this.clamp(this.config.minScore - 1, 'minScore');
      changes.push('minScore -1');
      this.config.tradeSize = this.clamp(this.config.tradeSize * 1.2, 'tradeSize');
      changes.push('tradeSize +20%');
      this.config.takeProfit = this.clamp(this.config.takeProfit + 0.02, 'takeProfit');
      changes.push('takeProfit +2%');
    }
    if (changes.length > 0) this.recordAdaptation('winRate', { winRate }, changes);
    return changes;
  }

  adaptByDrawdown(drawdown) {
    const changes = [];
    if (drawdown > 0.15) {
      this.config.tradeSize = this.clamp(this.config.tradeSize * 0.5, 'tradeSize');
      changes.push('tradeSize -50%');
      this.config.minScore = this.clamp(this.config.minScore + 2, 'minScore');
      changes.push('minScore +2');
    } else if (drawdown > 0.10) {
      this.config.tradeSize = this.clamp(this.config.tradeSize * 0.7, 'tradeSize');
      changes.push('tradeSize -30%');
      this.config.minScore = this.clamp(this.config.minScore + 1, 'minScore');
      changes.push('minScore +1');
    }
    if (changes.length > 0) this.recordAdaptation('drawdown', { drawdown }, changes);
    return changes;
  }

  adaptByAvgProfit(avgProfit) {
    const changes = [];
    if (avgProfit < -0.02) {
      this.config.stopLoss = this.clamp(this.config.stopLoss * 0.8, 'stopLoss');
      changes.push('stopLoss -20%');
    } else if (avgProfit > 0.05) {
      this.config.takeProfit = this.clamp(this.config.takeProfit + 0.02, 'takeProfit');
      changes.push('takeProfit +2%');
    }
    if (changes.length > 0) this.recordAdaptation('avgProfit', { avgProfit }, changes);
    return changes;
  }

  adaptStrategyBias(strategyStats) {
    const changes = [];
    for (const [strategy, stats] of Object.entries(strategyStats)) {
      if (stats.trades < 15) continue;
      if (stats.winRate < 0.35) {
        this.config.strategyBias[strategy] = this.clamp(this.config.strategyBias[strategy] * 0.8, 'bias');
        changes.push(`${strategy} bias -20%`);
      } else if (stats.winRate > 0.55) {
        this.config.strategyBias[strategy] = this.clamp(this.config.strategyBias[strategy] * 1.1, 'bias');
        changes.push(`${strategy} bias +10%`);
      }
    }
    if (changes.length > 0) this.recordAdaptation('strategyBias', { strategyStats }, changes);
    return changes;
  }

  adaptWeights(signalPerformance) {
    const changes = [];
    for (const [signal, stats] of Object.entries(signalPerformance)) {
      if (stats.trades < 10) continue;
      const signalKey = signal.toLowerCase();
      if (!this.config.weights[signalKey]) continue;
      if (stats.winRate < 0.4) {
        this.config.weights[signalKey] = this.clamp(this.config.weights[signalKey] - 1, 'weight');
        changes.push(`weight.${signalKey} -1`);
      } else if (stats.winRate > 0.6) {
        this.config.weights[signalKey] = this.clamp(this.config.weights[signalKey] + 1, 'weight');
        changes.push(`weight.${signalKey} +1`);
      }
    }
    if (changes.length > 0) this.recordAdaptation('weights', { signalPerformance }, changes);
    return changes;
  }

  clamp(value, configKey) {
    const limit = this.limits[configKey];
    if (!limit) return value;
    return Math.max(limit.min, Math.min(limit.max, value));
  }

  recordAdaptation(type, data, changes) {
    this.adaptationHistory.push({ type, data, changes, timestamp: Date.now() });
    if (this.adaptationHistory.length > 100) this.adaptationHistory.shift();
    logger.info(`🔧 Config adapted: ${changes.join(', ')}`);
  }

  takeSnapshot(reason = 'manual') {
    this.snapshots.push({
      config: JSON.parse(JSON.stringify(this.config)),
      reason,
      timestamp: Date.now(),
    });
    if (this.snapshots.length > 10) this.snapshots.shift();
  }

  reset() {
    this.config = {
      minScore: 6,
      takeProfit: 0.08,
      stopLoss: 0.02,
      tradeSize: 0.01,
      weights: { whale: 5, early: 3, momentum: 2, volume: 2, liquidity: 2, combo: 3 },
      strategyBias: { SNIPER: 1.0, WHALE: 1.0, MOMENTUM: 1.0, COMBO: 1.0 },
    };
    this.takeSnapshot('reset');
    logger.info('🔄 Config reset to base');
  }

  get(key) { return this.config[key]; }
  getConfig() { return { ...this.config }; }
  set(key, value) { if (this.config[key] !== undefined) this.config[key] = this.clamp(value, key); }
  getStatus() { return { name: this.name, config: this.getConfig(), adaptationCount: this.adaptationHistory.length }; }
}

const adaptiveConfig = new AdaptiveConfig();
export { AdaptiveConfig, adaptiveConfig };
export default adaptiveConfig;
