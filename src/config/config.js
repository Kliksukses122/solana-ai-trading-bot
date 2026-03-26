// src/config/config.js
export const config = {
  solana: {
    rpcUrl: process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.WS_URL || 'wss://api.mainnet-beta.solana.com',
    network: process.env.NETWORK || 'mainnet-beta',
    commitment: 'confirmed',
  },
  
  jupiter: {
    baseUrl: 'https://quote-api.jup.ag/v6',
    slippageBps: 50, // 0.5%
    useSharedAccounts: true,
  },
  
  treasury: {
    publicKey: process.env.TREASURY_PUBLIC_KEY || 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE',
    privateKey: process.env.TREASURY_PRIVATE_KEY,
  },
  
  ai: {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
  },
  
  trading: {
    minTradeAmount: 0.001,
    maxTradeAmount: 1,
    defaultTradeAmount: 0.01,
    stopLossPercent: 5,
    takeProfitPercent: 10,
    maxPositions: 5,
    paperTrading: false,
  },
  
  tokens: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    RAY: '4k3Dyjzvzp8eMZWxbsQWTv9q7vXh5NqX5fKFQy5Yd7vD',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    PYTH: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaTDL6sbXjJtD9wZy',
  },
  
  agents: {
    technicalAnalyst: {
      name: 'Technical Analyst',
      enabled: true,
      weight: 0.25,
    },
    sentimentAnalyst: {
      name: 'Sentiment Analyst',
      enabled: true,
      weight: 0.20,
    },
    liquidityAnalyst: {
      name: 'Liquidity Analyst',
      enabled: true,
      weight: 0.15,
    },
    riskManager: {
      name: 'Risk Manager',
      enabled: true,
      weight: 0.20,
    },
    portfolioManager: {
      name: 'Portfolio Manager',
      enabled: true,
      weight: 0.10,
    },
    executionEngine: {
      name: 'Execution Engine',
      enabled: true,
      weight: 0.10,
    },
  },
  
  schedule: {
    analysisInterval: 300000, // 5 minutes
    tradeInterval: 600000, // 10 minutes
    reportInterval: 3600000, // 1 hour
  },
  
  api: {
    heliusApiKey: process.env.HELIUS_API_KEY,
    birdeyeApiKey: process.env.BIRDEYE_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
  
  app: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
};

export default config;
