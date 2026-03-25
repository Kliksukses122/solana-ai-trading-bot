/**
 * Indicator Service - Technical Analysis Indicators
 * RSI, MACD, Bollinger Bands, EMA, and more
 */

import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class IndicatorService {
  constructor() {
    this.indicatorsConfig = config.indicators;
  }

  /**
   * RSI (Relative Strength Index)
   * Measures the speed and magnitude of price changes
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
      return null;
    }

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate RSI values
    const rsiValues = [];

    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      let currentGain = 0;
      let currentLoss = 0;

      if (change > 0) {
        currentGain = change;
      } else {
        currentLoss = Math.abs(change);
      }

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      rsiValues.push(rsi);
    }

    return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
  }

  /**
   * RSI Signal
   * Returns BUY, SELL, or NEUTRAL based on RSI value
   */
  getRSISignal(rsiValue) {
    if (rsiValue === null) return 'NEUTRAL';

    if (rsiValue <= this.indicatorsConfig.rsi.oversold) {
      return 'BUY';
    } else if (rsiValue >= this.indicatorsConfig.rsi.overbought) {
      return 'SELL';
    }
    return 'NEUTRAL';
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod + signalPeriod) {
      return null;
    }

    const fastEMA = this.calculateEMAValues(prices, fastPeriod);
    const slowEMA = this.calculateEMAValues(prices, slowPeriod);

    // MACD line = Fast EMA - Slow EMA
    const macdLine = [];
    for (let i = 0; i < slowEMA.length; i++) {
      const fastIdx = fastEMA.length - slowEMA.length + i;
      macdLine.push(fastEMA[fastIdx] - slowEMA[i]);
    }

    // Signal line = EMA of MACD line
    const signalLine = this.calculateEMAValues(macdLine, signalPeriod);

    // Histogram = MACD - Signal
    const histogram = [];
    const offset = macdLine.length - signalLine.length;
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[offset + i] - signalLine[i]);
    }

    return {
      macd: macdLine[macdLine.length - 1],
      signal: signalLine[signalLine.length - 1],
      histogram: histogram[histogram.length - 1],
      trend: histogram[histogram.length - 1] > 0 ? 'BULLISH' : 'BEARISH',
    };
  }

  /**
   * MACD Signal
   */
  getMACDSignal(macdData) {
    if (!macdData) return 'NEUTRAL';

    if (macdData.histogram > 0 && macdData.macd > macdData.signal) {
      return 'BUY';
    } else if (macdData.histogram < 0 && macdData.macd < macdData.signal) {
      return 'SELL';
    }
    return 'NEUTRAL';
  }

  /**
   * EMA (Exponential Moving Average)
   */
  calculateEMA(prices, period) {
    const emaValues = this.calculateEMAValues(prices, period);
    return emaValues.length > 0 ? emaValues[emaValues.length - 1] : null;
  }

  calculateEMAValues(prices, period) {
    if (prices.length < period) return [];

    const multiplier = 2 / (period + 1);
    const emaValues = [];

    // Start with SMA for first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    emaValues.push(sum / period);

    // Calculate subsequent EMA values
    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
      emaValues.push(ema);
    }

    return emaValues;
  }

  /**
   * EMA Crossover Signal
   */
  getEMACrossover(prices, shortPeriod = 9, longPeriod = 21) {
    if (prices.length < longPeriod + 1) return null;

    const shortEMA = this.calculateEMAValues(prices, shortPeriod);
    const longEMA = this.calculateEMAValues(prices, longPeriod);

    const offset = longEMA.length - shortEMA.length;
    const currentShort = shortEMA[shortEMA.length - 1];
    const currentLong = longEMA[longEMA.length - 1];
    const prevShort = shortEMA.length > 1 ? shortEMA[shortEMA.length - 2] : currentShort;
    const prevLong = longEMA.length > 1 ? longEMA[longEMA.length - 2] : currentLong;

    // Crossover detection
    const crossover = prevShort <= prevLong && currentShort > currentLong;
    const crossunder = prevShort >= prevLong && currentShort < currentLong;

    return {
      shortEMA: currentShort,
      longEMA: currentLong,
      signal: crossover ? 'BUY' : crossunder ? 'SELL' : 'NEUTRAL',
      trend: currentShort > currentLong ? 'BULLISH' : 'BEARISH',
    };
  }

  /**
   * Bollinger Bands
   */
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;

    // Calculate SMA
    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      sum += prices[i];
    }
    const sma = sum / period;

    // Calculate standard deviation
    let squaredDiffs = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      squaredDiffs += Math.pow(prices[i] - sma, 2);
    }
    const std = Math.sqrt(squaredDiffs / period);

    const upperBand = sma + stdDev * std;
    const lowerBand = sma - stdDev * std;
    const currentPrice = prices[prices.length - 1];

    // %B indicator (position within bands)
    const percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);

    return {
      upper: upperBand,
      middle: sma,
      lower: lowerBand,
      bandwidth: (upperBand - lowerBand) / sma,
      percentB,
      signal: percentB < 0 ? 'BUY' : percentB > 1 ? 'SELL' : 'NEUTRAL',
    };
  }

  /**
   * Volume Analysis
   */
  analyzeVolume(volumes, prices = null) {
    if (volumes.length < 2) return null;

    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeRatio = currentVolume / avgVolume;

    // Volume spike detection
    const stdDev = Math.sqrt(
      volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length
    );
    const volumeSpike = currentVolume > avgVolume + 2 * stdDev;

    // Volume trend
    const recentVolumes = volumes.slice(-5);
    const olderVolumes = volumes.slice(-10, -5);
    const recentAvg = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const olderAvg = olderVolumes.length > 0
      ? olderVolumes.reduce((a, b) => a + b, 0) / olderVolumes.length
      : recentAvg;
    const volumeTrend = recentAvg > olderAvg ? 'INCREASING' : 'DECREASING';

    return {
      currentVolume,
      avgVolume,
      volumeRatio,
      volumeSpike,
      volumeTrend,
      signal: volumeSpike ? 'ALERT' : 'NORMAL',
    };
  }

  /**
   * Momentum Indicator
   */
  calculateMomentum(prices, period = 10) {
    if (prices.length < period + 1) return null;

    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - period - 1];
    const momentum = ((currentPrice - previousPrice) / previousPrice) * 100;

    // Rate of Change (ROC)
    const roc = momentum;

    // Momentum trend over multiple periods
    const momentumHistory = [];
    for (let i = period + 1; i < prices.length && momentumHistory.length < 5; i++) {
      const prev = prices[prices.length - i - period];
      const curr = prices[prices.length - i];
      if (prev > 0) {
        momentumHistory.push(((curr - prev) / prev) * 100);
      }
    }

    const momentumTrend = momentumHistory.length >= 2
      ? momentum > momentumHistory[0] ? 'ACCELERATING' : 'DECELERATING'
      : 'STABLE';

    return {
      momentum,
      roc,
      momentumTrend,
      signal: momentum > 5 ? 'BUY' : momentum < -5 ? 'SELL' : 'NEUTRAL',
    };
  }

  /**
   * Support and Resistance Levels
   */
  findSupportResistance(prices, period = 20) {
    if (prices.length < period) return null;

    const recentPrices = prices.slice(-period);
    const highs = [];
    const lows = [];

    // Find local highs and lows
    for (let i = 1; i < recentPrices.length - 1; i++) {
      if (recentPrices[i] > recentPrices[i - 1] && recentPrices[i] > recentPrices[i + 1]) {
        highs.push(recentPrices[i]);
      }
      if (recentPrices[i] < recentPrices[i - 1] && recentPrices[i] < recentPrices[i + 1]) {
        lows.push(recentPrices[i]);
      }
    }

    const currentPrice = prices[prices.length - 1];
    const resistance = highs.length > 0 ? Math.max(...highs) : currentPrice * 1.05;
    const support = lows.length > 0 ? Math.min(...lows) : currentPrice * 0.95;

    return {
      resistance,
      support,
      distanceToResistance: ((resistance - currentPrice) / currentPrice) * 100,
      distanceToSupport: ((currentPrice - support) / currentPrice) * 100,
    };
  }

  /**
   * Comprehensive Analysis
   * Combines all indicators for a complete analysis
   */
  async analyze(prices, volumes = null) {
    if (!prices || prices.length < 30) {
      return {
        valid: false,
        error: 'Insufficient price data',
      };
    }

    const startTime = Date.now();

    const analysis = {
      valid: true,
      timestamp: Date.now(),
      price: prices[prices.length - 1],
      indicators: {},
      signals: {},
      score: 0,
    };

    // RSI
    const rsi = this.calculateRSI(prices);
    analysis.indicators.rsi = rsi;
    analysis.signals.rsi = this.getRSISignal(rsi);

    // MACD
    const macd = this.calculateMACD(prices);
    analysis.indicators.macd = macd;
    analysis.signals.macd = this.getMACDSignal(macd);

    // EMA Crossover
    const ema = this.getEMACrossover(prices);
    analysis.indicators.ema = ema;
    analysis.signals.ema = ema?.signal || 'NEUTRAL';

    // Bollinger Bands
    const bb = this.calculateBollingerBands(prices);
    analysis.indicators.bollingerBands = bb;
    analysis.signals.bollingerBands = bb?.signal || 'NEUTRAL';

    // Momentum
    const momentum = this.calculateMomentum(prices);
    analysis.indicators.momentum = momentum;
    analysis.signals.momentum = momentum?.signal || 'NEUTRAL';

    // Support/Resistance
    const sr = this.findSupportResistance(prices);
    analysis.indicators.supportResistance = sr;

    // Volume Analysis (if provided)
    if (volumes && volumes.length > 0) {
      const volumeAnalysis = this.analyzeVolume(volumes, prices);
      analysis.indicators.volume = volumeAnalysis;
      analysis.signals.volume = volumeAnalysis?.signal || 'NORMAL';
    }

    // Calculate overall score
    analysis.score = this.calculateScore(analysis);

    const duration = Date.now() - startTime;
    logger.performance('indicator_analysis', duration);

    return analysis;
  }

  /**
   * Calculate overall score from indicators
   */
  calculateScore(analysis) {
    const weights = config.scoring;
    let score = 0;
    let totalWeight = 0;

    // RSI contribution (normalized 0-1)
    if (analysis.indicators.rsi !== null) {
      const rsiNorm = analysis.indicators.rsi < 30
        ? 1 - (analysis.indicators.rsi / 30) // Oversold = bullish
        : analysis.indicators.rsi > 70
          ? -(analysis.indicators.rsi - 70) / 30 // Overbought = bearish
          : 0;
      score += rsiNorm * weights.rsiWeight;
      totalWeight += weights.rsiWeight;
    }

    // MACD contribution
    if (analysis.indicators.macd) {
      const macdNorm = analysis.indicators.macd.histogram > 0
        ? Math.min(1, analysis.indicators.macd.histogram / 0.01)
        : Math.max(-1, analysis.indicators.macd.histogram / 0.01);
      score += macdNorm * weights.macdWeight;
      totalWeight += weights.macdWeight;
    }

    // Momentum contribution
    if (analysis.indicators.momentum) {
      const momNorm = Math.max(-1, Math.min(1, analysis.indicators.momentum.momentum / 10));
      score += momNorm * weights.momentumWeight;
      totalWeight += weights.momentumWeight;
    }

    // Volume contribution
    if (analysis.indicators.volume) {
      const volNorm = analysis.indicators.volume.volumeSpike ? 0.5 : 0;
      score += volNorm * weights.volumeWeight;
      totalWeight += weights.volumeWeight;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Get trading recommendation
   */
  getRecommendation(analysis) {
    const score = analysis.score;
    const minConfidence = config.scoring.minConfidenceScore;

    if (score >= minConfidence) {
      return {
        action: 'BUY',
        confidence: Math.min(1, score),
        reason: this.generateReason(analysis, 'BUY'),
      };
    } else if (score <= -minConfidence) {
      return {
        action: 'SELL',
        confidence: Math.min(1, Math.abs(score)),
        reason: this.generateReason(analysis, 'SELL'),
      };
    }

    return {
      action: 'HOLD',
      confidence: 1 - Math.abs(score),
      reason: 'No strong signal detected',
    };
  }

  /**
   * Generate human-readable reason for signal
   */
  generateReason(analysis, action) {
    const reasons = [];

    if (analysis.signals.rsi === action) {
      reasons.push(`RSI ${action === 'BUY' ? 'oversold' : 'overbought'} (${analysis.indicators.rsi?.toFixed(2)})`);
    }
    if (analysis.signals.macd === action) {
      reasons.push(`MACD ${analysis.indicators.macd?.trend}`);
    }
    if (analysis.signals.ema === action) {
      reasons.push(`EMA crossover ${analysis.indicators.ema?.trend}`);
    }
    if (analysis.signals.momentum === action) {
      reasons.push(`Momentum ${analysis.indicators.momentum?.momentumTrend}`);
    }

    return reasons.length > 0 ? reasons.join(', ') : `${action} signal based on combined indicators`;
  }
}

// Singleton instance
const indicatorService = new IndicatorService();

export { IndicatorService, indicatorService };
export default indicatorService;
