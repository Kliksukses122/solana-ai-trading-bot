/**
 * Strategy Engine - Multi-Strategy Decision Engine
 * 
 * Strategies:
 * - SNIPER: Early token detection, new listings
 * - WHALE: Follow whale movements
 * - MOMENTUM: Trend following, volume spikes
 * - COMBO: Multi-signal combination
 */

import { eventBus, EventTypes } from './eventBus.js';
import logger from '../utils/logger.js';
import adaptiveConfig from './adaptiveConfig.js';

class StrategyEngine {
  constructor() {
    this.name = 'StrategyEngine';
    
    this.strategies = {
      SNIPER: {
        name: 'SNIPER',
        description: 'Early token detection',
        enabled: true,
        priority: 1,
        conditions: ['isNewToken', 'lowMarketCap', 'highInitialVolume'],
        signals: ['early'],
      },
      WHALE: {
        name: 'WHALE',
        description: 'Follow whale movements',
        enabled: true,
        priority: 2,
        conditions: ['whaleBuy', 'largeTransaction', 'walletAccumulation'],
        signals: ['whale'],
      },
      MOMENTUM: {
        name: 'MOMENTUM',
        description: 'Trend following',
        enabled: true,
        priority: 3,
        conditions: ['volumeSpike', 'priceIncrease', 'rsiOversold'],
        signals: ['momentum', 'volume'],
      },
      COMBO: {
        name: 'COMBO',
        description: 'Multi-signal combination',
        enabled: true,
        priority: 4,
        conditions: ['multipleSignals', 'strongConfirmation'],
        signals: ['combo'],
      },
    };
  }

  /**
   * Evaluate token with all strategies
   */
  evaluate(tokenData, marketData) {
    const results = {};
    const weights = adaptiveConfig.get('weights');
    const strategyBias = adaptiveConfig.config.strategyBias;
    
    let totalScore = 0;
    let matchedStrategies = [];
    let signals = [];

    // 1. SNIPER Strategy - Early token detection
    const sniperResult = this.evaluateSniper(tokenData, marketData, weights);
    if (sniperResult.triggered) {
      results.SNIPER = sniperResult;
      totalScore += sniperResult.score * strategyBias.SNIPER;
      matchedStrategies.push('SNIPER');
      signals.push(...sniperResult.signals);
    }

    // 2. WHALE Strategy - Whale tracking
    const whaleResult = this.evaluateWhale(tokenData, marketData, weights);
    if (whaleResult.triggered) {
      results.WHALE = whaleResult;
      totalScore += whaleResult.score * strategyBias.WHALE;
      matchedStrategies.push('WHALE');
      signals.push(...whaleResult.signals);
    }

    // 3. MOMENTUM Strategy - Trend following
    const momentumResult = this.evaluateMomentum(tokenData, marketData, weights);
    if (momentumResult.triggered) {
      results.MOMENTUM = momentumResult;
      totalScore += momentumResult.score * strategyBias.MOMENTUM;
      matchedStrategies.push('MOMENTUM');
      signals.push(...momentumResult.signals);
    }

    // 4. COMBO Strategy - Multi-signal combination
    if (matchedStrategies.length >= 2) {
      const comboResult = this.evaluateCombo(tokenData, marketData, weights, matchedStrategies);
      results.COMBO = comboResult;
      totalScore += comboResult.score * strategyBias.COMBO;
      matchedStrategies.push('COMBO');
      signals.push('combo');
    }

    // Determine best strategy
    const bestStrategy = this.selectBestStrategy(results, strategyBias);
    
    // Make decision
    const decision = this.makeDecision(totalScore, adaptiveConfig.get('minScore'));

    const evaluation = {
      tokenMint: tokenData.mint,
      tokenSymbol: tokenData.symbol,
      totalScore: Math.round(totalScore * 10) / 10,
      decision,
      bestStrategy,
      matchedStrategies,
      signals: [...new Set(signals)],
      strategyResults: results,
      timestamp: Date.now(),
    };

    logger.agent(this.name, `Evaluated ${tokenData.symbol}`, {
      score: evaluation.totalScore,
      decision: decision.level,
      strategies: matchedStrategies.join(','),
    });

    eventBus.emitEvent(EventTypes.ANALYST_ANALYSIS_COMPLETE, evaluation);
    return evaluation;
  }

  /**
   * SNIPER Strategy Evaluation
   */
  evaluateSniper(tokenData, marketData, weights) {
    let score = 0;
    let triggered = false;
    let signals = [];
    const reasons = [];

    // Check if new token (within threshold)
    const tokenAge = marketData.tokenAgeMinutes || 0;
    const maxAgeForSnipe = 10; // 10 minutes
    
    if (tokenAge <= maxAgeForSnipe) {
      score += weights.early;
      signals.push('early');
      reasons.push(`New token: ${tokenAge}min old`);
      triggered = true;
    }

    // Check initial liquidity
    const liquidity = marketData.liquidityUsd || 0;
    if (liquidity >= 5000 && liquidity <= 500000) {
      score += weights.liquidity;
      reasons.push(`Good liquidity: $${liquidity}`);
      triggered = true;
    }

    // Check initial volume
    const initialVolume = marketData.initialVolumeUsd || 0;
    if (initialVolume > 10000) {
      score += weights.volume;
      signals.push('volume');
      reasons.push(`High initial volume: $${initialVolume}`);
      triggered = true;
    }

    // Low market cap bonus
    const marketCap = marketData.marketCapUsd || 0;
    if (marketCap > 0 && marketCap < 100000) {
      score += 2;
      reasons.push(`Low market cap: $${marketCap}`);
    }

    return {
      strategy: 'SNIPER',
      triggered,
      score: triggered ? score : 0,
      signals,
      reasons,
    };
  }

  /**
   * WHALE Strategy Evaluation
   */
  evaluateWhale(tokenData, marketData, weights) {
    let score = 0;
    let triggered = false;
    let signals = [];
    const reasons = [];

    // Check whale buys
    const whaleBuys = marketData.whaleBuys || [];
    if (whaleBuys.length > 0) {
      const totalWhaleVolume = whaleBuys.reduce((sum, w) => sum + w.amount, 0);
      if (totalWhaleVolume >= 50) { // $50+ from whales
        score += weights.whale;
        signals.push('whale');
        reasons.push(`${whaleBuys.length} whale buys: $${totalWhaleVolume.toFixed(0)}`);
        triggered = true;
      }
    }

    // Check large transactions
    const largeTxns = marketData.largeTransactions || [];
    if (largeTxns.length >= 3) {
      score += 2;
      reasons.push(`${largeTxns.length} large transactions`);
      triggered = true;
    }

    // Check known whale wallets
    const knownWalletBuys = marketData.knownWalletBuys || [];
    if (knownWalletBuys.length > 0) {
      score += 3;
      reasons.push(`${knownWalletBuys.length} known wallet buys`);
      triggered = true;
    }

    return {
      strategy: 'WHALE',
      triggered,
      score: triggered ? score : 0,
      signals,
      reasons,
    };
  }

  /**
   * MOMENTUM Strategy Evaluation
   */
  evaluateMomentum(tokenData, marketData, weights) {
    let score = 0;
    let triggered = false;
    let signals = [];
    const reasons = [];

    // Check volume spike
    const volumeChange = marketData.volumeChangePercent || 0;
    if (volumeChange >= 50) {
      score += weights.volume;
      signals.push('volume');
      reasons.push(`Volume spike: +${volumeChange.toFixed(0)}%`);
      triggered = true;
    } else if (volumeChange >= 30) {
      score += weights.volume * 0.5;
      signals.push('volume');
      reasons.push(`Volume increase: +${volumeChange.toFixed(0)}%`);
      triggered = true;
    }

    // Check price momentum
    const priceChange5m = marketData.priceChange5m || 0;
    const priceChange1h = marketData.priceChange1h || 0;
    
    if (priceChange5m > 5 && priceChange1h > 10) {
      score += weights.momentum;
      signals.push('momentum');
      reasons.push(`Strong momentum: 5m +${priceChange5m.toFixed(1)}%, 1h +${priceChange1h.toFixed(1)}%`);
      triggered = true;
    } else if (priceChange5m > 2 && priceChange1h > 5) {
      score += weights.momentum * 0.5;
      signals.push('momentum');
      reasons.push(`Good momentum: 5m +${priceChange5m.toFixed(1)}%`);
      triggered = true;
    }

    // Check RSI
    const rsi = marketData.rsi || 50;
    if (rsi < 35) {
      score += 2;
      reasons.push(`RSI oversold: ${rsi.toFixed(1)}`);
      triggered = true;
    }

    // Check buy pressure
    const buyPressure = marketData.buyPressure || 0.5;
    if (buyPressure > 0.65) {
      score += 2;
      reasons.push(`High buy pressure: ${(buyPressure * 100).toFixed(0)}%`);
      triggered = true;
    }

    return {
      strategy: 'MOMENTUM',
      triggered,
      score: triggered ? score : 0,
      signals,
      reasons,
    };
  }

  /**
   * COMBO Strategy Evaluation
   */
  evaluateCombo(tokenData, marketData, weights, matchedStrategies) {
    let score = weights.combo;
    const reasons = [`Combo: ${matchedStrategies.join(' + ')}`];

    // Bonus for 3+ strategies
    if (matchedStrategies.length >= 3) {
      score += 2;
      reasons.push('Triple confirmation!');
    }

    return {
      strategy: 'COMBO',
      triggered: true,
      score,
      signals: ['combo'],
      reasons,
    };
  }

  /**
   * Select best strategy based on results and bias
   */
  selectBestStrategy(results, strategyBias) {
    let best = null;
    let bestScore = 0;

    for (const [strategy, result] of Object.entries(results)) {
      if (!result.triggered) continue;
      const adjustedScore = result.score * (strategyBias[strategy] || 1);
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        best = strategy;
      }
    }

    return best;
  }

  /**
   * Make trading decision based on score
   */
  makeDecision(totalScore, minScore) {
    const thresholds = {
      STRONG_BUY: { min: 8, size: 0.02 },
      BUY: { min: 6, size: 0.01 },
      SMALL_BUY: { min: 4, size: 0.005 },
      SKIP: { min: 0, size: 0 },
    };

    if (totalScore >= thresholds.STRONG_BUY.min + minScore - 6) {
      return { level: 'STRONG_BUY', positionSize: thresholds.STRONG_BUY.size, confidence: 'high' };
    } else if (totalScore >= thresholds.BUY.min + minScore - 6) {
      return { level: 'BUY', positionSize: thresholds.BUY.size, confidence: 'medium' };
    } else if (totalScore >= thresholds.SMALL_BUY.min + minScore - 6) {
      return { level: 'SMALL_BUY', positionSize: thresholds.SMALL_BUY.size, confidence: 'low' };
    }

    return { level: 'SKIP', positionSize: 0, confidence: 'none' };
  }

  /**
   * Enable/disable strategy
   */
  setStrategyEnabled(strategy, enabled) {
    if (this.strategies[strategy]) {
      this.strategies[strategy].enabled = enabled;
      logger.info(`Strategy ${strategy} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get strategy status
   */
  getStatus() {
    return {
      name: this.name,
      strategies: this.strategies,
      adaptiveWeights: adaptiveConfig.get('weights'),
      adaptiveMinScore: adaptiveConfig.get('minScore'),
    };
  }
}

const strategyEngine = new StrategyEngine();
export { StrategyEngine, strategyEngine };
export default strategyEngine;
