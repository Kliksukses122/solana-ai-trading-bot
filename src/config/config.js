const config = {
  solana: {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    commitment: 'confirmed',
  },
  wallet: {
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  trading: {
    tradeSizeSol: 0.01,
    maxRiskPercent: 2,
    stopLossPercent: 2,
    takeProfitPercent: 8,
    slippageBps: 100,
    cooldownSeconds: 30,
  },
  bot: { mockMode: true },
  jupiter: { quoteApiUrl: 'https://quote-api.jup.ag/v6', timeout: 30000 },
};
module.exports = { config };
module.exports.default = config;
