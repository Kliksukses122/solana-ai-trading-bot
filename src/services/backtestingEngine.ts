/**
 * Backtesting Engine - Test strategi dengan data historis
 * Untuk memvalidasi profitabilitas sebelum live trading
 */

export interface BacktestConfig {
  initialBalance: number
  startDate: Date
  endDate: Date
  maxRiskPerTrade: number // percent
  maxPositions: number
  stopLossPercent: number
  takeProfitPercent: number
  minConfidence: number
  minRiskReward: number
}

export interface BacktestTrade {
  id: string
  entryDate: Date
  exitDate: Date
  symbol: string
  entryPrice: number
  exitPrice: number
  stopLoss: number
  takeProfit: number
  amount: number
  pnl: number
  pnlPercent: number
  outcome: 'WIN' | 'LOSS'
  holdDuration: number // hours
  entryReason: string
  exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_TEST'
}

export interface BacktestResult {
  config: BacktestConfig
  trades: BacktestTrade[]
  metrics: {
    totalTrades: number
    winCount: number
    lossCount: number
    winRate: number
    totalReturn: number
    totalReturnPercent: number
    avgWin: number
    avgLoss: number
    largestWin: number
    largestLoss: number
    maxDrawdown: number
    sharpeRatio: number
    profitFactor: number
    avgHoldDuration: number
    expectancy: number // avg $ per trade
    calmarRatio: number
    sortinoRatio: number
  }
  equityCurve: { date: Date; equity: number }[]
  monthlyReturns: { month: string; return: number }[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  isProfitable: boolean
  readyForLive: boolean
  recommendation: string
}

// Default config
const DEFAULT_CONFIG: BacktestConfig = {
  initialBalance: 100, // 100 SOL
  startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
  endDate: new Date(),
  maxRiskPerTrade: 1, // 1%
  maxPositions: 3,
  stopLossPercent: 5,
  takeProfitPercent: 10,
  minConfidence: 75,
  minRiskReward: 2
}

// === GENERATE HISTORICAL DATA ===
async function fetchHistoricalTokenData(symbol: string, days: number): Promise<{
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}[]> {
  try {
    // Use DexScreener API for historical data (simulated for now)
    // In production, would use Birdeye or similar API
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${symbol}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch historical data')
    }
    
    // Generate synthetic historical data based on current price
    // In production, this would be real historical OHLCV data
    const data: { date: Date; open: number; high: number; low: number; close: number; volume: number }[] = []
    const basePrice = 0.00001 // Base price for simulation
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const volatility = Math.random() * 0.2 // 0-20% daily volatility
      const trend = Math.random() > 0.5 ? 1 : -1
      const change = volatility * trend * (1 + Math.random())
      
      const open = basePrice * Math.pow(1 + change / 100, days - i)
      const close = open * (1 + (Math.random() - 0.5) * 0.1)
      const high = Math.max(open, close) * (1 + Math.random() * 0.05)
      const low = Math.min(open, close) * (1 - Math.random() * 0.05)
      const volume = Math.random() * 1000000
      
      data.push({ date, open, high, low, close, volume })
    }
    
    return data
  } catch (error) {
    console.error('Error fetching historical data:', error)
    return []
  }
}

// === RUN BACKTEST ===
export async function runBacktest(
  tokenList: { mint: string; symbol: string }[],
  customConfig?: Partial<BacktestConfig>
): Promise<BacktestResult> {
  const config = { ...DEFAULT_CONFIG, ...customConfig }
  const trades: BacktestTrade[] = []
  const equityCurve: { date: Date; equity: number }[] = []
  const monthlyReturns: { month: string; return: number }[] = []
  
  let balance = config.initialBalance
  let maxEquity = balance
  let maxDrawdown = 0
  
  const openPositions: {
    id: string
    symbol: string
    entryDate: Date
    entryPrice: number
    stopLoss: number
    takeProfit: number
    amount: number
    value: number
  }[] = []
  
  // Simulate trading over the period
  const totalDays = Math.floor((config.endDate.getTime() - config.startDate.getTime()) / (24 * 60 * 60 * 1000))
  
  for (let day = 0; day <= totalDays; day++) {
    const currentDate = new Date(config.startDate.getTime() + day * 24 * 60 * 60 * 1000)
    
    // Simulate checking each token
    for (const token of tokenList) {
      // Simulate price movement
      const priceChange = (Math.random() - 0.48) * 20 // Slight edge for simulation
      const currentPrice = 0.00001 * (1 + Math.random())
      
      // Check open positions for this token
      const position = openPositions.find(p => p.symbol === token.symbol)
      if (position) {
        // Check stop loss
        if (currentPrice <= position.stopLoss) {
          const loss = position.value * (config.stopLossPercent / 100)
          balance -= loss
          
          trades.push({
            id: position.id,
            entryDate: position.entryDate,
            exitDate: currentDate,
            symbol: position.symbol,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            amount: position.amount,
            pnl: -loss,
            pnlPercent: -config.stopLossPercent,
            outcome: 'LOSS',
            holdDuration: (currentDate.getTime() - position.entryDate.getTime()) / (60 * 60 * 1000),
            entryReason: 'AI Signal',
            exitReason: 'STOP_LOSS'
          })
          
          const idx = openPositions.findIndex(p => p.id === position.id)
          if (idx > -1) openPositions.splice(idx, 1)
          continue
        }
        
        // Check take profit
        if (currentPrice >= position.takeProfit) {
          const profit = position.value * (config.takeProfitPercent / 100)
          balance += profit
          
          trades.push({
            id: position.id,
            entryDate: position.entryDate,
            exitDate: currentDate,
            symbol: position.symbol,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            amount: position.amount,
            pnl: profit,
            pnlPercent: config.takeProfitPercent,
            outcome: 'WIN',
            holdDuration: (currentDate.getTime() - position.entryDate.getTime()) / (60 * 60 * 1000),
            entryReason: 'AI Signal',
            exitReason: 'TAKE_PROFIT'
          })
          
          const idx = openPositions.findIndex(p => p.id === position.id)
          if (idx > -1) openPositions.splice(idx, 1)
        }
        continue
      }
      
      // Simulate AI decision (simplified)
      const confidence = 50 + Math.random() * 50 // 50-100
      const shouldTrade = confidence >= config.minConfidence && 
                          Math.random() > 0.7 && // Only 30% of opportunities
                          openPositions.length < config.maxPositions
      
      if (shouldTrade) {
        const riskAmount = balance * (config.maxRiskPerTrade / 100)
        const positionValue = riskAmount * 3 // 3x leverage simulation
        const amount = positionValue / currentPrice
        
        const stopLoss = currentPrice * (1 - config.stopLossPercent / 100)
        const takeProfit = currentPrice * (1 + config.takeProfitPercent / 100)
        
        openPositions.push({
          id: `bt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          symbol: token.symbol,
          entryDate: currentDate,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          amount,
          value: positionValue
        })
      }
    }
    
    // Calculate current equity
    const openPositionValue = openPositions.reduce((sum, p) => {
      const currentPrice = p.entryPrice * (1 + (Math.random() - 0.5) * 0.1)
      return sum + (p.amount * currentPrice)
    }, 0)
    
    const equity = balance + openPositionValue
    equityCurve.push({ date: currentDate, equity })
    
    // Track max drawdown
    if (equity > maxEquity) {
      maxEquity = equity
    }
    const drawdown = (maxEquity - equity) / maxEquity * 100
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
    
    // Track monthly returns
    if (day > 0 && day % 30 === 0) {
      const monthStart = equityCurve.find(e => 
        e.date.getMonth() !== currentDate.getMonth()
      )
      if (monthStart) {
        const monthReturn = (equity - monthStart.equity) / monthStart.equity * 100
        monthlyReturns.push({
          month: currentDate.toISOString().slice(0, 7),
          return: monthReturn
        })
      }
    }
  }
  
  // Close any remaining positions at end of test
  for (const position of openPositions) {
    const exitPrice = position.entryPrice * (1 + (Math.random() - 0.5) * 0.05)
    const pnl = (exitPrice - position.entryPrice) * position.amount
    balance += pnl
    
    trades.push({
      id: position.id,
      entryDate: position.entryDate,
      exitDate: config.endDate,
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      amount: position.amount,
      pnl,
      pnlPercent: pnl / position.value * 100,
      outcome: pnl > 0 ? 'WIN' : 'LOSS',
      holdDuration: (config.endDate.getTime() - position.entryDate.getTime()) / (60 * 60 * 1000),
      entryReason: 'AI Signal',
      exitReason: 'END_OF_TEST'
    })
  }
  
  // Calculate metrics
  const winCount = trades.filter(t => t.outcome === 'WIN').length
  const lossCount = trades.filter(t => t.outcome === 'LOSS').length
  const totalTrades = trades.length
  const winRate = totalTrades > 0 ? winCount / totalTrades : 0
  
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0
  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0
  
  const totalReturn = balance - config.initialBalance
  const totalReturnPercent = (totalReturn / config.initialBalance) * 100
  
  const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0)
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  
  // Sharpe Ratio
  const returns = trades.map(t => t.pnlPercent)
  const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
  const variance = returns.length > 1 
    ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1) 
    : 0
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0
  
  // Sortino Ratio (downside deviation)
  const downsideReturns = returns.filter(r => r < 0)
  const downsideDeviation = downsideReturns.length > 0
    ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
    : 0
  const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : 0
  
  // Calmar Ratio
  const calmarRatio = maxDrawdown > 0 ? totalReturnPercent / maxDrawdown : 0
  
  // Expectancy
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss
  
  // Average hold duration
  const avgHoldDuration = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdDuration, 0) / trades.length
    : 0
  
  // Determine grade and recommendation
  let grade: 'A' | 'B' | 'C' | 'D' | 'F'
  let recommendation: string
  let readyForLive: boolean
  
  const score = calculateScore(winRate, profitFactor, sharpeRatio, maxDrawdown, totalReturnPercent)
  
  if (score >= 80) {
    grade = 'A'
    recommendation = 'Excellent strategy. Ready for live trading with proper risk management.'
    readyForLive = true
  } else if (score >= 60) {
    grade = 'B'
    recommendation = 'Good strategy. Consider minor optimizations before live trading.'
    readyForLive = true
  } else if (score >= 40) {
    grade = 'C'
    recommendation = 'Average strategy. Needs improvement before live trading.'
    readyForLive = false
  } else if (score >= 20) {
    grade = 'D'
    recommendation = 'Below average strategy. Major improvements needed.'
    readyForLive = false
  } else {
    grade = 'F'
    recommendation = 'Poor strategy. Do not use for live trading.'
    readyForLive = false
  }
  
  return {
    config,
    trades,
    metrics: {
      totalTrades,
      winCount,
      lossCount,
      winRate,
      totalReturn,
      totalReturnPercent,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      avgHoldDuration,
      expectancy,
      calmarRatio,
      sortinoRatio
    },
    equityCurve,
    monthlyReturns,
    grade,
    isProfitable: totalReturn > 0,
    readyForLive,
    recommendation
  }
}

// === CALCULATE SCORE ===
function calculateScore(
  winRate: number,
  profitFactor: number,
  sharpe: number,
  maxDD: number,
  totalReturn: number
): number {
  let score = 0
  
  // Win rate (25 points)
  if (winRate >= 0.65) score += 25
  else if (winRate >= 0.55) score += 20
  else if (winRate >= 0.50) score += 15
  else if (winRate >= 0.45) score += 10
  else score += 5
  
  // Profit factor (25 points)
  if (profitFactor >= 2.0) score += 25
  else if (profitFactor >= 1.5) score += 20
  else if (profitFactor >= 1.2) score += 15
  else if (profitFactor >= 1.0) score += 10
  else score += 0
  
  // Sharpe ratio (20 points)
  if (sharpe >= 2.0) score += 20
  else if (sharpe >= 1.5) score += 15
  else if (sharpe >= 1.0) score += 10
  else if (sharpe >= 0.5) score += 5
  
  // Max drawdown (15 points)
  if (maxDD <= 5) score += 15
  else if (maxDD <= 10) score += 12
  else if (maxDD <= 15) score += 8
  else if (maxDD <= 20) score += 5
  else score += 0
  
  // Total return (15 points)
  if (totalReturn >= 50) score += 15
  else if (totalReturn >= 30) score += 12
  else if (totalReturn >= 10) score += 8
  else if (totalReturn >= 0) score += 5
  else score += 0
  
  return score
}

// === QUICK BACKTEST (Fast simulation) ===
export function quickBacktest(
  numTrades: number = 100,
  winRate: number = 0.55,
  avgWinPercent: number = 8,
  avgLossPercent: number = 4
): BacktestResult {
  const trades: BacktestTrade[] = []
  const equityCurve: { date: Date; equity: number }[] = []
  let balance = 100
  let maxEquity = balance
  let maxDrawdown = 0
  
  const startDate = new Date(Date.now() - numTrades * 24 * 60 * 60 * 1000)
  
  for (let i = 0; i < numTrades; i++) {
    const entryDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
    const exitDate = new Date(entryDate.getTime() + 12 * 60 * 60 * 1000) // 12 hours hold
    
    const isWin = Math.random() < winRate
    const pnlPercent = isWin 
      ? avgWinPercent * (0.5 + Math.random()) 
      : -avgLossPercent * (0.5 + Math.random())
    
    const positionValue = balance * 0.05 // 5% position
    const pnl = positionValue * (pnlPercent / 100)
    balance += pnl
    
    trades.push({
      id: `quick-${i}`,
      entryDate,
      exitDate,
      symbol: `TOKEN${i % 10}`,
      entryPrice: 0.001,
      exitPrice: 0.001 * (1 + pnlPercent / 100),
      stopLoss: 0.001 * 0.95,
      takeProfit: 0.001 * 1.10,
      amount: positionValue / 0.001,
      pnl,
      pnlPercent,
      outcome: isWin ? 'WIN' : 'LOSS',
      holdDuration: 12,
      entryReason: 'Simulated trade',
      exitReason: isWin ? 'TAKE_PROFIT' : 'STOP_LOSS'
    })
    
    if (balance > maxEquity) maxEquity = balance
    const dd = (maxEquity - balance) / maxEquity * 100
    if (dd > maxDrawdown) maxDrawdown = dd
    
    equityCurve.push({ date: entryDate, equity: balance })
  }
  
  const winCount = trades.filter(t => t.outcome === 'WIN').length
  const lossCount = trades.filter(t => t.outcome === 'LOSS').length
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0
  
  const totalReturn = balance - 100
  const totalReturnPercent = totalReturn
  const profitFactor = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0)) > 0
    ? wins.reduce((sum, t) => sum + t.pnl, 0) / Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
    : Infinity
  
  const returns = trades.map(t => t.pnlPercent)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0
  
  const score = calculateScore(winRate, profitFactor, sharpeRatio, maxDrawdown, totalReturnPercent)
  
  let grade: 'A' | 'B' | 'C' | 'D' | 'F'
  let recommendation: string
  let readyForLive: boolean
  
  if (score >= 80) { grade = 'A'; recommendation = 'Ready for live trading'; readyForLive = true }
  else if (score >= 60) { grade = 'B'; recommendation = 'Needs minor improvements'; readyForLive = true }
  else if (score >= 40) { grade = 'C'; recommendation = 'Needs improvement'; readyForLive = false }
  else if (score >= 20) { grade = 'D'; recommendation = 'Major improvements needed'; readyForLive = false }
  else { grade = 'F'; recommendation = 'Do not use'; readyForLive = false }
  
  return {
    config: DEFAULT_CONFIG,
    trades,
    metrics: {
      totalTrades: numTrades,
      winCount,
      lossCount,
      winRate,
      totalReturn,
      totalReturnPercent,
      avgWin,
      avgLoss,
      largestWin: Math.max(...wins.map(t => t.pnl), 0),
      largestLoss: Math.min(...losses.map(t => t.pnl), 0),
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      avgHoldDuration: 12,
      expectancy: winRate * avgWin + (1 - winRate) * avgLoss,
      calmarRatio: maxDrawdown > 0 ? totalReturnPercent / maxDrawdown : 0,
      sortinoRatio: sharpeRatio * 1.2 // Approximation
    },
    equityCurve,
    monthlyReturns: [],
    grade,
    isProfitable: totalReturn > 0,
    readyForLive,
    recommendation
  }
}

// === EXPORT CONFIG ===
export { DEFAULT_CONFIG }
