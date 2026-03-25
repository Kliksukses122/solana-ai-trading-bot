/**
 * Enhanced Learning Service - Self-improving trading intelligence
 * Tracks detailed trade data for performance analysis
 */

// === IN-MEMORY STORAGE ===
const tradeMemory: DetailedTradeRecord[] = []
const tokenPerformance: Map<string, TokenStats> = new Map()
const strategyPerformance: Map<string, StrategyStats> = new Map()
const dailyStats: Map<string, DailyStats> = new Map()
const patternMemory: PatternRecord[] = []

// === INTERFACES ===
interface DetailedTradeRecord {
  id: string
  timestamp: number
  token: {
    symbol: string
    mint: string
    name: string
  }
  action: 'BUY' | 'SELL'
  amount: number
  entryPrice: number
  exitPrice?: number
  exitTimestamp?: number
  outcome?: 'WIN' | 'LOSS' | 'PENDING'
  profitPercent?: number
  profit?: number
  
  // Risk Management
  stopLoss: number
  takeProfit: number
  riskRewardRatio: number
  positionSizePct: number
  
  // AI Data
  aiScore: number
  aiConfidence: number
  aiRecommendation: string
  
  // Market Context
  marketCondition: 'BULL' | 'BEAR' | 'CHOPPY' | 'VOLATILE'
  solTrend: 'UP' | 'DOWN' | 'SIDEWAYS'
  btcTrend: 'UP' | 'DOWN' | 'SIDEWAYS'
  
  // Token Metrics at Entry
  tokenMetrics: {
    priceChange5m: number
    priceChange1h: number
    priceChange24h: number
    volumeSpike: number
    rsi: number
    liquidityDepth: number
    spread: number
    volatility: number
  }
  
  // Exit Data
  exitReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'MANUAL' | 'TIMEOUT'
  holdDuration?: number
  maxDrawdown?: number
  maxProfit?: number
}

interface TokenStats {
  symbol: string
  totalTrades: number
  wins: number
  losses: number
  totalProfit: number
  avgProfitPercent: number
  winRate: number
  lastTradeTimestamp: number
  bestTrade: number
  worstTrade: number
  avgHoldDuration: number
  avgWinSize: number
  avgLossSize: number
  profitFactor: number
}

interface StrategyStats {
  name: string
  totalTrades: number
  wins: number
  totalProfit: number
  winRate: number
  avgProfit: number
  profitFactor: number
}

interface DailyStats {
  date: string
  totalTrades: number
  wins: number
  losses: number
  totalPnL: number
  maxDrawdown: number
  bestTrade: number
  worstTrade: number
  winRate: number
}

interface PatternRecord {
  id: string
  conditions: {
    aiScoreRange: [number, number]
    rsiRange: [number, number]
    volumeSpikeRange: [number, number]
    marketCondition: string
    trendAlignment: boolean
  }
  outcome: 'WIN' | 'LOSS' | 'PENDING'
  profit: number
  count: number
  winRate: number
}

export interface EnhancedLearningInsights {
  overallStats: {
    totalTrades: number
    wins: number
    losses: number
    pending: number
    totalProfit: number
    winRate: number
    profitFactor: number
    avgWin: number
    avgLoss: number
    maxDrawdown: number
  }
  bestTokens: { symbol: string; winRate: number; avgProfit: number; trades: number }[]
  worstTokens: { symbol: string; winRate: number; avgLoss: number; trades: number }[]
  bestStrategies: { name: string; winRate: number; avgProfit: number }[]
  bestScoreRange: [number, number]
  optimalHoldDuration: number
  winRateTrend: number
  recentPerformance: number
  learnedRules: string[]
  dailyPerformance: { date: string; pnl: number; winRate: number }[]
  riskAnalysis: {
    maxDrawdownTrend: number
    profitFactorTrend: number
    riskAdjustedReturn: number
  }
}

// === RECORD TRADE ===
export function recordDetailedTrade(trade: Omit<DetailedTradeRecord, 'id' | 'timestamp'>): string {
  const id = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  const record: DetailedTradeRecord = {
    ...trade,
    id,
    timestamp: Date.now(),
    outcome: 'PENDING'
  }
  
  tradeMemory.push(record)
  console.log(`[Learning] Recorded trade: ${trade.token.symbol} ${trade.action}`)
  console.log(`  Entry: ${trade.entryPrice}, SL: ${trade.stopLoss}, TP: ${trade.takeProfit}`)
  console.log(`  R:R: ${trade.riskRewardRatio.toFixed(2)}, Confidence: ${trade.aiConfidence}%`)
  
  return id
}

// === UPDATE TRADE OUTCOME ===
export function updateTradeOutcomeEnhanced(
  tradeId: string,
  outcome: 'WIN' | 'LOSS',
  exitPrice: number,
  profitPercent: number,
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'MANUAL' | 'TIMEOUT'
): void {
  const trade = tradeMemory.find(t => t.id === tradeId)
  if (!trade) return
  
  trade.outcome = outcome
  trade.exitPrice = exitPrice
  trade.exitTimestamp = Date.now()
  trade.profitPercent = profitPercent
  trade.profit = trade.amount * profitPercent
  trade.exitReason = exitReason
  trade.holdDuration = trade.exitTimestamp - trade.timestamp
  
  // Update token stats
  updateTokenStatsEnhanced(trade)
  
  // Update daily stats
  updateDailyStats(trade)
  
  // Record pattern
  recordPatternEnhanced(trade)
  
  console.log(`[Learning] Updated trade ${tradeId}:`)
  console.log(`  Outcome: ${outcome} (${profitPercent > 0 ? '+' : ''}${(profitPercent * 100).toFixed(2)}%)`)
  console.log(`  Exit Reason: ${exitReason}`)
  console.log(`  Hold Duration: ${(trade.holdDuration / 60000).toFixed(1)} minutes`)
}

// === UPDATE TOKEN STATS ENHANCED ===
function updateTokenStatsEnhanced(trade: DetailedTradeRecord): void {
  const symbol = trade.token.symbol
  let stats = tokenPerformance.get(symbol)
  
  if (!stats) {
    stats = {
      symbol,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalProfit: 0,
      avgProfitPercent: 0,
      winRate: 0,
      lastTradeTimestamp: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgHoldDuration: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      profitFactor: 0
    }
  }
  
  stats.totalTrades++
  stats.lastTradeTimestamp = trade.timestamp
  
  if (trade.outcome === 'WIN') {
    stats.wins++
    stats.bestTrade = Math.max(stats.bestTrade, trade.profitPercent || 0)
    stats.avgWinSize = ((stats.avgWinSize * (stats.wins - 1)) + (trade.profitPercent || 0)) / stats.wins
  } else if (trade.outcome === 'LOSS') {
    stats.losses++
    stats.worstTrade = Math.min(stats.worstTrade, trade.profitPercent || 0)
    stats.avgLossSize = ((stats.avgLossSize * (stats.losses - 1)) + Math.abs(trade.profitPercent || 0)) / stats.losses
  }
  
  stats.totalProfit += trade.profit || 0
  stats.winRate = stats.wins / stats.totalTrades
  stats.avgProfitPercent = (stats.avgProfitPercent * (stats.totalTrades - 1) + (trade.profitPercent || 0)) / stats.totalTrades
  
  if (trade.holdDuration) {
    stats.avgHoldDuration = (stats.avgHoldDuration * (stats.totalTrades - 1) + trade.holdDuration) / stats.totalTrades
  }
  
  // Calculate profit factor
  const totalWins = stats.avgWinSize * stats.wins
  const totalLosses = stats.avgLossSize * stats.losses
  stats.profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  
  tokenPerformance.set(symbol, stats)
}

// === UPDATE DAILY STATS ===
function updateDailyStats(trade: DetailedTradeRecord): void {
  const date = new Date(trade.timestamp).toISOString().split('T')[0]
  let stats = dailyStats.get(date)
  
  if (!stats) {
    stats = {
      date,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0,
      maxDrawdown: 0,
      bestTrade: 0,
      worstTrade: 0,
      winRate: 0
    }
  }
  
  stats.totalTrades++
  if (trade.outcome === 'WIN') stats.wins++
  if (trade.outcome === 'LOSS') stats.losses++
  
  stats.totalPnL += trade.profit || 0
  stats.winRate = stats.wins / stats.totalTrades
  stats.bestTrade = Math.max(stats.bestTrade, trade.profitPercent || 0)
  stats.worstTrade = Math.min(stats.worstTrade, trade.profitPercent || 0)
  stats.maxDrawdown = Math.min(stats.maxDrawdown, stats.totalPnL)
  
  dailyStats.set(date, stats)
}

// === RECORD PATTERN ENHANCED ===
function recordPatternEnhanced(trade: DetailedTradeRecord): void {
  const conditions = {
    aiScoreRange: [Math.floor(trade.aiScore), Math.ceil(trade.aiScore)] as [number, number],
    rsiRange: [Math.floor(trade.tokenMetrics.rsi / 10) * 10, Math.floor(trade.tokenMetrics.rsi / 10) * 10 + 10] as [number, number],
    volumeSpikeRange: [Math.floor(trade.tokenMetrics.volumeSpike / 100) * 100, Math.floor(trade.tokenMetrics.volumeSpike / 100) * 100 + 100] as [number, number],
    marketCondition: trade.marketCondition,
    trendAlignment: trade.solTrend === trade.btcTrend
  }
  
  const existingPattern = patternMemory.find(p => 
    p.conditions.aiScoreRange[0] === conditions.aiScoreRange[0] &&
    p.conditions.rsiRange[0] === conditions.rsiRange[0] &&
    p.conditions.marketCondition === conditions.marketCondition
  )
  
  if (existingPattern) {
    existingPattern.count++
    existingPattern.profit += trade.profit || 0
    if (trade.outcome === 'WIN') {
      existingPattern.winRate = (existingPattern.winRate * (existingPattern.count - 1) + 1) / existingPattern.count
    }
  } else {
    patternMemory.push({
      id: `pattern-${Date.now()}`,
      conditions,
      outcome: trade.outcome || 'PENDING',
      profit: trade.profit || 0,
      count: 1,
      winRate: trade.outcome === 'WIN' ? 1 : 0
    })
  }
}

// === GET ENHANCED LEARNING INSIGHTS ===
export function getEnhancedLearningInsights(): EnhancedLearningInsights {
  const tokens = Array.from(tokenPerformance.values())
  const strategies = Array.from(strategyPerformance.values())
  const dailyStatsArray = Array.from(dailyStats.values())
  
  // Overall stats
  const wins = tradeMemory.filter(t => t.outcome === 'WIN').length
  const losses = tradeMemory.filter(t => t.outcome === 'LOSS').length
  const pending = tradeMemory.filter(t => t.outcome === 'PENDING').length
  const totalProfit = tradeMemory.reduce((sum, t) => sum + (t.profit || 0), 0)
  const totalWins = tradeMemory.filter(t => t.outcome === 'WIN').reduce((sum, t) => sum + (t.profit || 0), 0)
  const totalLosses = Math.abs(tradeMemory.filter(t => t.outcome === 'LOSS').reduce((sum, t) => sum + (t.profit || 0), 0))
  
  const winRate = wins + losses > 0 ? wins / (wins + losses) : 0
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  
  // Best/worst tokens
  const bestTokens = tokens
    .filter(t => t.totalTrades >= 2 && t.winRate > 0.5)
    .sort((a, b) => b.profitFactor - a.profitFactor)
    .slice(0, 5)
    .map(t => ({ symbol: t.symbol, winRate: t.winRate, avgProfit: t.avgProfitPercent, trades: t.totalTrades }))
  
  const worstTokens = tokens
    .filter(t => t.totalTrades >= 2 && t.winRate < 0.5)
    .sort((a, b) => a.profitFactor - b.profitFactor)
    .slice(0, 5)
    .map(t => ({ symbol: t.symbol, winRate: t.winRate, avgLoss: t.avgProfitPercent, trades: t.totalTrades }))
  
  // Best AI score range
  const winningTrades = tradeMemory.filter(t => t.outcome === 'WIN')
  const scoreAnalysis = winningTrades.reduce((acc, t) => {
    const score = Math.floor(t.aiScore)
    acc[score] = (acc[score] || 0) + 1
    return acc
  }, {} as Record<number, number>)
  
  const bestScore = Object.entries(scoreAnalysis).sort((a, b) => b[1] - a[1])[0]
  
  // Calculate trends
  const recentTrades = tradeMemory.filter(t => t.outcome !== 'PENDING').slice(-10)
  const previousTrades = tradeMemory.filter(t => t.outcome !== 'PENDING').slice(-20, -10)
  
  const recentWinRate = recentTrades.length > 0 
    ? recentTrades.filter(t => t.outcome === 'WIN').length / recentTrades.length 
    : 0
  const previousWinRate = previousTrades.length > 0
    ? previousTrades.filter(t => t.outcome === 'WIN').length / previousTrades.length
    : recentWinRate
  
  const winRateTrend = recentWinRate - previousWinRate
  const recentPerformance = recentTrades.slice(-5).reduce((sum, t) => sum + (t.profitPercent || 0), 0) / 5
  
  // Generate learned rules
  const learnedRules: string[] = []
  
  if (bestTokens.length > 0) {
    learnedRules.push(`Best performing tokens: ${bestTokens.map(t => t.symbol).join(', ')}`)
  }
  
  if (worstTokens.length > 0) {
    learnedRules.push(`Avoid tokens: ${worstTokens.map(t => t.symbol).join(', ')}`)
  }
  
  if (bestScore) {
    learnedRules.push(`Best AI score range: ${bestScore[0]}/10`)
  }
  
  // Pattern-based rules
  const profitablePatterns = patternMemory.filter(p => p.count >= 3 && p.winRate > 0.6)
  profitablePatterns.forEach(p => {
    learnedRules.push(`Pattern works: Score ${p.conditions.aiScoreRange[0]}+ in ${p.conditions.marketCondition} = ${(p.winRate * 100).toFixed(0)}% win rate`)
  })
  
  if (winRateTrend < -0.1) {
    learnedRules.push('WARNING: Performance declining - reduce position sizes')
  } else if (winRateTrend > 0.1) {
    learnedRules.push('Performance improving - strategy working well')
  }
  
  // Risk analysis
  const maxDrawdown = Math.min(...dailyStatsArray.map(d => d.maxDrawdown))
  const avgDailyPnL = dailyStatsArray.length > 0 
    ? dailyStatsArray.reduce((sum, d) => sum + d.totalPnL, 0) / dailyStatsArray.length 
    : 0
  const riskAdjustedReturn = maxDrawdown !== 0 ? avgDailyPnL / Math.abs(maxDrawdown) : 0
  
  // Optimal hold duration
  const winningWithDuration = winningTrades.filter(t => t.holdDuration)
  const optimalHoldDuration = winningWithDuration.length > 0
    ? winningWithDuration.reduce((sum, t) => sum + (t.holdDuration || 0), 0) / winningWithDuration.length
    : 60000
  
  return {
    overallStats: {
      totalTrades: tradeMemory.length,
      wins,
      losses,
      pending,
      totalProfit,
      winRate,
      profitFactor,
      avgWin: wins > 0 ? totalWins / wins : 0,
      avgLoss: losses > 0 ? totalLosses / losses : 0,
      maxDrawdown
    },
    bestTokens,
    worstTokens,
    bestStrategies: strategies
      .filter(s => s.totalTrades >= 2)
      .sort((a, b) => b.profitFactor - a.profitFactor)
      .map(s => ({ name: s.name, winRate: s.winRate, avgProfit: s.avgProfit })),
    bestScoreRange: bestScore ? [parseInt(bestScore[0]), parseInt(bestScore[0]) + 1] : [7, 10],
    optimalHoldDuration,
    winRateTrend,
    recentPerformance,
    learnedRules,
    dailyPerformance: dailyStatsArray.slice(-7).map(d => ({ date: d.date, pnl: d.totalPnL, winRate: d.winRate })),
    riskAnalysis: {
      maxDrawdownTrend: 0,
      profitFactorTrend: 0,
      riskAdjustedReturn
    }
  }
}

// === GET TOKEN LEARNING ===
export function getTokenLearningEnhanced(symbol: string): TokenStats | null {
  return tokenPerformance.get(symbol) || null
}

// === CHECK TOKEN BLACKLIST ===
export function isTokenBlacklistedEnhanced(symbol: string): boolean {
  const stats = tokenPerformance.get(symbol)
  if (!stats || stats.totalTrades < 3) return false
  return stats.winRate < 0.3 && stats.totalTrades >= 3
}

// === GET TRADE HISTORY ===
export function getTradeHistoryEnhanced(limit: number = 50): DetailedTradeRecord[] {
  return tradeMemory.slice(-limit)
}

// === EXPORT TRADE LOG ===
export function exportTradeLog(): string {
  return JSON.stringify({
    trades: tradeMemory,
    tokenStats: Array.from(tokenPerformance.entries()),
    dailyStats: Array.from(dailyStats.entries()),
    patterns: patternMemory,
    exportedAt: new Date().toISOString()
  }, null, 2)
}

// === CLEAR MEMORY ===
export function clearMemoryEnhanced(): void {
  tradeMemory.length = 0
  tokenPerformance.clear()
  strategyPerformance.clear()
  dailyStats.clear()
  patternMemory.length = 0
  console.log('[Learning] All memory cleared')
}

// Re-export for backward compatibility
export { 
  recordDetailedTrade as recordTrade,
  updateTradeOutcomeEnhanced as updateTradeOutcome,
  getTokenLearningEnhanced as getTokenLearning,
  isTokenBlacklistedEnhanced as isTokenBlacklisted,
  getTradeHistoryEnhanced as getTradeHistory
}

export type { DetailedTradeRecord, TokenStats }
