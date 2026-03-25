/**
 * Position Manager - Position Sizing & Tracking
 * 
 * Features:
 * - Position tracking
 * - PnL calculation
 * - Exit target management
 */

import { eventBus, EventTypes } from './eventBus.js';
import logger from '../utils/logger.js';
import adaptiveConfig from './adaptiveConfig.js';

class PositionManager {
  constructor() {
    this.name = 'PositionManager';
    this.positions = new Map();
    this.maxPositions = 5;
    this.positionHistory = [];
    this.maxHistory = 100;
  }

  /**
   * Open new position
   */
  openPosition(tradeData) {
    const { tokenMint, tokenSymbol, strategy, decision, entryPrice, amount, score, signals } = tradeData;

    if (this.positions.has(tokenMint)) {
      logger.warn(`Position already exists for ${tokenSymbol}`);
      return null;
    }

    if (this.positions.size >= this.maxPositions) {
      logger.warn(`Max positions reached (${this.maxPositions})`);
      return null;
    }

    const stopLoss = adaptiveConfig.get('stopLoss');
    const takeProfit = adaptiveConfig.get('takeProfit');

    const position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tokenMint,
      tokenSymbol,
      strategy,
      decision,
      entryPrice,
      amount,
      valueAtEntry: amount * entryPrice,
      score,
      signals,
      stopLossPrice: entryPrice * (1 - stopLoss),
      takeProfitPrice: entryPrice * (1 + takeProfit),
      trailingStopPrice: null,
      highestPrice: entryPrice,
      openedAt: Date.now(),
      status: 'OPEN',
      pnl: 0,
      pnlPercent: 0,
    };

    this.positions.set(tokenMint, position);

    logger.agent(this.name, `Opened position: ${tokenSymbol}`, {
      strategy,
      entry: entryPrice.toFixed(8),
      amount: amount.toFixed(4),
      stopLoss: (stopLoss * 100).toFixed(1) + '%',
      takeProfit: (takeProfit * 100).toFixed(0) + '%',
    });

    eventBus.emitEvent(EventTypes.POSITION_OPENED, position);
    return position;
  }

  /**
   * Update position with new price
   */
  updatePosition(tokenMint, currentPrice) {
    const position = this.positions.get(tokenMint);
    if (!position) return null;

    // Update highest price for trailing stop
    if (currentPrice > position.highestPrice) {
      position.highestPrice = currentPrice;
    }

    // Calculate PnL
    position.pnl = (currentPrice - position.entryPrice) * position.amount;
    position.pnlPercent = (currentPrice - position.entryPrice) / position.entryPrice;
    position.currentPrice = currentPrice;
    position.currentValue = currentPrice * position.amount;

    // Update trailing stop if activated
    this.updateTrailingStop(position, currentPrice);

    eventBus.emitEvent(EventTypes.POSITION_UPDATED, {
      tokenMint,
      pnl: position.pnl,
      pnlPercent: position.pnlPercent,
      currentPrice,
    });

    return position;
  }

  /**
   * Update trailing stop
   */
  updateTrailingStop(position, currentPrice) {
    const trailingActivation = 0.05; // 5% profit to activate
    const trailingPercent = 0.03; // 3% trailing

    // Activate trailing stop if profit > 5%
    if (position.pnlPercent >= trailingActivation && !position.trailingStopPrice) {
      position.trailingStopPrice = position.highestPrice * (1 - trailingPercent);
      logger.agent(this.name, `Trailing stop activated for ${position.tokenSymbol}`, {
        trailingStop: position.trailingStopPrice.toFixed(8),
      });
    }

    // Update trailing stop
    if (position.trailingStopPrice) {
      const newTrailingStop = position.highestPrice * (1 - trailingPercent);
      if (newTrailingStop > position.trailingStopPrice) {
        position.trailingStopPrice = newTrailingStop;
      }
    }
  }

  /**
   * Close position
   */
  closePosition(tokenMint, exitPrice, reason = 'MANUAL') {
    const position = this.positions.get(tokenMint);
    if (!position) return null;

    position.exitPrice = exitPrice;
    position.exitReason = reason;
    position.closedAt = Date.now();
    position.holdTime = position.closedAt - position.openedAt;
    position.finalPnl = (exitPrice - position.entryPrice) * position.amount;
    position.finalPnlPercent = (exitPrice - position.entryPrice) / position.entryPrice;
    position.status = 'CLOSED';

    // Remove from active positions
    this.positions.delete(tokenMint);

    // Add to history
    this.positionHistory.unshift(position);
    if (this.positionHistory.length > this.maxHistory) {
      this.positionHistory.pop();
    }

    logger.agent(this.name, `Closed position: ${position.tokenSymbol}`, {
      reason,
      pnl: position.finalPnl.toFixed(6),
      pnlPercent: (position.finalPnlPercent * 100).toFixed(2) + '%',
      holdTime: Math.round(position.holdTime / 60000) + 'min',
    });

    eventBus.emitEvent(EventTypes.POSITION_CLOSED, position);
    eventBus.emitEvent(EventTypes.TRADER_POSITION_CLOSED, {
      tokenMint,
      strategy: position.strategy,
      decision: position.decision,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl: position.finalPnl,
      pnlPercent: position.finalPnlPercent,
      holdTime: position.holdTime,
      score: position.score,
    });

    return position;
  }

  /**
   * Check if should exit position
   */
  checkExit(tokenMint, currentPrice) {
    const position = this.positions.get(tokenMint);
    if (!position || position.status !== 'OPEN') return null;

    // Check stop loss
    if (currentPrice <= position.stopLossPrice) {
      return { shouldExit: true, reason: 'STOP_LOSS', price: currentPrice };
    }

    // Check take profit
    if (currentPrice >= position.takeProfitPrice) {
      return { shouldExit: true, reason: 'TAKE_PROFIT', price: currentPrice };
    }

    // Check trailing stop
    if (position.trailingStopPrice && currentPrice <= position.trailingStopPrice) {
      return { shouldExit: true, reason: 'TRAILING_STOP', price: currentPrice };
    }

    // Check max hold time (1 hour)
    const maxHoldTime = 3600000;
    if (Date.now() - position.openedAt > maxHoldTime) {
      return { shouldExit: true, reason: 'MAX_HOLD_TIME', price: currentPrice };
    }

    return { shouldExit: false };
  }

  /**
   * Get all active positions
   */
  getActivePositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by token
   */
  getPosition(tokenMint) {
    return this.positions.get(tokenMint);
  }

  /**
   * Get total portfolio value
   */
  getPortfolioValue() {
    let total = 0;
    for (const position of this.positions.values()) {
      total += position.currentValue || position.valueAtEntry;
    }
    return total;
  }

  /**
   * Get total PnL
   */
  getTotalPnL() {
    let total = 0;
    for (const position of this.positions.values()) {
      total += position.pnl || 0;
    }
    return total;
  }

  /**
   * Get position count
   */
  getPositionCount() {
    return this.positions.size;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      activePositions: this.getPositionCount(),
      maxPositions: this.maxPositions,
      totalPnL: this.getTotalPnL(),
      portfolioValue: this.getPortfolioValue(),
      positions: this.getActivePositions().map(p => ({
        token: p.tokenSymbol,
        strategy: p.strategy,
        pnlPercent: (p.pnlPercent * 100).toFixed(2) + '%',
        holdTime: Math.round((Date.now() - p.openedAt) / 60000) + 'min',
      })),
    };
  }

  /**
   * Close all positions
   */
  closeAllPositions(exitPrice, reason = 'EMERGENCY') {
    const closed = [];
    for (const [tokenMint, position] of this.positions) {
      const result = this.closePosition(tokenMint, exitPrice || position.currentPrice || position.entryPrice, reason);
      if (result) closed.push(result);
    }
    return closed;
  }

  /**
   * Reset
   */
  reset() {
    this.positions.clear();
    this.positionHistory = [];
    logger.agent(this.name, 'Position manager reset');
  }
}

const positionManager = new PositionManager();
export { PositionManager, positionManager };
export default positionManager;
