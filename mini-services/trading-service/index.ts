import { Server } from 'socket.io';
import { createServer } from 'http';

const PORT = 3003;

// Simulated trading bot state
const tradingState = {
  status: 'RUNNING',
  mode: 'MOCK',
  balance: 10.5,
  totalPnL: 2.34,
  totalTrades: 156,
  winRate: 0.62,
  currentDrawdown: 0.04,
  
  strategies: {
    SNIPER: { trades: 45, wins: 28, pnl: 1.12, enabled: true },
    WHALE: { trades: 52, wins: 33, pnl: 0.89, enabled: true },
    MOMENTUM: { trades: 38, wins: 22, pnl: 0.45, enabled: true },
    COMBO: { trades: 21, wins: 14, pnl: -0.12, enabled: true },
  },
  
  adaptiveConfig: {
    minScore: 6,
    takeProfit: 8,
    stopLoss: 2,
    tradeSize: 1.2,
    weights: { whale: 5, early: 3, momentum: 2, volume: 2, liquidity: 2, combo: 3 },
  },
  
  learning: {
    enabled: true,
    learningInterval: 20,
    lastLearningTime: Date.now() - 3600000,
    learningCount: 7,
  },
  
  recentTrades: [] as any[],
  signals: [] as any[],
  agentLogs: [] as any[],
};

// Generate mock tokens
const mockTokens = [
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'POPCAT', name: 'Popcat', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { symbol: 'MYRO', name: 'Myro', mint: 'HhTWcZwVcKmtIYcPdNGqy6XbHHZBj6c9zG2fVNqXkFZY' },
  { symbol: 'SAMO', name: 'Samoyedcoin', mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
];

const strategies = ['SNIPER', 'WHALE', 'MOMENTUM', 'COMBO'];
const decisions = ['STRONG_BUY', 'BUY', 'SMALL_BUY'];

// Generate random trade
function generateTrade() {
  const token = mockTokens[Math.floor(Math.random() * mockTokens.length)];
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const decision = decisions[Math.floor(Math.random() * decisions.length)];
  const score = Math.floor(Math.random() * 8) + 4;
  const entryPrice = Math.random() * 0.0001 + 0.00001;
  const profitPercent = (Math.random() - 0.4) * 0.15;
  const exitPrice = entryPrice * (1 + profitPercent);
  
  return {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    token,
    strategy,
    decision,
    score,
    entryPrice,
    exitPrice,
    profitPercent,
    profit: profitPercent * tradingState.balance * 0.01,
    duration: Math.floor(Math.random() * 1800000) + 60000,
    status: profitPercent > 0 ? 'WIN' : 'LOSS',
  };
}

// Generate signal
function generateSignal() {
  const token = mockTokens[Math.floor(Math.random() * mockTokens.length)];
  const signals = ['WHALE_BUY', 'VOLUME_SPIKE', 'NEW_TOKEN', 'MOMENTUM_UP', 'COMBO_DETECTED'];
  const signal = signals[Math.floor(Math.random() * signals.length)];
  
  return {
    id: `sig-${Date.now()}`,
    timestamp: Date.now(),
    token,
    signal,
    strength: Math.floor(Math.random() * 5) + 1,
    processed: false,
  };
}

// Generate agent log
function generateAgentLog() {
  const agents = ['Scout', 'Analyst', 'Risk', 'Trader', 'Manager', 'Learning'];
  const agent = agents[Math.floor(Math.random() * agents.length)];
  
  const messages: Record<string, string[]> = {
    Scout: ['Scanning for new tokens...', 'Whale movement detected!', 'Volume spike on WIF', 'New token listed: XYZ'],
    Analyst: ['Analyzing token metrics...', 'Score calculated: 7.5', 'Strong buy signal confirmed', 'Risk assessment complete'],
    Risk: ['Checking risk parameters...', 'Position size approved: 0.02 SOL', 'Max drawdown check passed', 'Daily limit: 5/15 trades'],
    Trader: ['Executing trade...', 'Order filled successfully', 'Position opened', 'Setting stop loss at -2%'],
    Manager: ['Monitoring positions...', 'Take profit triggered!', 'Position closed: +5.2%', 'Rebalancing portfolio'],
    Learning: ['Running learning cycle...', 'Adapted: minScore +0.5', 'Win rate analysis: 62%', 'Strategy bias updated'],
  };
  
  const agentMessages = messages[agent];
  const message = agentMessages[Math.floor(Math.random() * agentMessages.length)];
  
  return {
    id: `log-${Date.now()}`,
    timestamp: Date.now(),
    agent,
    message,
    type: message.includes('!') || message.includes('Success') ? 'success' : 'info',
  };
}

// Create HTTP server and Socket.io
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Trading Service] Client connected: ${socket.id}`);
  
  // Send initial state
  socket.emit('state', tradingState);
  
  // Handle commands
  socket.on('start', () => {
    tradingState.status = 'RUNNING';
    io.emit('status', tradingState.status);
    io.emit('log', { agent: 'Manager', message: '🚀 Bot started', type: 'success' });
  });
  
  socket.on('stop', () => {
    tradingState.status = 'STOPPED';
    io.emit('status', tradingState.status);
    io.emit('log', { agent: 'Manager', message: '⏹️ Bot stopped', type: 'warning' });
  });
  
  socket.on('forceLearn', () => {
    tradingState.learning.learningCount++;
    tradingState.learning.lastLearningTime = Date.now();
    io.emit('learning', tradingState.learning);
    io.emit('log', { agent: 'Learning', message: '🧠 Force learning triggered', type: 'info' });
  });
  
  socket.on('toggleStrategy', (strategy: string) => {
    if (tradingState.strategies[strategy as keyof typeof tradingState.strategies]) {
      tradingState.strategies[strategy as keyof typeof tradingState.strategies].enabled = 
        !tradingState.strategies[strategy as keyof typeof tradingState.strategies].enabled;
      io.emit('strategies', tradingState.strategies);
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`[Trading Service] Client disconnected: ${socket.id}`);
  });
});

// Simulation loop - generate events periodically
setInterval(() => {
  if (tradingState.status !== 'RUNNING') return;
  
  // Generate signal (30% chance)
  if (Math.random() < 0.3) {
    const signal = generateSignal();
    tradingState.signals.unshift(signal);
    if (tradingState.signals.length > 10) tradingState.signals.pop();
    io.emit('signal', signal);
    
    const log = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agent: 'Scout',
      message: `📡 ${signal.signal} detected on ${signal.token.symbol}`,
      type: 'info',
    };
    tradingState.agentLogs.unshift(log);
    if (tradingState.agentLogs.length > 20) tradingState.agentLogs.pop();
    io.emit('log', log);
  }
  
  // Generate trade (15% chance)
  if (Math.random() < 0.15) {
    const trade = generateTrade();
    tradingState.recentTrades.unshift(trade);
    if (tradingState.recentTrades.length > 20) tradingState.recentTrades.pop();
    
    // Update stats
    tradingState.totalTrades++;
    tradingState.totalPnL += trade.profit;
    tradingState.balance += trade.profit;
    if (trade.status === 'WIN') {
      tradingState.strategies[trade.strategy as keyof typeof tradingState.strategies].wins++;
    }
    tradingState.strategies[trade.strategy as keyof typeof tradingState.strategies].trades++;
    tradingState.strategies[trade.strategy as keyof typeof tradingState.strategies].pnl += trade.profit;
    tradingState.winRate = tradingState.recentTrades.filter(t => t.status === 'WIN').length / tradingState.recentTrades.length;
    
    io.emit('trade', trade);
    io.emit('state', tradingState);
    
    const log = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agent: 'Trader',
      message: `${trade.status === 'WIN' ? '✅' : '❌'} ${trade.token.symbol} ${trade.strategy}: ${trade.profitPercent > 0 ? '+' : ''}${(trade.profitPercent * 100).toFixed(2)}%`,
      type: trade.status === 'WIN' ? 'success' : 'error',
    };
    tradingState.agentLogs.unshift(log);
    if (tradingState.agentLogs.length > 20) tradingState.agentLogs.pop();
    io.emit('log', log);
  }
  
  // Generate agent log (40% chance)
  if (Math.random() < 0.4) {
    const log = generateAgentLog();
    tradingState.agentLogs.unshift(log);
    if (tradingState.agentLogs.length > 20) tradingState.agentLogs.pop();
    io.emit('log', log);
  }
  
  // Simulate learning (every ~2 minutes in real time)
  if (Math.random() < 0.02) {
    tradingState.learning.learningCount++;
    tradingState.learning.lastLearningTime = Date.now();
    
    // Simulate config adaptation
    if (Math.random() > 0.5) {
      tradingState.adaptiveConfig.minScore += (Math.random() - 0.5) * 1;
      tradingState.adaptiveConfig.minScore = Math.max(4, Math.min(10, tradingState.adaptiveConfig.minScore));
    }
    
    io.emit('learning', tradingState.learning);
    io.emit('config', tradingState.adaptiveConfig);
    
    const log = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agent: 'Learning',
      message: `🧠 Learning cycle #${tradingState.learning.learningCount}: Win rate ${(tradingState.winRate * 100).toFixed(1)}%`,
      type: 'info',
    };
    tradingState.agentLogs.unshift(log);
    if (tradingState.agentLogs.length > 20) tradingState.agentLogs.pop();
    io.emit('log', log);
  }
  
}, 2000);

httpServer.listen(PORT, () => {
  console.log(`[Trading Service] Running on port ${PORT}`);
});
