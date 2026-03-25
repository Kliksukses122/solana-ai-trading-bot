/**
 * Unified AI Trading Service
 * Connects Paper Trading → Learning → Real Trading
 * 
 * Flow:
 * 1. Paper Trading records trades to Learning Service
 * 2. Learning Service extracts insights from paper trading results
 * 3. Real Trading AI uses learning insights for better decisions
 * 4. Only strategies with Grade A/B are applied to real trading
 */

import { 
  recordTrade, 
  updateTradeOutcome, 
  getLearningInsights, 
  getTokenLearning,
  isTokenBlacklisted,
  getRecommendedTradeSize,
  getAllStats
} from './aiLearningService'

// Paper trading trade record
export interface PaperTrade {
  id: string
  token: {
    symbol: string
    name: string
    mint: string
  }
  action: 'BUY' | 'SELL'
  amount: number
  entryPrice: number
  exitPrice?: number
  outcome?: 'WIN' | 'LOSS' | 'PENDING'
  profitPercent?: number
  stopLoss: number
  takeProfit: number
  confidence: number
  reasoning: string
  signals: string[]
  timestamp: number
  closedAt?: number
}

// Learning stats for a token
export interface TokenLearningStats {
  symbol: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  avgProfitPercent: number
  isBlacklisted: boolean
  recommendedSizeMultiplier: number
}

// Strategy readiness for real trading
export interface StrategyReadiness {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  isReadyForReal: boolean
  winRate: number
  profitFactor: number
  maxDrawdown: number
  totalTrades: number
  recommendations: string[]
}

// Store paper trades in memory for quick access
const paperTrades: PaperTrade[] = []

/**
 * Record a paper trade to learning service
 */
export async function recordPaperTradeToLearning(trade: PaperTrade): Promise<string> {
  // Record to learning service
  const tradeId = await recordTrade({
    token: trade.token,
    action: trade.action,
    amount: trade.amount,
    entryPrice: trade.entryPrice,
    strategy: 'PAPER_TRADING_AI',
    aiScore: trade.confidence / 10, // Convert 0-100 to 0-10
    aiRecommendation: trade.reasoning,
    marketCondition: trade.signals.join(', ')
  })
  
  // Store locally
  paperTrades.push({ ...trade, id: tradeId })
  
  console.log(`[Unified] Paper trade recorded to learning: ${trade.token.symbol}`)
  return tradeId
}

/**
 * Update paper trade outcome in learning service
 */
export async function updatePaperTradeOutcome(
  tradeId: string,
  outcome: 'WIN' | 'LOSS',
  exitPrice: number,
  profitPercent: number
): Promise<void> {
  await updateTradeOutcome(tradeId, outcome, exitPrice, profitPercent)
  
  // Update local record
  const trade = paperTrades.find(t => t.id === tradeId)
  if (trade) {
    trade.outcome = outcome
    trade.exitPrice = exitPrice
    trade.profitPercent = profitPercent
    trade.closedAt = Date.now()
  }
  
  console.log(`[Unified] Paper trade outcome updated: ${outcome} ${(profitPercent * 100).toFixed(2)}%`)
}

/**
 * Get learning insights for AI decision making
 */
export async function getAITradingInsights(): Promise<{
  bestTokens: string[]
  avoidTokens: string[]
  bestScoreRange: [number, number]
  optimalHoldDuration: number
  winRateTrend: number
  learnedRules: string[]
  isReadyForReal: boolean
  strategyGrade: 'A' | 'B' | 'C' | 'D' | 'F'
}> {
  const insights = await getLearningInsights()
  const stats = await getAllStats()
  
  // Calculate strategy grade
  const grade = calculateStrategyGrade(stats.winRate, calculateProfitFactor(stats), 0)
  
  return {
    bestTokens: insights.bestTokens.map(t => t.symbol),
    avoidTokens: insights.worstTokens.map(t => t.symbol),
    bestScoreRange: insights.bestScoreRange,
    optimalHoldDuration: insights.optimalHoldDuration,
    winRateTrend: insights.winRateTrend,
    learnedRules: insights.learnedRules,
    isReadyForReal: grade === 'A' || grade === 'B',
    strategyGrade: grade
  }
}

/**
 * Calculate profit factor
 */
function calculateProfitFactor(stats: { wins: number; losses: number; totalProfit: number }): number {
  if (stats.wins === 0) return 0
  if (stats.losses === 0) return 999 // No losses = infinite profit factor
  
  // Approximate profit factor
  const avgWin = stats.totalProfit / stats.wins
  return avgWin > 0 ? avgWin * stats.wins / (Math.abs(stats.totalProfit) * 0.5 + 1) : 1
}

/**
 * Calculate strategy grade
 */
function calculateStrategyGrade(
  winRate: number,
  profitFactor: number,
  maxDrawdown: number
): 'A' | 'B' | 'C' | 'D' | 'F' {
  // Grade A: Win Rate >= 65%, Profit Factor >= 2.0, Max Drawdown <= 10%
  if (winRate >= 0.65 && profitFactor >= 2.0 && maxDrawdown <= 0.10) return 'A'
  
  // Grade B: Win Rate >= 55%, Profit Factor >= 1.5, Max Drawdown <= 20%
  if (winRate >= 0.55 && profitFactor >= 1.5 && maxDrawdown <= 0.20) return 'B'
  
  // Grade C: Win Rate >= 45%, Profit Factor >= 1.2, Max Drawdown <= 30%
  if (winRate >= 0.45 && profitFactor >= 1.2 && maxDrawdown <= 0.30) return 'C'
  
  // Grade D: Win Rate >= 35%, Profit Factor >= 0.8
  if (winRate >= 0.35 && profitFactor >= 0.8) return 'D'
  
  return 'F'
}

/**
 * Check if strategy is ready for real trading
 */
export async function checkStrategyReadiness(): Promise<StrategyReadiness> {
  const stats = await getAllStats()
  const insights = await getLearningInsights()
  
  const profitFactor = calculateProfitFactor(stats)
  
  // Estimate max drawdown (simplified)
  const maxDrawdown = Math.abs(insights.recentPerformance) * 2
  
  const grade = calculateStrategyGrade(stats.winRate, profitFactor, maxDrawdown)
  
  const recommendations: string[] = []
  
  if (stats.totalTrades < 20) {
    recommendations.push(`Need more trades for reliable data (${stats.totalTrades}/20)`)
  }
  
  if (stats.winRate < 0.55) {
    recommendations.push('Win rate too low. Adjust stop loss/take profit settings.')
  }
  
  if (profitFactor < 1.5) {
    recommendations.push('Profit factor below 1.5. Increase take profit ratio.')
  }
  
  if (insights.worstTokens.length > 0) {
    recommendations.push(`Avoid trading: ${insights.worstTokens.map(t => t.symbol).join(', ')}`)
  }
  
  if (insights.winRateTrend < -0.1) {
    recommendations.push('Win rate declining. Consider pausing and reviewing strategy.')
  }
  
  return {
    grade,
    isReadyForReal: grade === 'A' || grade === 'B',
    winRate: stats.winRate,
    profitFactor,
    maxDrawdown,
    totalTrades: stats.totalTrades,
    recommendations
  }
}

/**
 * Get enhanced AI prompt with learning insights
 */
export async function getEnhancedAIPrompt(baseToken: {
  symbol: string
  name: string
  price: number
  priceChange24h: number
  volume24h: number
  liquidity: number
}): Promise<string> {
  const insights = await getAITradingInsights()
  const tokenStats = await getTokenLearning(baseToken.symbol)
  
  let prompt = `You are a crypto trading AI with LEARNING CAPABILITIES.

TOKEN: ${baseToken.symbol} (${baseToken.name})
Price: $${baseToken.price.toFixed(8)}
24h Change: ${baseToken.priceChange24h.toFixed(2)}%
Volume: $${(baseToken.volume24h / 1000000).toFixed(2)}M
Liquidity: $${(baseToken.liquidity / 1000).toFixed(0)}K

`
  
  // Add learning insights
  if (insights.learnedRules.length > 0) {
    prompt += `LEARNED RULES FROM PAST TRADES:\n`
    insights.learnedRules.forEach(rule => {
      prompt += `- ${rule}\n`
    })
    prompt += '\n'
  }
  
  // Add token-specific stats
  if (tokenStats) {
    prompt += `TOKEN HISTORY (${baseToken.symbol}):\n`
    prompt += `- Previous trades: ${tokenStats.totalTrades}\n`
    prompt += `- Win rate: ${(tokenStats.winRate * 100).toFixed(1)}%\n`
    prompt += `- Avg profit: ${(tokenStats.avgProfitPercent * 100).toFixed(2)}%\n\n`
  }
  
  // Check if token is blacklisted
  const blacklisted = await isTokenBlacklisted(baseToken.symbol)
  if (blacklisted) {
    prompt += `⚠️ WARNING: This token is BLACKLISTED due to poor past performance.\n`
    prompt += `Recommendation: SKIP this trade.\n\n`
  }
  
  // Add strategy readiness
  const readiness = await checkStrategyReadiness()
  prompt += `STRATEGY STATUS: Grade ${readiness.grade}\n`
  prompt += `Ready for real trading: ${readiness.isReadyForReal ? 'YES' : 'NO'}\n\n`
  
  prompt += `DECISION RULES:
1. Only BUY if confidence >= 60%
2. Position size: 2-5% of portfolio
3. Stop Loss: 3-8% below entry
4. Take Profit: 8-15% above entry
5. If token in avoid list → SKIP
6. If win rate trend declining → be more conservative

Return JSON only:
{"decision":"BUY or SKIP","confidence":0-100,"stopLoss":${baseToken.price * 0.95},"takeProfit":${baseToken.price * 1.1},"positionSizePercent":2-5,"reasoning":"explanation","signals":["list of signals"]}`
  
  return prompt
}

/**
 * Get recommended position size with learning adjustments
 */
export async function getSmartPositionSize(
  symbol: string,
  baseSize: number,
  confidence: number
): Promise<number> {
  // Get learning-based adjustment
  const learningSize = await getRecommendedTradeSize(symbol, baseSize)
  
  // Adjust by confidence
  const confidenceMultiplier = confidence >= 80 ? 1.2 : confidence >= 60 ? 1.0 : 0.8
  
  // Adjust by strategy readiness
  const readiness = await checkStrategyReadiness()
  const gradeMultiplier = readiness.grade === 'A' ? 1.0 : 
                          readiness.grade === 'B' ? 0.8 : 
                          readiness.grade === 'C' ? 0.5 : 0.2
  
  return learningSize * confidenceMultiplier * gradeMultiplier
}

/**
 * Get all paper trades
 */
export function getPaperTrades(): PaperTrade[] {
  return [...paperTrades]
}

/**
 * Get paper trading stats
 */
export async function getPaperTradingStats(): Promise<{
  totalTrades: number
  openTrades: number
  closedTrades: number
  wins: number
  losses: number
  winRate: number
  totalProfit: number
  avgProfitPercent: number
}> {
  const closed = paperTrades.filter(t => t.outcome !== 'PENDING')
  const wins = closed.filter(t => t.outcome === 'WIN').length
  const losses = closed.filter(t => t.outcome === 'LOSS').length
  const totalProfit = closed.reduce((sum, t) => sum + (t.profitPercent || 0), 0)
  
  return {
    totalTrades: paperTrades.length,
    openTrades: paperTrades.filter(t => t.outcome === 'PENDING').length,
    closedTrades: closed.length,
    wins,
    losses,
    winRate: closed.length > 0 ? wins / closed.length : 0,
    totalProfit,
    avgProfitPercent: closed.length > 0 ? totalProfit / closed.length : 0
  }
}
