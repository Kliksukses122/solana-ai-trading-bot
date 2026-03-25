/**
 * Performance Tracker - Analyze and Evaluate Trade Results
 */

import logger from '../utils/logger.js';

class PerformanceTracker {
  constructor() {
    this.name = 'PerformanceTracker';
    this.trades = [];
    this.maxTrades = 500;

    this.stats = {
      totalTrades: 0, wins: 0, losses: 0,
      totalProfit: 0, totalLoss: 0,
      winRate: 0, avgProfit: 0,
      maxDrawdown: 0, currentDrawdown: 0,
    };

    this.strategyStats = {
      SNIPER: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 },
      WHALE: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 },
      MOMENTUM: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 },
      COMBO: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 },
    };

    this.decisionStats = {
      STRONG_BUY: { trades: 0, wins: 0, totalProfit: 0, winRate: 0 },
      BUY: { trades: 0, wins: 0, totalProfit: 0, winRate: 0 },
      SMALL_BUY: { trades: 0, wins: 0, totalProfit: 0, winRate: 0 },
    };

    this.signalStats = {
      whale: { trades: 0, wins: 0, totalProfit: 0 },
      early: { trades: 0, wins: 0, totalProfit: 0 },
      momentum: { trades: 0, wins: 0, totalProfit: 0 },
      volume: { trades: 0, wins: 0, totalProfit: 0 },
      combo: { trades: 0, wins: 0, totalProfit: 0 },
    };

    this.equityCurve = [];
    this.peakBalance = 0;
  }

  recordTrade(tradeData) {
    const { tokenMint, strategy, decision, signals, entryPrice, exitPrice, profit, profitPercent, duration, score } = tradeData;

    const trade = {
      tokenMint, strategy: strategy || 'MOMENTUM', decision: decision || 'BUY',
      signals: signals || [], entryPrice, exitPrice,
      profit: profit || 0, profitPercent: profitPercent || 0,
      duration: duration || 0, score: score || 0,
      timestamp: Date.now(),
    };

    this.trades.push(trade);
    if (this.trades.length > this.maxTrades) this.trades.shift();

    this.updateStats(trade);
    this.updateStrategyStats(trade);
    this.updateDecisionStats(trade);
    this.updateSignalStats(trade);
    this.updateEquityCurve();

    logger.debug('📊 Trade recorded', { strategy: trade.strategy, profit: profit?.toFixed(4) });
    return trade;
  }

  updateStats(trade) {
    this.stats.totalTrades++;
    if (trade.profit > 0) { this.stats.wins++; this.stats.totalProfit += trade.profit; }
    else { this.stats.losses++; this.stats.totalLoss += Math.abs(trade.profit); }

    this.stats.winRate = this.stats.totalTrades > 0 ? this.stats.wins / this.stats.totalTrades : 0;
    const netProfit = this.stats.totalProfit - this.stats.totalLoss;
    this.stats.avgProfit = this.stats.totalTrades > 0 ? netProfit / this.stats.totalTrades : 0;
    this.updateDrawdown();
  }

  updateStrategyStats(trade) {
    const stats = this.strategyStats[trade.strategy];
    if (!stats) return;
    stats.trades++;
    if (trade.profit > 0) stats.wins++;
    stats.totalProfit += trade.profit;
    stats.winRate = stats.trades > 0 ? stats.wins / stats.trades : 0;
    stats.avgProfit = stats.trades > 0 ? stats.totalProfit / stats.trades : 0;
  }

  updateDecisionStats(trade) {
    const stats = this.decisionStats[trade.decision];
    if (!stats) return;
    stats.trades++;
    if (trade.profit > 0) stats.wins++;
    stats.totalProfit += trade.profit;
    stats.winRate = stats.trades > 0 ? stats.wins / stats.trades : 0;
  }

  updateSignalStats(trade) {
    for (const signal of trade.signals) {
      const stats = this.signalStats[signal.toLowerCase()];
      if (!stats) continue;
      stats.trades++;
      if (trade.profit > 0) stats.wins++;
      stats.totalProfit += trade.profit;
    }
  }

  updateEquityCurve() {
    const netProfit = this.stats.totalProfit - this.stats.totalLoss;
    this.equityCurve.push({ timestamp: Date.now(), value: netProfit });
    if (this.equityCurve.length > 1000) this.equityCurve.shift();
  }

  updateDrawdown() {
    const currentEquity = this.stats.totalProfit - this.stats.totalLoss;
    if (currentEquity > this.peakBalance) this.peakBalance = currentEquity;
    if (this.peakBalance > 0) {
      this.stats.currentDrawdown = Math.max(0, (this.peakBalance - currentEquity) / this.peakBalance);
      this.stats.maxDrawdown = Math.max(this.stats.maxDrawdown, this.stats.currentDrawdown);
    }
  }

  analyzePerformance(recentCount = 20) {
    const recentTrades = this.trades.slice(-recentCount);
    if (recentTrades.length === 0) return this.getEmptyAnalysis();

    const wins = recentTrades.filter(t => t.profit > 0).length;
    const totalProfit = recentTrades.reduce((sum, t) => sum + t.profit, 0);

    return {
      recentTrades: recentTrades.length, wins, losses: recentTrades.length - wins,
      winRate: wins / recentTrades.length, avgProfit: totalProfit / recentTrades.length,
      totalProfit, bestTrade: Math.max(...recentTrades.map(t => t.profit)),
      worstTrade: Math.min(...recentTrades.map(t => t.profit)),
    };
  }

  getBestStrategy(minTrades = 10) {
    let best = null, bestWinRate = 0;
    for (const [strategy, stats] of Object.entries(this.strategyStats)) {
      if (stats.trades < minTrades) continue;
      if (stats.winRate > bestWinRate) { bestWinRate = stats.winRate; best = strategy; }
    }
    return best;
  }

  getSignalPerformance() {
    const performance = {};
    for (const [signal, stats] of Object.entries(this.signalStats)) {
      if (stats.trades === 0) continue;
      performance[signal] = { trades: stats.trades, wins: stats.wins, winRate: stats.wins / stats.trades, avgProfit: stats.totalProfit / stats.trades };
    }
    return performance;
  }

  shouldAdapt() {
    if (this.stats.totalTrades % 20 === 0 && this.stats.totalTrades >= 20) return true;
    if (this.stats.currentDrawdown > 0.10) return true;
    const recent = this.trades.slice(-5);
    return recent.length === 5 && recent.every(t => t.profit < 0);
  }

  getEmptyAnalysis() { return { recentTrades: 0, wins: 0, losses: 0, winRate: 0, avgProfit: 0, totalProfit: 0, bestTrade: 0, worstTrade: 0 }; }
  getAllStats() { return { overall: this.stats, byStrategy: this.strategyStats, byDecision: this.decisionStats, bySignal: this.getSignalPerformance(), bestStrategy: this.getBestStrategy() }; }
  getRecentTrades(limit = 20) { return this.trades.slice(-limit); }
  getStatus() { return { name: this.name, stats: this.stats, strategyStats: this.strategyStats }; }

  reset() {
    this.trades = [];
    this.stats = { totalTrades: 0, wins: 0, losses: 0, totalProfit: 0, totalLoss: 0, winRate: 0, avgProfit: 0, maxDrawdown: 0, currentDrawdown: 0 };
    this.strategyStats = { SNIPER: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 }, WHALE: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 }, MOMENTUM: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 }, COMBO: { trades: 0, wins: 0, totalProfit: 0, winRate: 0, avgProfit: 0 } };
    this.decisionStats = { STRONG_BUY: { trades: 0, wins: 0, totalProfit: 0, winRate: 0 }, BUY: { trades: 0, wins: 0, totalProfit: 0, winRate: 0 }, SMALL_BUY: { trades: 0, wins: 0, totalProfit: 0, winRate: 0 } };
    this.signalStats = { whale: { trades: 0, wins: 0, totalProfit: 0 }, early: { trades: 0, wins: 0, totalProfit: 0 }, momentum: { trades: 0, wins: 0, totalProfit: 0 }, volume: { trades: 0, wins: 0, totalProfit: 0 }, combo: { trades: 0, wins: 0, totalProfit: 0 } };
    this.equityCurve = []; this.peakBalance = 0;
  }
}

const performanceTracker = new PerformanceTracker();
export { PerformanceTracker, performanceTracker };
export default performanceTracker;
