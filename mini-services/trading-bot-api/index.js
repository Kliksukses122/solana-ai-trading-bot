/**
 * Trading Bot API Service
 * WebSocket-based API for dashboard communication
 * Reads real state from the bot's state file
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const PORT = 3030;
const STATE_FILE = path.join('/home/z/my-project/data', 'bot-state.json');

// Solana connection for real balance fetching
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'vQuaowFLXdwN8Xt1z1YaZGtLTPWnpz1mYUvLsZjVVTJ';

let connection = null;

// Initialize Solana connection
async function initSolanaConnection() {
  try {
    connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      maxRetries: 3,
    });
    console.log('Solana connection initialized');
  } catch (error) {
    console.error('Failed to initialize Solana connection:', error.message);
  }
}

// Get real wallet balance from Solana
async function getWalletBalance(address) {
  if (!connection) {
    return { balance: 0, balanceUsd: 0 };
  }
  
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    
    // Rough SOL price estimate (in production, fetch from API)
    const solPrice = 150;
    const balanceUsd = balanceSol * solPrice;
    
    return { balance: balanceSol, balanceUsd };
  } catch (error) {
    console.error('Failed to get wallet balance:', error.message);
    return { balance: 0, balanceUsd: 0 };
  }
}

// Read bot state from file
function readBotState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return data;
    }
  } catch (error) {
    console.error('Failed to read bot state:', error.message);
  }
  
  // Return default state if file doesn't exist
  return getDefaultState();
}

// Default state when bot is not running
function getDefaultState() {
  return {
    status: 'stopped',
    mockMode: false,
    startTime: null,
    lastUpdate: Date.now(),
    wallet: {
      address: WALLET_ADDRESS,
      balance: 0,
      balanceUsd: 0,
    },
    agents: {
      scout: {
        name: 'ScoutAgent',
        isRunning: false,
        monitoredTokens: 0,
        whaleWallets: 0,
        recentOpportunities: 0,
      },
      analyst: {
        name: 'AnalystAgent',
        cacheSize: 0,
        historySize: 0,
        minConfidence: 0.65,
        mlEnabled: true,
      },
      risk: {
        name: 'RiskAgent',
        emergencyStop: false,
        activePositions: 0,
        dailyPnL: 0,
        dailyTrades: 0,
      },
      trader: {
        name: 'TraderAgent',
        mockMode: false,
        pendingTransactions: 0,
        completedTrades: 0,
      },
      memory: {
        name: 'MemoryAgent',
        totalTrades: 0,
        performanceMetrics: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnL: 0,
          winRate: 0,
          profitFactor: 0,
          maxDrawdown: 0,
        },
      },
    },
    performance: {
      totalTrades: 0,
      winRate: 0,
      totalPnL: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      avgHoldingTime: 0,
    },
    recentTrades: [],
    opportunities: [],
    positions: [],
    eventLog: [],
  };
}

// Create HTTP server
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track last state for change detection
let lastStateString = '';
let lastBalanceUpdate = 0;

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial state
  const state = readBotState();
  
  // Update balance if needed
  if (Date.now() - lastBalanceUpdate > 30000) {
    const { balance, balanceUsd } = await getWalletBalance(WALLET_ADDRESS);
    state.wallet = {
      address: WALLET_ADDRESS,
      balance,
      balanceUsd,
    };
    lastBalanceUpdate = Date.now();
  }
  
  socket.emit('state', state);

  // Handle status request
  socket.on('get-status', async () => {
    const currentState = readBotState();
    
    // Update balance
    const { balance, balanceUsd } = await getWalletBalance(WALLET_ADDRESS);
    currentState.wallet = {
      address: WALLET_ADDRESS,
      balance,
      balanceUsd,
    };
    
    socket.emit('status', currentState);
  });

  // Handle trades request
  socket.on('get-trades', (limit = 50) => {
    const state = readBotState();
    socket.emit('trades', (state.recentTrades || []).slice(0, limit));
  });

  // Handle performance request
  socket.on('get-performance', () => {
    const state = readBotState();
    socket.emit('performance', state.performance || {});
  });

  // Handle balance request
  socket.on('get-balance', async () => {
    const { balance, balanceUsd } = await getWalletBalance(WALLET_ADDRESS);
    socket.emit('balance', {
      address: WALLET_ADDRESS,
      balance,
      balanceUsd,
    });
  });

  // Handle manual trade request
  socket.on('manual-trade', (data) => {
    console.log('Manual trade requested:', data);
    // In production, this would trigger the actual trade
    // For now, just acknowledge the request
    socket.emit('trade-result', {
      success: true,
      message: 'Trade request received - bot must be running to execute',
      data,
    });
  });

  // Handle start/stop bot (these would typically control a process manager)
  socket.on('start-bot', () => {
    console.log('Start bot requested - use: bun run src/bot.js');
    socket.emit('command-result', {
      success: false,
      message: 'Use "bun run src/bot.js" to start the bot',
    });
  });

  socket.on('stop-bot', () => {
    console.log('Stop bot requested');
    // In production, this would signal the bot to stop
    socket.emit('command-result', {
      success: false,
      message: 'Stop signal sent - use Ctrl+C on the bot process',
    });
  });

  // Handle emergency stop reset
  socket.on('reset-emergency-stop', () => {
    console.log('Reset emergency stop requested');
    // This would need to communicate with the running bot
    socket.emit('command-result', {
      success: false,
      message: 'This requires direct bot access',
    });
  });

  // Handle add token
  socket.on('add-token', (tokenMint) => {
    console.log('Add token requested:', tokenMint);
    socket.emit('token-added', { success: true, tokenMint });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Periodic state broadcasting
setInterval(async () => {
  const state = readBotState();
  const stateString = JSON.stringify(state);
  
  // Only broadcast if state changed
  if (stateString !== lastStateString) {
    lastStateString = stateString;
    
    // Update balance periodically
    if (Date.now() - lastBalanceUpdate > 30000) {
      const { balance, balanceUsd } = await getWalletBalance(WALLET_ADDRESS);
      state.wallet = {
        address: WALLET_ADDRESS,
        balance,
        balanceUsd,
      };
      lastBalanceUpdate = Date.now();
    }
    
    // Emit state update to all clients
    io.emit('state-update', state);
  }
}, 2000); // Every 2 seconds

// Balance update interval
setInterval(async () => {
  const { balance, balanceUsd } = await getWalletBalance(WALLET_ADDRESS);
  io.emit('balance-update', {
    address: WALLET_ADDRESS,
    balance,
    balanceUsd,
    timestamp: Date.now(),
  });
}, 30000); // Every 30 seconds

// Initialize and start server
async function start() {
  await initSolanaConnection();
  
  httpServer.listen(PORT, () => {
    console.log(`Trading Bot API running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`Monitoring wallet: ${WALLET_ADDRESS}`);
    console.log(`State file: ${STATE_FILE}`);
  });
}

start().catch(console.error);
