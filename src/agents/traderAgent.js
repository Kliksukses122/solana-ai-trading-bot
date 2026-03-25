/**
 * Trader Agent - Trade Execution
 * 
 * Responsibilities:
 * - Execute swaps via Jupiter
 * - Manage positions
 * - Handle stop losses / take profits
 * - Track execution
 */

import { eventBus, EventTypes } from '../core/eventBus.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import positionManager from '../core/positionManager.js';
import exitEngine from '../core/exitEngine.js';

class TraderAgent {
  constructor() {
    this.name = 'Trader';
    this.jupiterApiUrl = config.jupiter.quoteApiUrl;
    this.isExecuting = false;
    this.executionQueue = [];

    this.stats = {
      totalSwaps: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolume: 0,
      avgSlippage: 0,
    };

    this.mockMode = config.bot.mockMode;
  }

  /**
   * Initialize agent
   */
  async initialize() {
    logger.agent(this.name, 'Initializing Trader Agent...');

    // Subscribe to risk approval
    eventBus.subscribe(EventTypes.RISK_APPROVED, (event) => {
      this.executeTrade(event.data);
    });

    // Subscribe to position updates for exit monitoring
    eventBus.subscribe(EventTypes.SCOUT_PRICE_UPDATE, (event) => {
      this.checkPositionExits(event.data);
    });

    logger.agent(this.name, '✅ Trader Agent initialized', { mockMode: this.mockMode });
    return this;
  }

  /**
   * Execute trade
   */
  async executeTrade(riskDecision) {
    const { tokenMint, tokenSymbol, adjustedSize, evaluation, marketData } = riskDecision;

    if (this.isExecuting) {
      logger.agent(this.name, 'Already executing, queuing trade...');
      this.executionQueue.push(riskDecision);
      return null;
    }

    this.isExecuting = true;

    try {
      logger.agent(this.name, `🔄 Executing: ${tokenSymbol}`, {
        size: (adjustedSize * 100).toFixed(2) + '%',
        strategy: evaluation?.bestStrategy,
        decision: evaluation?.decision?.level,
      });

      // Calculate position size in SOL
      const balance = 10; // In real implementation, get from wallet
      const amountInSol = balance * adjustedSize;

      // Get quote from Jupiter (or mock)
      const quote = await this.getQuote(config.wallet.inputMint, tokenMint, amountInSol);

      if (!quote) {
        throw new Error('Failed to get quote');
      }

      // Execute swap (or mock)
      const swapResult = await this.executeSwap(quote, tokenMint);

      if (!swapResult.success) {
        throw new Error(swapResult.error || 'Swap failed');
      }

      // Open position
      const position = positionManager.openPosition({
        tokenMint,
        tokenSymbol,
        strategy: evaluation?.bestStrategy,
        decision: evaluation?.decision?.level,
        entryPrice: swapResult.price,
        amount: swapResult.outputAmount,
        score: evaluation?.totalScore,
        signals: evaluation?.signals || [],
      });

      // Update stats
      this.stats.totalSwaps++;
      this.stats.successfulSwaps++;
      this.stats.totalVolume += amountInSol;

      logger.agent(this.name, `✅ Trade executed: ${tokenSymbol}`, {
        amount: swapResult.outputAmount.toFixed(4),
        price: swapResult.price.toFixed(10),
        txId: swapResult.signature?.slice(0, 10) + '...',
      });

      eventBus.emitEvent(EventTypes.TRADER_SWAP_SUCCESS, {
        tokenMint,
        tokenSymbol,
        ...swapResult,
      });

      eventBus.emitEvent(EventTypes.TRADER_POSITION_OPENED, position);

      return position;
    } catch (error) {
      this.stats.failedSwaps++;

      logger.error(`[Trader] Trade failed: ${error.message}`);

      eventBus.emitEvent(EventTypes.TRADER_SWAP_FAILED, {
        tokenMint,
        tokenSymbol,
        error: error.message,
      });

      return null;
    } finally {
      this.isExecuting = false;

      // Process queue
      if (this.executionQueue.length > 0) {
        const next = this.executionQueue.shift();
        setTimeout(() => this.executeTrade(next), 1000);
      }
    }
  }

  /**
   * Get quote from Jupiter
   */
  async getQuote(inputMint, outputMint, amount) {
    if (this.mockMode) {
      return this.mockQuote(inputMint, outputMint, amount);
    }

    try {
      const response = await fetch(
        `${this.jupiterApiUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.floor(amount * 1e9)}&slippageBps=${config.trading.slippageBps}`
      );

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`[Trader] Quote error: ${error.message}`);
      return null;
    }
  }

  /**
   * Execute swap
   */
  async executeSwap(quote, outputMint) {
    if (this.mockMode) {
      return this.mockSwap(quote, outputMint);
    }

    try {
      // Get swap transaction from Jupiter
      const swapResponse = await fetch(`${this.jupiterApiUrl}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: config.wallet.address,
          wrapAndUnwrapSol: true,
        }),
      });

      if (!swapResponse.ok) {
        throw new Error('Failed to get swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();

      // In real implementation, sign and send transaction
      // const signature = await this.signAndSendTransaction(swapTransaction);

      return {
        success: true,
        signature: 'mock_signature',
        outputAmount: parseFloat(quote.outAmount) / 1e6,
        price: parseFloat(quote.inAmount) / parseFloat(quote.outAmount),
      };
    } catch (error) {
      logger.error(`[Trader] Swap error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mock quote for testing
   */
  mockQuote(inputMint, outputMint, amount) {
    const mockPrice = Math.random() * 0.0001 + 0.00001;
    const outputAmount = amount / mockPrice;
    const slippage = 1 + (config.trading.slippageBps / 10000);

    return {
      inputMint,
      outputMint,
      inAmount: Math.floor(amount * 1e9).toString(),
      outAmount: Math.floor(outputAmount * 1e6 * (1 / slippage)).toString(),
      priceImpactPct: '0.5',
      routePlan: [{ swapInfo: { label: 'Raydium' } }],
    };
  }

  /**
   * Mock swap for testing
   */
  mockSwap(quote, outputMint) {
    const outAmount = parseFloat(quote.outAmount) / 1e6;
    const inAmount = parseFloat(quote.inAmount) / 1e9;
    const price = inAmount / outAmount;

    return {
      success: true,
      signature: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      outputAmount: outAmount,
      price,
      inputAmount: inAmount,
    };
  }

  /**
   * Check position exits
   */
  async checkPositionExits(priceData) {
    const { tokenMint, price } = priceData;
    const position = positionManager.getPosition(tokenMint);

    if (!position) return;

    // Update position with current price
    positionManager.updatePosition(tokenMint, price);

    // Check exit conditions
    const exitCheck = exitEngine.checkExit(position, { currentPrice: price });

    if (exitCheck.shouldExit) {
      logger.agent(this.name, `🚪 Exit triggered: ${position.tokenSymbol}`, {
        reason: exitCheck.exitReason,
        pnl: exitCheck.currentPnL.toFixed(6),
        pnlPercent: (exitCheck.currentPnLPercent * 100).toFixed(2) + '%',
      });

      await this.closePosition(position, exitCheck.exitReason, price);
    }

    // Check for partial exit
    if (exitCheck.partialExit) {
      exitEngine.executePartialExit(position, positionManager);
    }
  }

  /**
   * Close position
   */
  async closePosition(position, reason, exitPrice) {
    try {
      logger.agent(this.name, `🔄 Closing position: ${position.tokenSymbol}`, { reason });

      // Execute sell swap
      const quote = await this.getQuote(
        position.tokenMint,
        config.wallet.inputMint,
        position.amount
      );

      const swapResult = await this.executeSwap(quote, config.wallet.inputMint);

      if (!swapResult.success) {
        throw new Error('Failed to execute sell');
      }

      // Close position in manager
      const result = exitEngine.executeExit(position, reason, exitPrice || swapResult.price, positionManager);

      if (result) {
        eventBus.emitEvent(EventTypes.TRADER_POSITION_CLOSED, result);

        if (reason === 'STOP_LOSS') {
          eventBus.emitEvent(EventTypes.TRADER_STOP_LOSS_HIT, result);
        } else if (reason === 'TAKE_PROFIT' || reason === 'TRAILING_STOP') {
          eventBus.emitEvent(EventTypes.TRADER_TAKE_PROFIT_HIT, result);
        }
      }

      return result;
    } catch (error) {
      logger.error(`[Trader] Close position error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      name: this.name,
      mockMode: this.mockMode,
      isExecuting: this.isExecuting,
      queueLength: this.executionQueue.length,
      stats: this.stats,
      positions: positionManager.getPositionCount(),
    };
  }
}

const traderAgent = new TraderAgent();
export { TraderAgent, traderAgent };
export default traderAgent;
