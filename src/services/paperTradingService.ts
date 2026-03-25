/**
 * Paper Trading Service - Simulasi Trading Tanpa Risiko
 * Untuk testing strategi sebelum pakai uang asli
 */

export interface PaperPosition {
  id: string
  tokenMint: string
  symbol: string
  name: string
  entryPrice: number
  currentPrice: number
  amount: number
  valueSOL: number
  stopLoss: number
  takeProfit: number
  entryTime: number
  pnl: number
  pnlPercent: number
  status: 'OPEN' | 'CLOSED'
  exitPrice?: number
  exitTime?: number
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'TIMEOUT'
}

export interface PaperPortfolio {
  balance: number
  initialBalance: number
  totalPnL: number
  totalPnLPercent: number
  openPositions: PaperPosition[]
  closedPositions: PaperPosition[]
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  maxDrawdown: number
  currentDrawdown: number
  sharpeRatio: number
  profitFactor: number
  avgHoldTime: number
}

export interface PaperTradeLog {
  timestamp: number
  action: 'BUY' | 'SELL' | 'STOP_LOSS' | 'TAKE_PROFIT'
  symbol: string
  price: number
  amount: number
  pnl?: number
  reason?: string
}

// In-memory storage
let portfolio: PaperPortfolio = {
  balance: 10, // Start with 10 SOL
  initialBalance: 10,
  totalPnL: 0,
  totalPnLPercent: 0,
  openPositions: [],
  closedPositions: [],
  totalTrades: 0,
  winCount: 0,
  lossCount: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  largestWin: 0,
  largestLoss: 0,
  maxDrawdown: 0,
  currentDrawdown: 0,
  sharpeRatio: 0,
  profitFactor: 0,
  avgHoldTime: 0
}

const tradeLogs: PaperTradeLog[] = []
const equityCurve: { timestamp: number; equity: number }[] = []

// === INITIALIZE PAPER TRADING ===
export function initPaperTrading(initialBalance: number = 10): PaperPortfolio {
  portfolio = {
    balance: initialBalance,
    initialBalance: initialBalance,
    totalPnL: 0,
    totalPnLPercent: 0,
    openPositions: [],
    closedPositions: [],
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    maxDrawdown: 0,
    currentDrawdown: 0,
    sharpeRatio: 0,
    profitFactor: 0,
    avgHoldTime: 0
  }
  
  tradeLogs.length = 0
  equityCurve.length = 0
  
  console.log(`[Paper Trading] Initialized with ${initialBalance} SOL`)
  return { ...portfolio }
}

// === OPEN POSITION ===
export function openPaperPosition(params: {
  tokenMint: string
  symbol: string
  name: string
  entryPrice: number
  amount: number
  valueSOL: number
  stopLoss: number
  takeProfit: number
}): { success: boolean; position?: PaperPosition; error?: string } {
  
  // Check if enough balance
  if (params.valueSOL > portfolio.balance) {
    return { success: false, error: `Insufficient balance. Need ${params.valueSOL}, have ${portfolio.balance}` }
  }
  
  // Check max open positions
  if (portfolio.openPositions.length >= 3) {
    return { success: false, error: 'Maximum 3 open positions allowed' }
  }
  
  // Check if already have position in this token
  const existingPosition = portfolio.openPositions.find(p => p.tokenMint === params.tokenMint)
  if (existingPosition) {
    return { success: false, error: `Already have position in ${params.symbol}` }
  }
  
  const position: PaperPosition = {
    id: `paper-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    tokenMint: params.tokenMint,
    symbol: params.symbol,
    name: params.name,
    entryPrice: params.entryPrice,
    currentPrice: params.entryPrice,
    amount: params.amount,
    valueSOL: params.valueSOL,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    entryTime: Date.now(),
    pnl: 0,
    pnlPercent: 0,
    status: 'OPEN'
  }
  
  portfolio.balance -= params.valueSOL
  portfolio.openPositions.push(position)
  portfolio.totalTrades++
  
  // Log trade
  tradeLogs.push({
    timestamp: Date.now(),
    action: 'BUY',
    symbol: params.symbol,
    price: params.entryPrice,
    amount: params.amount,
    reason: `Paper buy ${params.amount.toFixed(4)} @ ${params.entryPrice.toFixed(8)}`
  })
  
  console.log(`[Paper Trading] OPENED: ${params.symbol} @ ${params.entryPrice.toFixed(8)} | SL: ${params.stopLoss.toFixed(8)} | TP: ${params.takeProfit.toFixed(8)}`)
  
  return { success: true, position }
}

// === UPDATE POSITION PRICES ===
export function updatePaperPrices(priceUpdates: { tokenMint: string; currentPrice: number }[]): {
  closedPositions: PaperPosition[]
  portfolio: PaperPortfolio
} {
  const closedPositions: PaperPosition[] = []
  
  for (const update of priceUpdates) {
    const position = portfolio.openPositions.find(p => p.tokenMint === update.tokenMint)
    if (!position) continue
    
    position.currentPrice = update.currentPrice
    
    // Calculate PnL
    const priceChange = (update.currentPrice - position.entryPrice) / position.entryPrice
    position.pnlPercent = priceChange
    position.pnl = position.valueSOL * priceChange
    
    // Check stop loss
    if (update.currentPrice <= position.stopLoss) {
      const closedPos = closePaperPosition(position.id, update.currentPrice, 'STOP_LOSS')
      if (closedPos) closedPositions.push(closedPos)
      continue
    }
    
    // Check take profit
    if (update.currentPrice >= position.takeProfit) {
      const closedPos = closePaperPosition(position.id, update.currentPrice, 'TAKE_PROFIT')
      if (closedPos) closedPositions.push(closedPos)
      continue
    }
  }
  
  // Update portfolio metrics
  updatePortfolioMetrics()
  
  // Record equity curve
  const totalEquity = portfolio.balance + portfolio.openPositions.reduce((sum, p) => sum + p.valueSOL + p.pnl, 0)
  equityCurve.push({ timestamp: Date.now(), equity: totalEquity })
  
  return { closedPositions, portfolio: { ...portfolio } }
}

// === CLOSE POSITION ===
export function closePaperPosition(
  positionId: string,
  exitPrice: number,
  reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'TIMEOUT'
): PaperPosition | null {
  const index = portfolio.openPositions.findIndex(p => p.id === positionId)
  if (index === -1) return null
  
  const position = portfolio.openPositions[index]
  
  // Calculate final PnL
  const priceChange = (exitPrice - position.entryPrice) / position.entryPrice
  position.pnlPercent = priceChange
  position.pnl = position.valueSOL * priceChange
  position.exitPrice = exitPrice
  position.exitTime = Date.now()
  position.exitReason = reason
  position.status = 'CLOSED'
  position.currentPrice = exitPrice
  
  // Return capital + profit/loss
  const returnValue = position.valueSOL + position.pnl
  portfolio.balance += returnValue
  
  // Move to closed positions
  portfolio.openPositions.splice(index, 1)
  portfolio.closedPositions.push(position)
  
  // Update win/loss stats
  if (position.pnl > 0) {
    portfolio.winCount++
    portfolio.largestWin = Math.max(portfolio.largestWin, position.pnl)
  } else {
    portfolio.lossCount++
    portfolio.largestLoss = Math.min(portfolio.largestLoss, position.pnl)
  }
  
  // Log trade
  tradeLogs.push({
    timestamp: Date.now(),
    action: reason === 'STOP_LOSS' ? 'STOP_LOSS' : reason === 'TAKE_PROFIT' ? 'TAKE_PROFIT' : 'SELL',
    symbol: position.symbol,
    price: exitPrice,
    amount: position.amount,
    pnl: position.pnl,
    reason: `Paper sell ${position.amount.toFixed(4)} @ ${exitPrice.toFixed(8)} | PnL: ${position.pnl > 0 ? '+' : ''}${position.pnl.toFixed(4)} SOL (${(position.pnlPercent * 100).toFixed(2)}%)`
  })
  
  console.log(`[Paper Trading] CLOSED: ${position.symbol} @ ${exitPrice.toFixed(8)} | Reason: ${reason} | PnL: ${position.pnl > 0 ? '+' : ''}${position.pnl.toFixed(4)} SOL`)
  
  return position
}

// === UPDATE PORTFOLIO METRICS ===
function updatePortfolioMetrics(): void {
  const totalEquity = portfolio.balance + portfolio.openPositions.reduce((sum, p) => sum + p.valueSOL + p.pnl, 0)
  
  portfolio.totalPnL = totalEquity - portfolio.initialBalance
  portfolio.totalPnLPercent = (portfolio.totalPnL / portfolio.initialBalance) * 100
  
  // Win rate
  const totalClosed = portfolio.winCount + portfolio.lossCount
  portfolio.winRate = totalClosed > 0 ? portfolio.winCount / totalClosed : 0
  
  // Average win/loss
  const wins = portfolio.closedPositions.filter(p => p.pnl > 0)
  const losses = portfolio.closedPositions.filter(p => p.pnl < 0)
  
  portfolio.avgWin = wins.length > 0 ? wins.reduce((sum, p) => sum + p.pnl, 0) / wins.length : 0
  portfolio.avgLoss = losses.length > 0 ? losses.reduce((sum, p) => sum + p.pnl, 0) / losses.length : 0
  
  // Max drawdown
  if (equityCurve.length > 1) {
    let peak = equityCurve[0].equity
    let maxDD = 0
    let currentDD = 0
    
    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity
      }
      const dd = (peak - point.equity) / peak
      maxDD = Math.max(maxDD, dd)
      if (point === equityCurve[equityCurve.length - 1]) {
        currentDD = dd
      }
    }
    
    portfolio.maxDrawdown = maxDD * 100
    portfolio.currentDrawdown = currentDD * 100
  }
  
  // Profit factor
  const totalWins = wins.reduce((sum, p) => sum + p.pnl, 0)
  const totalLosses = Math.abs(losses.reduce((sum, p) => sum + p.pnl, 0))
  portfolio.profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
  
  // Sharpe Ratio (simplified)
  if (portfolio.closedPositions.length >= 5) {
    const returns = portfolio.closedPositions.map(p => p.pnlPercent)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    const stdDev = Math.sqrt(variance)
    // Assuming risk-free rate of 0 and annualized
    portfolio.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0
  }
  
  // Average hold time
  const closedWithDuration = portfolio.closedPositions.filter(p => p.exitTime)
  if (closedWithDuration.length > 0) {
    portfolio.avgHoldTime = closedWithDuration.reduce((sum, p) => sum + (p.exitTime! - p.entryTime), 0) / closedWithDuration.length
  }
}

// === GET PORTFOLIO ===
export function getPaperPortfolio(): PaperPortfolio {
  return { ...portfolio }
}

// === GET TRADE LOGS ===
export function getPaperTradeLogs(limit: number = 50): PaperTradeLog[] {
  return tradeLogs.slice(-limit)
}

// === GET EQUITY CURVE ===
export function getEquityCurve(): { timestamp: number; equity: number }[] {
  return [...equityCurve]
}

// === GET PERFORMANCE SUMMARY ===
export function getPaperPerformanceSummary(): {
  summary: string
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  recommendation: string
} {
  const winRate = portfolio.winRate
  const profitFactor = portfolio.profitFactor
  const sharpe = portfolio.sharpeRatio
  const maxDD = portfolio.maxDrawdown
  const totalReturn = portfolio.totalPnLPercent
  
  let score = 0
  const reasons: string[] = []
  
  // Win rate scoring
  if (winRate >= 0.6) { score += 25; reasons.push(`Good win rate: ${(winRate * 100).toFixed(1)}%`) }
  else if (winRate >= 0.5) { score += 15; reasons.push(`Acceptable win rate: ${(winRate * 100).toFixed(1)}%`) }
  else { reasons.push(`Low win rate: ${(winRate * 100).toFixed(1)}%`) }
  
  // Profit factor scoring
  if (profitFactor >= 2) { score += 25; reasons.push(`Excellent profit factor: ${profitFactor.toFixed(2)}`) }
  else if (profitFactor >= 1.5) { score += 15; reasons.push(`Good profit factor: ${profitFactor.toFixed(2)}`) }
  else if (profitFactor >= 1) { score += 5; reasons.push(`Positive profit factor: ${profitFactor.toFixed(2)}`) }
  else { reasons.push(`Negative profit factor: ${profitFactor.toFixed(2)}`) }
  
  // Sharpe ratio scoring
  if (sharpe >= 2) { score += 20; reasons.push(`Excellent Sharpe: ${sharpe.toFixed(2)}`) }
  else if (sharpe >= 1) { score += 15; reasons.push(`Good Sharpe: ${sharpe.toFixed(2)}`) }
  else if (sharpe >= 0.5) { score += 10; reasons.push(`Acceptable Sharpe: ${sharpe.toFixed(2)}`) }
  else { reasons.push(`Low Sharpe: ${sharpe.toFixed(2)}`) }
  
  // Max drawdown scoring
  if (maxDD <= 5) { score += 15; reasons.push(`Low drawdown: ${maxDD.toFixed(1)}%`) }
  else if (maxDD <= 10) { score += 10; reasons.push(`Acceptable drawdown: ${maxDD.toFixed(1)}%`) }
  else if (maxDD <= 20) { score += 5; reasons.push(`High drawdown: ${maxDD.toFixed(1)}%`) }
  else { reasons.push(`Dangerous drawdown: ${maxDD.toFixed(1)}%`) }
  
  // Total return scoring
  if (totalReturn >= 20) { score += 15; reasons.push(`Excellent return: +${totalReturn.toFixed(1)}%`) }
  else if (totalReturn >= 10) { score += 10; reasons.push(`Good return: +${totalReturn.toFixed(1)}%`) }
  else if (totalReturn >= 0) { score += 5; reasons.push(`Positive return: +${totalReturn.toFixed(1)}%`) }
  else { reasons.push(`Negative return: ${totalReturn.toFixed(1)}%`) }
  
  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F'
  let recommendation: string
  
  if (score >= 80) {
    grade = 'A'
    recommendation = 'Ready for live trading with small capital. Monitor closely.'
  } else if (score >= 60) {
    grade = 'B'
    recommendation = 'Need more testing. Continue paper trading for 2 more weeks.'
  } else if (score >= 40) {
    grade = 'C'
    recommendation = 'Strategy needs improvement. Review losing trades and optimize.'
  } else if (score >= 20) {
    grade = 'D'
    recommendation = 'Not ready for live trading. Major strategy revision needed.'
  } else {
    grade = 'F'
    recommendation = 'Strategy is unprofitable. Do NOT use with real money.'
  }
  
  const summary = `Score: ${score}/100\n${reasons.join('\n')}`
  
  return { summary, grade, recommendation }
}

// === SIMULATE PRICE MOVEMENT (For Testing) ===
export function simulatePriceMovement(
  positionId: string,
  priceChangePercent: number
): PaperPosition | null {
  const position = portfolio.openPositions.find(p => p.id === positionId)
  if (!position) return null
  
  const newPrice = position.currentPrice * (1 + priceChangePercent / 100)
  const result = updatePaperPrices([{ tokenMint: position.tokenMint, currentPrice: newPrice }])
  
  return result.closedPositions.find(p => p.id === positionId) || null
}

// === EXPORT FOR TESTING ===
export { portfolio as paperPortfolio }
