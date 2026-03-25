/**
 * Exit Engine - Smart Exit Management
 * 
 * Exit Strategies:
 * - Stop Loss
 * - Take Profit
 * - Trailing Stop
 * - Time-based exit
 * - Partial exit
 */

import { eventBus, EventTypes } from './eventBus.js';
import logger from '../utils/logger.js';
import adaptiveConfig from './adaptiveConfig.js';

class ExitEngine {
  constructor() {
    this.name = 'ExitEngine';

    this.config = {
      stopLossPercent: 0.02,
      takeProfitPercent: 0.08,
      trailingStopPercent: 0.03,
      trailingStopActivation: 0.05,
      maxHoldTime: 3600000, // 1 hour
      minHoldTime: 60000, // 1 minute
      partialExitThreshold: 0.05, // 5% profit for partial exit
      partialExitAmount: 0.5, // sell 50%
    };

    this.exitRules = [];
    this.exitHistory = [];
  }

  /**
   * Check if position should exit
   */
  checkExit(position, marketData) {
    const checks = [];
    let shouldExit = false;
    let exitReason = null;
    let exitPrice = null;
    let partialExit = false;

    const currentPrice = marketData.currentPrice || position.currentPrice;
    const holdTime = Date.now() - position.openedAt;
    const pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;

    // 1. Stop Loss Check
    const stopLoss = this.calculateStopLoss(position);
    if (currentPrice <= stopLoss.price) {
      checks.push({ type: 'STOP_LOSS', triggered: true, price: stopLoss.price });
      shouldExit = true;
      exitReason = 'STOP_LOSS';
      exitPrice = currentPrice;
    }

    // 2. Take Profit Check
    if (!shouldExit) {
      const takeProfit = this.calculateTakeProfit(position);
      if (currentPrice >= takeProfit.price) {
        checks.push({ type: 'TAKE_PROFIT', triggered: true, price: takeProfit.price });
        shouldExit = true;
        exitReason = 'TAKE_PROFIT';
        exitPrice = currentPrice;
      }
    }

    // 3. Trailing Stop Check
    if (!shouldExit && position.trailingStopPrice) {
      if (currentPrice <= position.trailingStopPrice) {
        checks.push({ type: 'TRAILING_STOP', triggered: true, price: position.trailingStopPrice });
        shouldExit = true;
        exitReason = 'TRAILING_STOP';
        exitPrice = currentPrice;
      }
    }

    // 4. Max Hold Time Check
    if (!shouldExit && holdTime > this.config.maxHoldTime) {
      checks.push({ type: 'MAX_HOLD_TIME', triggered: true, holdTime });
      shouldExit = true;
      exitReason = 'MAX_HOLD_TIME';
      exitPrice = currentPrice;
    }

    // 5. Partial Exit Check
    if (!shouldExit && pnlPercent >= this.config.partialExitThreshold && !position.partialExitDone) {
      checks.push({ type: 'PARTIAL_EXIT', triggered: true, pnlPercent });
      partialExit = true;
    }

    // 6. Momentum Reversal Check
    if (!shouldExit && marketData.momentumReversal) {
      checks.push({ type: 'MOMENTUM_REVERSAL', triggered: true });
      if (pnlPercent > 0.02) { // Only exit if in profit
        shouldExit = true;
        exitReason = 'MOMENTUM_REVERSAL';
        exitPrice = currentPrice;
      }
    }

    // 7. Whale Sell Check
    if (!shouldExit && marketData.whaleSells && marketData.whaleSells.length > 0) {
      const totalWhaleSell = marketData.whaleSells.reduce((sum, w) => sum + w.amount, 0);
      if (totalWhaleSell > 10000) { // $10k+ whale sells
        checks.push({ type: 'WHALE_SELL', triggered: true, amount: totalWhaleSell });
        shouldExit = true;
        exitReason = 'WHALE_SELL';
        exitPrice = currentPrice;
      }
    }

    return {
      shouldExit,
      exitReason,
      exitPrice,
      partialExit,
      checks,
      currentPnL: (currentPrice - position.entryPrice) * position.amount,
      currentPnLPercent: pnlPercent,
    };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(position) {
    const adaptiveStopLoss = adaptiveConfig.get('stopLoss');
    const price = position.entryPrice * (1 - adaptiveStopLoss);
    return { price, percent: adaptiveStopLoss };
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(position) {
    const adaptiveTakeProfit = adaptiveConfig.get('takeProfit');
    const price = position.entryPrice * (1 + adaptiveTakeProfit);
    return { price, percent: adaptiveTakeProfit };
  }

  /**
   * Update trailing stop for position
   */
  updateTrailingStop(position, currentPrice) {
    const pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;

    // Activate trailing stop if profit exceeds threshold
    if (pnlPercent >= this.config.trailingStopActivation && !position.trailingActive) {
      position.trailingActive = true;
      position.trailingStopPrice = currentPrice * (1 - this.config.trailingStopPercent);
      logger.agent(this.name, `Trailing stop activated for ${position.tokenSymbol}`, {
        trailingStop: position.trailingStopPrice.toFixed(8),
        currentProfit: (pnlPercent * 100).toFixed(2) + '%',
      });
    }

    // Update trailing stop if price increases
    if (position.trailingActive) {
      const newTrailingStop = currentPrice * (1 - this.config.trailingStopPercent);
      if (newTrailingStop > position.trailingStopPrice) {
        position.trailingStopPrice = newTrailingStop;
        position.highestPrice = currentPrice;
      }
    }

    return position;
  }

  /**
   * Execute exit
   */
  executeExit(position, exitReason, exitPrice, positionManager) {
    const result = positionManager.closePosition(position.tokenMint, exitPrice, exitReason);
    
    if (result) {
      this.exitHistory.unshift({
        positionId: position.id,
        tokenSymbol: position.tokenSymbol,
        exitReason,
        exitPrice,
        pnl: result.finalPnl,
        pnlPercent: result.finalPnlPercent,
        holdTime: result.holdTime,
        timestamp: Date.now(),
      });

      logger.agent(this.name, `Exit executed: ${position.tokenSymbol}`, {
        reason: exitReason,
        pnl: result.finalPnl.toFixed(6),
        pnlPercent: (result.finalPnlPercent * 100).toFixed(2) + '%',
      });

      eventBus.emitEvent(EventTypes.TRADER_POSITION_CLOSED, {
        tokenMint: position.tokenMint,
        strategy: position.strategy,
        decision: position.decision,
        entryPrice: position.entryPrice,
        exitPrice,
        pnl: result.finalPnl,
        pnlPercent: result.finalPnlPercent,
        holdTime: result.holdTime,
        score: position.score,
      });
    }

    return result;
  }

  /**
   * Execute partial exit
   */
  executePartialExit(position, positionManager) {
    const partialAmount = position.amount * this.config.partialExitAmount;
    const currentPrice = position.currentPrice;

    // Reduce position
    position.amount -= partialAmount;
    position.valueAtEntry = position.amount * position.entryPrice;
    position.partialExitDone = true;

    logger.agent(this.name, `Partial exit: ${position.tokenSymbol}`, {
      soldAmount: partialAmount.toFixed(4),
      remaining: position.amount.toFixed(4),
      price: currentPrice.toFixed(8),
    });

    return {
      tokenMint: position.tokenMint,
      amount: partialAmount,
      price: currentPrice,
    };
  }

  /**
   * Get exit stats
   */
  getExitStats() {
    if (this.exitHistory.length === 0) return null;

    const byReason = {};
    for (const exit of this.exitHistory) {
      if (!byReason[exit.exitReason]) {
        byReason[exit.exitReason] = { count: 0, totalPnL: 0, wins: 0 };
      }
      byReason[exit.exitReason].count++;
      byReason[exit.exitReason].totalPnL += exit.pnl;
      if (exit.pnl > 0) byReason[exit.exitReason].wins++;
    }

    return {
      totalExits: this.exitHistory.length,
      byReason,
    };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      config: this.config,
      exitHistoryCount: this.exitHistory.length,
      exitStats: this.getExitStats(),
    };
  }

  /**
   * Reset
   */
  reset() {
    this.exitHistory = [];
    logger.agent(this.name, 'Exit engine reset');
  }
}

const exitEngine = new ExitEngine();
export { ExitEngine, exitEngine };
export default exitEngine;
