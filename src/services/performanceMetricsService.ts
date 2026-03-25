/**
 * Performance Metrics Service - Dashboard metrik trading lengkap
 * Track win rate, Sharpe ratio, max drawdown, dan metrik penting lainnya
 */

export interface TradeRecord {
  id: string
  timestamp: number
  symbol: string
  side: 'BUY' | 'SELL'
  entryPrice: number
  exitPrice: number
  amount: number
  value: number
  pnl: number
  pnlPercent: number
  fees: number
  holdDuration: number // milliseconds
  outcome: 'WIN' | 'LOSS' | 'BREAK_EVEN'
  strategy: string
  confidence: number
  marketCondition: 'BULL' | 'BEAR' | 'CHOPPY'
}

export interface PerformanceMetrics {
  // Basic Stats
  totalTrades: number
  openTrades: number
  closedTrades: number
  winCount: number
  lossCount: number
  breakEvenCount: number
  winRate: number
  
  // Profit Metrics
  totalPnL: number
  totalPnLPercent: number
  totalFees: number
  netPnL: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  avgTrade: number
  
  // Risk Metrics
  maxDrawdown: number
  maxDrawdownDuration: number
  currentDrawdown: number
  avgDrawdown: number
  
  // Ratio Metrics
  profitFactor: number
  sharpeRatio: number
  sortinoRatio: number
  calmarRatio: number
  riskRewardRatio: number
  expectancy: number
  
  // Time Metrics
  avgHoldTime: number
  medianHoldTime: number
  tradesPerDay: number
  avgTradesPerWin: number
  
  // Strategy Metrics
  bestStrategy: string
  worstStrategy: string
  bestTimeToTrade: number // hour of day
  worstTimeToTrade: number
  
  // Recent Performance
  last7Days: {
    trades: number
    pnl: number
    winRate: number
  }
  last30Days: {
    trades: number
    pnl: number
    winRate: number
  }
  
  // Score & Grade
  overallScore: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendation: string
}

export interface EquityPoint {
  timestamp: number
  equity: number
  drawdown: number
}

export interface DailyStats {
  date: string
  trades: number
  pnl: number
  winRate: number
  drawdown: number
}

// In-memory storage
const tradeHistory: TradeRecord[] = []
let initialBalance = 100
let currentBalance = 100
const equityCurve: EquityPoint[] = []

// === INITIALIZE ===
export function initPerformanceTracker(startingBalance: number): void {
  initialBalance = startingBalance
  currentBalance = startingBalance
  tradeHistory.length = 0
  equityCurve.length = 0
  equityCurve.push({ timestamp: Date.now(), equity: startingBalance, drawdown: 0 })
  console.log(`[Performance] Initialized with ${startingBalance} SOL`)
}

// === RECORD TRADE ===
export function recordTrade(trade: Omit<TradeRecord, 'id' | 'outcome'>): string {
  const id = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  
  // Determine outcome
  let outcome: 'WIN' | 'LOSS' | 'BREAK_EVEN'
  if (trade.pnl > 0.001) outcome = 'WIN'
  else if (trade.pnl < -0.001) outcome = 'LOSS'
  else outcome = 'BREAK_EVEN'
  
  const record: TradeRecord = {
    ...trade,
    id,
    outcome
  }
  
  tradeHistory.push(record)
  
  // Update balance
  currentBalance += trade.pnl - trade.fees
  
  // Update equity curve
  const lastEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : initialBalance
  const peak = Math.max(...equityCurve.map(e => e.equity), currentBalance)
  const drawdown = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0
  
  equityCurve.push({
    timestamp: trade.timestamp,
    equity: currentBalance,
    drawdown
  })
  
  console.log(`[Performance] Recorded: ${trade.symbol} ${outcome} | PnL: ${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(4)} SOL`)
  
  return id
}

// === CALCULATE METRICS ===
export function calculateMetrics(): PerformanceMetrics {
  const closedTrades = tradeHistory.filter(t => t.outcome !== undefined)
  const wins = closedTrades.filter(t => t.outcome === 'WIN')
  const losses = closedTrades.filter(t => t.outcome === 'LOSS')
  const breakEvens = closedTrades.filter(t => t.outcome === 'BREAK_EVEN')
  
  const totalTrades = tradeHistory.length
  const winCount = wins.length
  const lossCount = losses.length
  const winRate = closedTrades.length > 0 ? winCount / closedTrades.length : 0
  
  // Profit metrics
  const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0)
  const totalPnLPercent = (totalPnL / initialBalance) * 100
  const totalFees = closedTrades.reduce((sum, t) => sum + t.fees, 0)
  const netPnL = totalPnL - totalFees
  
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0
  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0
  const avgTrade = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0
  
  // Risk metrics
  const maxDrawdown = Math.max(...equityCurve.map(e => e.drawdown), 0)
  const currentDrawdown = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].drawdown : 0
  const avgDrawdown = equityCurve.reduce((sum, e) => sum + e.drawdown, 0) / equityCurve.length
  
  // Max drawdown duration
  let maxDDDuration = 0
  let currentDDStart = -1
  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i].drawdown > 0) {
      if (currentDDStart === -1) currentDDStart = i
    } else {
      if (currentDDStart !== -1) {
        maxDDDuration = Math.max(maxDDDuration, i - currentDDStart)
        currentDDStart = -1
      }
    }
  }
  
  // Ratio metrics
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0)
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  
  // Sharpe Ratio
  const returns = closedTrades.map(t => t.pnlPercent)
  const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
  const variance = returns.length > 1 
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1) 
    : 0
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0
  
  // Sortino Ratio
  const negativeReturns = returns.filter(r => r < 0)
  const downsideDeviation = negativeReturns.length > 0
    ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
    : 0
  const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0
  
  // Calmar Ratio
  const calmarRatio = maxDrawdown > 0 ? totalPnLPercent / maxDrawdown : 0
  
  // Risk Reward Ratio
  const riskRewardRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0
  
  // Expectancy
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss
  
  // Time metrics
  const holdTimes = closedTrades.map(t => t.holdDuration).filter(t => t > 0)
  const avgHoldTime = holdTimes.length > 0 
    ? holdTimes.reduce((sum, t) => sum + t, 0) / holdTimes.length 
    : 0
  
  // Median hold time
  const sortedHoldTimes = [...holdTimes].sort((a, b) => a - b)
  const medianHoldTime = sortedHoldTimes.length > 0
    ? sortedHoldTimes[Math.floor(sortedHoldTimes.length / 2)]
    : 0
  
  // Trades per day
  const firstTrade = tradeHistory.length > 0 ? tradeHistory[0].timestamp : Date.now()
  const daysSinceStart = Math.max(1, (Date.now() - firstTrade) / (24 * 60 * 60 * 1000))
  const tradesPerDay = totalTrades / daysSinceStart
  
  // Avg trades per win
  const avgTradesPerWin = winCount > 0 ? totalTrades / winCount : 0
  
  // Strategy analysis
  const strategyStats = new Map<string, { trades: number; pnl: number }>()
  for (const trade of closedTrades) {
    const stats = strategyStats.get(trade.strategy) || { trades: 0, pnl: 0 }
    stats.trades++
    stats.pnl += trade.pnl
    strategyStats.set(trade.strategy, stats)
  }
  
  let bestStrategy = ''
  let worstStrategy = ''
  let bestPnL = -Infinity
  let worstPnL = Infinity
  
  strategyStats.forEach((stats, strategy) => {
    if (stats.pnl > bestPnL) {
      bestPnL = stats.pnl
      bestStrategy = strategy
    }
    if (stats.pnl < worstPnL) {
      worstPnL = stats.pnl
      worstStrategy = strategy
    }
  })
  
  // Time of day analysis
  const hourlyStats = new Map<number, { trades: number; pnl: number }>()
  for (const trade of closedTrades) {
    const hour = new Date(trade.timestamp).getHours()
    const stats = hourlyStats.get(hour) || { trades: 0, pnl: 0 }
    stats.trades++
    stats.pnl += trade.pnl
    hourlyStats.set(hour, stats)
  }
  
  let bestTimeToTrade = 0
  let worstTimeToTrade = 0
  let bestHourPnL = -Infinity
  let worstHourPnL = Infinity
  
  hourlyStats.forEach((stats, hour) => {
    if (stats.pnl > bestHourPnL) {
      bestHourPnL = stats.pnl
      bestTimeToTrade = hour
    }
    if (stats.pnl < worstHourPnL) {
      worstHourPnL = stats.pnl
      worstTimeToTrade = hour
    }
  })
  
  // Recent performance
  const now = Date.now()
  const last7DaysTrades = closedTrades.filter(t => t.timestamp > now - 7 * 24 * 60 * 60 * 1000)
  const last30DaysTrades = closedTrades.filter(t => t.timestamp > now - 30 * 24 * 60 * 60 * 1000)
  
  const last7Days = {
    trades: last7DaysTrades.length,
    pnl: last7DaysTrades.reduce((sum, t) => sum + t.pnl, 0),
    winRate: last7DaysTrades.length > 0 
      ? last7DaysTrades.filter(t => t.outcome === 'WIN').length / last7DaysTrades.length 
      : 0
  }
  
  const last30Days = {
    trades: last30DaysTrades.length,
    pnl: last30DaysTrades.reduce((sum, t) => sum + t.pnl, 0),
    winRate: last30DaysTrades.length > 0
      ? last30DaysTrades.filter(t => t.outcome === 'WIN').length / last30DaysTrades.length
      : 0
  }
  
  // Calculate overall score
  const overallScore = calculateOverallScore({
    winRate,
    profitFactor,
    sharpeRatio,
    maxDrawdown,
    totalPnLPercent,
    calmarRatio,
    expectancy
  })
  
  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F'
  let recommendation: string
  
  if (overallScore >= 80) {
    grade = 'A'
    recommendation = 'Excellent performance. Strategy is working well. Continue with current approach.'
  } else if (overallScore >= 60) {
    grade = 'B'
    recommendation = 'Good performance. Minor optimizations could improve results.'
  } else if (overallScore >= 40) {
    grade = 'C'
    recommendation = 'Average performance. Review losing trades and adjust strategy.'
  } else if (overallScore >= 20) {
    grade = 'D'
    recommendation = 'Below average. Significant strategy changes needed.'
  } else {
    grade = 'F'
    recommendation = 'Poor performance. Stop trading and review strategy completely.'
  }
  
  return {
    totalTrades,
    openTrades: 0,
    closedTrades: closedTrades.length,
    winCount,
    lossCount,
    breakEvenCount: breakEvens.length,
    winRate,
    
    totalPnL,
    totalPnLPercent,
    totalFees,
    netPnL,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    avgTrade,
    
    maxDrawdown,
    maxDrawdownDuration: maxDDDuration,
    currentDrawdown,
    avgDrawdown,
    
    profitFactor,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    riskRewardRatio,
    expectancy,
    
    avgHoldTime,
    medianHoldTime,
    tradesPerDay,
    avgTradesPerWin,
    
    bestStrategy,
    worstStrategy,
    bestTimeToTrade,
    worstTimeToTrade,
    
    last7Days,
    last30Days,
    
    overallScore,
    grade,
    recommendation
  }
}

// === CALCULATE OVERALL SCORE ===
function calculateOverallScore(metrics: {
  winRate: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  totalPnLPercent: number
  calmarRatio: number
  expectancy: number
}): number {
  let score = 0
  
  // Win Rate (20 points)
  if (metrics.winRate >= 0.65) score += 20
  else if (metrics.winRate >= 0.55) score += 15
  else if (metrics.winRate >= 0.50) score += 10
  else if (metrics.winRate >= 0.40) score += 5
  
  // Profit Factor (20 points)
  if (metrics.profitFactor >= 2.0) score += 20
  else if (metrics.profitFactor >= 1.5) score += 15
  else if (metrics.profitFactor >= 1.2) score += 10
  else if (metrics.profitFactor >= 1.0) score += 5
  
  // Sharpe Ratio (15 points)
  if (metrics.sharpeRatio >= 2.0) score += 15
  else if (metrics.sharpeRatio >= 1.5) score += 12
  else if (metrics.sharpeRatio >= 1.0) score += 8
  else if (metrics.sharpeRatio >= 0.5) score += 4
  
  // Max Drawdown (15 points)
  if (metrics.maxDrawdown <= 5) score += 15
  else if (metrics.maxDrawdown <= 10) score += 12
  else if (metrics.maxDrawdown <= 15) score += 8
  else if (metrics.maxDrawdown <= 20) score += 4
  
  // Total Return (15 points)
  if (metrics.totalPnLPercent >= 50) score += 15
  else if (metrics.totalPnLPercent >= 25) score += 12
  else if (metrics.totalPnLPercent >= 10) score += 8
  else if (metrics.totalPnLPercent >= 0) score += 4
  
  // Expectancy (15 points)
  if (metrics.expectancy > 0) score += 15
  else if (metrics.expectancy > -0.001) score += 8
  
  return Math.min(100, Math.max(0, score))
}

// === GET EQUITY CURVE ===
export function getEquityCurve(): EquityPoint[] {
  return [...equityCurve]
}

// === GET TRADE HISTORY ===
export function getTradeHistory(limit: number = 100): TradeRecord[] {
  return tradeHistory.slice(-limit)
}

// === GET DAILY STATS ===
export function getDailyStats(days: number = 30): DailyStats[] {
  const stats: Map<string, { trades: TradeRecord[] }> = new Map()
  
  for (const trade of tradeHistory) {
    const date = new Date(trade.timestamp).toISOString().slice(0, 10)
    const dayStats = stats.get(date) || { trades: [] }
    dayStats.trades.push(trade)
    stats.set(date, dayStats)
  }
  
  const result: DailyStats[] = []
  const now = new Date()
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const dayTrades = stats.get(date)?.trades || []
    
    const pnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0)
    const wins = dayTrades.filter(t => t.outcome === 'WIN').length
    
    result.push({
      date,
      trades: dayTrades.length,
      pnl,
      winRate: dayTrades.length > 0 ? wins / dayTrades.length : 0,
      drawdown: 0 // Would calculate from equity curve
    })
  }
  
  return result
}

// === EXPORT FOR REPORTING ===
export function exportPerformanceReport(): {
  metrics: PerformanceMetrics
  equityCurve: EquityPoint[]
  trades: TradeRecord[]
  dailyStats: DailyStats[]
} {
  return {
    metrics: calculateMetrics(),
    equityCurve: getEquityCurve(),
    trades: getTradeHistory(),
    dailyStats: getDailyStats(30)
  }
}
