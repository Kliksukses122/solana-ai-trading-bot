/**
 * Jupiter Service - Jupiter Aggregator API Integration
 * Handles quotes, swaps, and transaction building
 */

import axios from 'axios';
import {
  VersionedTransaction,
  PublicKey,
} from '@solana/web3.js';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class JupiterService {
  constructor() {
    this.baseUrl = config.jupiter.quoteApiUrl;
    this.timeout = config.jupiter.timeout;
    this.maxRetries = config.jupiter.maxRetries;
    this.slippageBps = config.trading.slippageBps;

    // HTTP client
    this.httpClient = axios.create({
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get quote for a swap
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = null) {
    const startTime = Date.now();

    try {
      const params = {
        inputMint,
        outputMint,
        amount: Math.floor(amount).toString(),
        slippageBps: slippageBps || this.slippageBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      };

      logger.debug('Getting Jupiter quote', { inputMint, outputMint, amount });

      const response = await this.httpClient.get(
        `${this.baseUrl}/quote`,
        { params }
      );

      const duration = Date.now() - startTime;
      logger.performance('jupiter_quote', duration);

      const quote = response.data;

      // Validate quote
      if (!quote || !quote.outAmount) {
        throw new Error('Invalid quote received from Jupiter');
      }

      logger.info('Quote received', {
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        route: quote.routePlan?.map(r => r.swapInfo?.label).join(' -> '),
      });

      return {
        success: true,
        quote,
        inputMint,
        outputMint,
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        routes: quote.routePlan,
        otherAmountThreshold: quote.otherAmountThreshold,
        swapMode: quote.swapMode,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to get quote', {
        error: error.message,
        inputMint,
        outputMint,
        amount,
        duration,
      });

      return {
        success: false,
        error: error.message,
        inputMint,
        outputMint,
      };
    }
  }

  /**
   * Build swap transaction
   */
  async buildSwapTransaction(quoteResponse, userPublicKey, options = {}) {
    const startTime = Date.now();

    try {
      const swapRequest = {
        quoteResponse,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: options.wrapAndUnwrapSol !== false,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
        asLegacyTransaction: false,
      };

      logger.debug('Building swap transaction', { userPublicKey: userPublicKey.toString() });

      const response = await this.httpClient.post(
        `${this.baseUrl}/swap`,
        swapRequest
      );

      const duration = Date.now() - startTime;
      logger.performance('jupiter_build_swap', duration);

      const { swapTransaction, lastValidBlockHeight } = response.data;

      // Deserialize transaction
      const transactionBuffer = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      logger.info('Swap transaction built', {
        lastValidBlockHeight,
        transactionSize: transactionBuffer.length,
      });

      return {
        success: true,
        transaction,
        lastValidBlockHeight,
        rawTransaction: swapTransaction,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to build swap transaction', {
        error: error.message,
        duration,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute swap (quote + build + sign + send)
   */
  async executeSwap(walletService, inputMint, outputMint, amount, options = {}) {
    const startTime = Date.now();

    try {
      logger.info('Executing swap', {
        inputMint,
        outputMint,
        amount,
        slippageBps: options.slippageBps || this.slippageBps,
      });

      // Step 1: Get quote
      const quoteResult = await this.getQuote(
        inputMint,
        outputMint,
        amount,
        options.slippageBps
      );

      if (!quoteResult.success) {
        return {
          success: false,
          stage: 'quote',
          error: quoteResult.error,
        };
      }

      // Step 2: Build transaction
      const buildResult = await this.buildSwapTransaction(
        quoteResult.quote,
        walletService.publicKey,
        options
      );

      if (!buildResult.success) {
        return {
          success: false,
          stage: 'build',
          error: buildResult.error,
          quote: quoteResult,
        };
      }

      // Step 3: Sign transaction
      const signedTransaction = await walletService.signTransaction(buildResult.transaction);

      // Step 4: Send transaction
      const signature = await walletService.sendTransaction(signedTransaction);

      // Step 5: Confirm transaction
      const confirmation = await walletService.confirmTransaction(signature);

      const duration = Date.now() - startTime;

      if (confirmation.confirmed) {
        logger.success('Swap executed successfully', {
          signature,
          inAmount: quoteResult.inAmount,
          outAmount: quoteResult.outAmount,
          duration,
        });

        return {
          success: true,
          signature,
          inAmount: quoteResult.inAmount,
          outAmount: quoteResult.outAmount,
          inputMint,
          outputMint,
          priceImpact: quoteResult.priceImpact,
          duration,
        };
      } else {
        logger.error('Swap confirmation failed', {
          signature,
          error: confirmation.err,
        });

        return {
          success: false,
          stage: 'confirm',
          signature,
          error: confirmation.err,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Swap execution failed', {
        error: error.message,
        stack: error.stack,
        duration,
      });

      return {
        success: false,
        stage: 'execution',
        error: error.message,
      };
    }
  }

  /**
   * Get price for a token pair
   */
  async getPrice(inputMint, outputMint) {
    try {
      // Use a minimal amount to get price
      const quoteResult = await this.getQuote(inputMint, outputMint, 1000000); // 1 USDC worth

      if (quoteResult.success) {
        const price = parseFloat(quoteResult.outAmount) / 1000000;
        return {
          success: true,
          price,
          inputMint,
          outputMint,
        };
      }

      return quoteResult;
    } catch (error) {
      logger.error('Failed to get price', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate minimum output amount with slippage
   */
  calculateMinOutput(outAmount, slippageBps = null) {
    const slippage = (slippageBps || this.slippageBps) / 10000;
    return Math.floor(outAmount * (1 - slippage));
  }

  /**
   * Check if price impact is acceptable
   */
  isPriceImpactAcceptable(priceImpact, maxImpact = 1) {
    return Math.abs(parseFloat(priceImpact)) <= maxImpact;
  }

  /**
   * Get route efficiency score
   */
  getRouteEfficiency(quote) {
    if (!quote || !quote.routePlan) return 0;

    const hopCount = quote.routePlan.length;
    const priceImpact = Math.abs(parseFloat(quote.priceImpactPct) || 0);

    // Lower hops and lower price impact = higher efficiency
    const hopScore = Math.max(0, 1 - (hopCount - 1) * 0.1);
    const impactScore = Math.max(0, 1 - priceImpact / 5);

    return (hopScore + impactScore) / 2;
  }

  /**
   * Simulate swap (for analysis)
   */
  async simulateSwap(inputMint, outputMint, amount) {
    try {
      const quoteResult = await this.getQuote(inputMint, outputMint, amount);

      if (!quoteResult.success) {
        return quoteResult;
      }

      return {
        success: true,
        inputMint,
        outputMint,
        inAmount: quoteResult.inAmount,
        outAmount: quoteResult.outAmount,
        priceImpact: quoteResult.priceImpact,
        routes: quoteResult.routes?.map(r => ({
          label: r.swapInfo?.label,
          inputMint: r.swapInfo?.inputMint,
          outputMint: r.swapInfo?.outputMint,
          inAmount: r.swapInfo?.inAmount,
          outAmount: r.swapInfo?.outAmount,
        })),
        efficiency: this.getRouteEfficiency(quoteResult.quote),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const jupiterService = new JupiterService();

export { JupiterService, jupiterService };
export default jupiterService;
