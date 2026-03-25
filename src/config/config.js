/**
 * Configuration Module - Multi-Strategy Trading Engine with Auto-Learning
 */

import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
dotenv.config();

// Derive wallet address from private key if needed
let derivedAddress = '';
const privateKey = process.env.PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY || '';

if (privateKey) {
  try {
    let secretKey: Uint8Array;
    if (privateKey.startsWith('[')) {
      secretKey = new Uint8Array(JSON.parse(privateKey));
    } else {
      secretKey = bs58.decode(privateKey);
    }
    const keypair = Keypair.fromSecretKey(secretKey);
    derivedAddress = keypair.publicKey.toBase58();
  } catch (e) {
    console.error('Failed to derive wallet address from private key');
  }
}

const config = {
  // Solana Network
  solana: {
    rpcUrl: process.env.RPC_URL || process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.WS_URL || process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
    commitment: 'confirmed',
  },

  // Wallet
  wallet: {
    privateKey: privateKey,
    address: process.env.WALLET_ADDRESS || process.env.TREASURY_WALLET_ADDRESS || derivedAddress || '',
    inputMint: 'So11111111111111111111111111111111111111112', // SOL
    outputMint: process.env.OUTPUT_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  },

  // Trading Parameters
  trading: {
    tradeSizeSol: parseFloat(process.env.TRADE_SIZE_SOL) || 0.01,
    maxRiskPercent: 2,
    stopLossPercent: 2,
    takeProfitPercent: 8,
    slippageBps: 100,
    cooldownSeconds: 30,
    scanIntervalMs: 3000,
    maxOpenTrades: 5,
    minLiquidityUsd: 5000,
    minVolume24h: 2000,
  },

  // Risk Management
  risk: {
    maxDailyLossPercent: 5,
    maxDailyTrades: 15,
    maxConsecutiveLosses: 3,
    consecutiveLossCooldownMs: 3600000,
    maxRiskPerTrade: 0.02,
    emergencyStopEnabled: true,
    blacklistTokens: [],
    whitelistTokens: [],
  },

  // Scoring System - Multi-Strategy
  scoring: {
    strongBuyThreshold: 8,
    buyThreshold: 6,
    smallBuyThreshold: 4,
    weights: {
      whale: 5,
      early: 3,
      momentum: 2,
      volume: 2,
      liquidity: 2,
      combo: 3,
    },
    volumeSpikeThreshold: 50,
    rsiOversoldThreshold: 35,
    liquidityThreshold: 50000,
    maxTokenAgeForSnipe: 10,
  },

  // Position Sizing
  positionSizing: {
    multipliers: {
      STRONG_BUY: 0.02,
      BUY: 0.01,
      SMALL_BUY: 0.005,
    },
    strategyMultipliers: {
      SNIPER: 0.8,
      WHALE: 1.0,
      MOMENTUM: 0.9,
      COMBO: 1.2,
    },
  },

  // Exit Configuration
  exit: {
    stopLossPercent: 2,
    trailingStopPercent: 3,
    trailingStopActivation: 5,
    takeProfitPercent: 8,
    partialExitPercent: 5,
    partialExitAmount: 0.5,
    maxHoldTime: 3600000,
    minHoldTime: 60000,
  },

  // Whale Tracking
  whaleTracking: {
    enabled: true,
    minWhaleAmount: 50,
    trackedWallets: [],
  },

  // Learning Configuration
  learning: {
    enabled: true,
    learningInterval: 20,
    minTradesForLearning: 10,
    autoAdapt: true,
  },

  // Bot Mode
  bot: {
    mockMode: process.env.MOCK_MODE === 'true' || (!process.env.PRIVATE_KEY && process.env.MOCK_MODE !== 'false'),
    dashboardPort: 3000,
  },

  // Jupiter API
  jupiter: {
    quoteApiUrl: 'https://quote-api.jup.ag/v6',
    timeout: 30000,
    maxRetries: 3,
  },

  // Token Lists
  tokenLists: {
    memeTokens: [
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
    ],
    popular: [
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ],
    stablecoins: [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ],
  },

  // Memory
  memory: {
    maxTradeHistory: 1000,
    maxPriceHistory: 10000,
  },
};

function getConfigSummary() {
  return {
    mode: config.bot.mockMode ? 'MOCK' : 'LIVE',
    tradeSize: config.trading.tradeSizeSol + ' SOL',
    strategies: ['SNIPER', 'WHALE', 'MOMENTUM', 'COMBO'],
    learningEnabled: config.learning.enabled,
  };
}

export { config, getConfigSummary };
export default config;
