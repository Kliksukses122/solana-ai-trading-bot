// src/services/trading-engine.ts
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { config } from '../config/config';
import { runAIAnalysis } from './ai-service';

interface TradingState {
  isRunning: boolean;
  lastAnalysis: Date | null;
  lastTrade: Date | null;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  logs: string[];
}

class TradingEngine {
  private connection: Connection;
  private treasuryKeypair: Keypair | null = null;
  private state: TradingState = {
    isRunning: false,
    lastAnalysis: null,
    lastTrade: null,
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    logs: [],
  };
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    this.initializeKeypair();
  }

  private initializeKeypair() {
    try {
      const privateKey = process.env.TREASURY_PRIVATE_KEY;
      if (privateKey) {
        const secretKey = Uint8Array.from(JSON.parse(privateKey));
        this.treasuryKeypair = Keypair.fromSecretKey(secretKey);
        this.log('✓ Treasury keypair initialized');
      } else {
        this.log('⚠️ No TREASURY_PRIVATE_KEY in environment');
      }
    } catch (error) {
      this.log(`✗ Failed to initialize keypair: ${error}`);
    }
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.state.logs.unshift(logMessage);
    if (this.state.logs.length > 100) this.state.logs.pop();
    console.log(logMessage);
  }

  getState(): TradingState {
    return { ...this.state };
  }

  async getBalance(): Promise<number> {
    try {
      const publicKey = new PublicKey(config.treasury.publicKey);
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      this.log(`Error getting balance: ${error}`);
      return 0;
    }
  }

  async getMarketData() {
    try {
      // Get SOL price from Jupiter
      const response = await fetch(`${config.jupiter.baseUrl}/price?ids=So11111111111111111111111111111111111111112`);
      const data = await response.json();
      const solPrice = data.data?.So11111111111111111111111111111111111111112?.price || 0;

      return {
        solPrice,
        priceChange24h: 0, // Would need additional API
        volume24h: 1000000000, // Placeholder
        marketCap: 20000000000, // Placeholder
      };
    } catch (error) {
      this.log(`Error getting market data: ${error}`);
      return null;
    }
  }

  async getQuote(inputMint: string, outputMint: string, amount: number) {
    try {
      // Amount in lamports (for SOL) or smallest unit
      const lamports = Math.floor(amount * 1e9);
      const url = `${config.jupiter.baseUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${lamports}&slippageBps=50`;
      
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      this.log(`Error getting quote: ${error}`);
      return null;
    }
  }

  async executeSwap(quoteResponse: any): Promise<string | null> {
    if (!this.treasuryKeypair) {
      this.log('✗ Cannot execute swap: No keypair available');
      return null;
    }

    try {
      // Get swap transaction from Jupiter
      const swapResponse = await fetch(`${config.jupiter.baseUrl}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: this.treasuryKeypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      const { swapTransaction } = await swapResponse.json();
      
      if (!swapTransaction) {
        this.log('✗ No swap transaction returned');
        return null;
      }

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign the transaction
      transaction.sign([this.treasuryKeypair]);

      // Send the transaction
      const rawTransaction = transaction.serialize();
      const txid = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      // Confirm the transaction
      const latestBlockHash = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txid,
      }, 'confirmed');

      this.log(`✓ Transaction confirmed: ${txid}`);
      return txid;
    } catch (error) {
      this.log(`✗ Swap failed: ${error}`);
      return null;
    }
  }

  async runAnalysisAndTrade() {
    this.log('🔍 Running analysis cycle...');
    this.state.lastAnalysis = new Date();

    try {
      // Get current state
      const balance = await this.getBalance();
      const marketData = await this.getMarketData();

      if (!marketData) {
        this.log('✗ No market data available');
        return;
      }

      this.log(`💰 Balance: ${balance.toFixed(4)} SOL | Price: $${marketData.solPrice.toFixed(2)}`);

      if (balance < 0.001) {
        this.log('⚠️ Insufficient balance for trading');
        return;
      }

      // Run AI analysis
      const decision = await runAIAnalysis(marketData, balance);
      
      this.log(`🤖 AI Decision: ${decision.action} (${decision.confidence}% confidence)`);
      decision.agentAnalyses.forEach(a => {
        this.log(`  - ${a.agent}: ${a.signal} (${a.confidence}%)`);
      });

      // Execute trade if action is BUY or SELL with sufficient confidence
      if ((decision.action === 'BUY' || decision.action === 'SELL') && decision.confidence >= 60) {
        await this.executeTrade(decision);
      } else {
        this.log(`⏸️ No trade executed (${decision.action} with ${decision.confidence}% confidence)`);
      }

    } catch (error) {
      this.log(`✗ Analysis error: ${error}`);
    }
  }

  private async executeTrade(decision: { action: 'BUY' | 'SELL'; targetToken: string; amount: number }) {
    this.state.totalTrades++;
    this.log(`📤 Executing ${decision.action} order for ${decision.amount.toFixed(4)} SOL...`);

    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    const inputMint = decision.action === 'BUY' ? SOL_MINT : decision.targetToken;
    const outputMint = decision.action === 'BUY' ? decision.targetToken : SOL_MINT;

    // Get quote
    const quote = await this.getQuote(inputMint, outputMint, decision.amount);
    
    if (!quote || quote.error) {
      this.log(`✗ Quote failed: ${quote?.error || 'Unknown error'}`);
      this.state.failedTrades++;
      return;
    }

    this.log(`📊 Quote: ${quote.outAmount} output tokens`);

    // Execute swap
    const txid = await this.executeSwap(quote);

    if (txid) {
      this.state.successfulTrades++;
      this.state.lastTrade = new Date();
      this.log(`✅ Trade successful! TX: ${txid}`);
    } else {
      this.state.failedTrades++;
      this.log(`❌ Trade failed`);
    }
  }

  start(intervalMs: number = 300000) { // Default: 5 minutes
    if (this.state.isRunning) {
      this.log('⚠️ Trading engine already running');
      return;
    }

    this.state.isRunning = true;
    this.log(`🚀 Trading engine started (interval: ${intervalMs / 1000}s)`);

    // Run immediately
    this.runAnalysisAndTrade();

    // Schedule recurring runs
    this.intervalId = setInterval(() => {
      this.runAnalysisAndTrade();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.state.isRunning = false;
    this.log('🛑 Trading engine stopped');
  }
}

// Singleton instance
export const tradingEngine = new TradingEngine();
export default tradingEngine;
