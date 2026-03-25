/**
 * AI Learning Service - Self-improving trading intelligence
 * Learns from past trades to improve future decisions
 * Now with DATABASE PERSISTENCE via Prisma
 */

import { db } from '@/lib/db'

export interface LearningInsights {
  bestTokens: { symbol: string; winRate: number; avgProfit: number }[]
  worstTokens: { symbol: string; winRate: number; avgLoss: number }[]
  bestStrategies: { name: string; winRate: number; avgProfit: number }[]
  bestScoreRange: [number, number]
  optimalHoldDuration: number
  winRateTrend: number
  recentPerformance: number
  learnedRules: string[]
}

export interface TokenStats {
  symbol: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  avgProfitPercent: number
  isBlacklisted: boolean
  recommendedSizeMultiplier: number
}

// Record a new trade to database
export async function recordTrade(trade: {
  token: { symbol: string; mint: string; name: string }
  action: 'BUY' | 'SELL'
  amount: number
  entryPrice: number
  strategy: string
  aiScore: number
  aiRecommendation?: string
  marketCondition?: string
}): Promise<string> {
  try {
    const record = await db.tradeRecord.create({
      data: {
        tokenSymbol: trade.token.symbol,
        tokenName: trade.token.name,
        tokenMint: trade.token.mint,
        action: trade.action,
        amount: trade.amount,
        entryPrice: trade.entryPrice,
        strategy: trade.strategy,
        aiScore: trade.aiScore,
        aiRecommendation: trade.aiRecommendation || '',
        marketCondition: trade.marketCondition || '',
        outcome: 'PENDING'
      }
    })
    
    console.log(`[Learning] Recorded trade to DB: ${trade.token.symbol} ${trade.action}`)
    return record.id
  } catch (error) {
    console.error('[Learning] Error recording trade:', error)
    return `fallback-${Date.now()}`
  }
}

// Update trade outcome
export async function updateTradeOutcome(
  tradeId: string, 
  outcome: 'WIN' | 'LOSS',
  exitPrice: number,
  profitPercent: number
): Promise<void> {
  try {
    const trade = await db.tradeRecord.findUnique({
      where: { id: tradeId }
    })
    
    if (!trade) {
      console.log(`[Learning] Trade ${tradeId} not found`)
      return
    }
    
    const now = new Date()
    const holdDuration = now.getTime() - trade.timestamp.getTime()
    const profit = trade.amount * profitPercent
    
    // Update trade record
    await db.tradeRecord.update({
      where: { id: tradeId },
      data: {
        outcome,
        exitPrice,
        exitTimestamp: now,
        profitPercent,
        profit,
        holdDuration
      }
    })
    
    // Update token performance
    await updateTokenStats(trade.tokenSymbol, outcome, profitPercent, holdDuration)
    
    // Update strategy performance
    await updateStrategyStats(trade.strategy, outcome, profit)
    
    // Record pattern
    await recordPattern(trade.aiScore, outcome, profit)
    
    console.log(`[Learning] Updated trade ${tradeId}: ${outcome} ${profitPercent > 0 ? '+' : ''}${(profitPercent * 100).toFixed(2)}%`)
  } catch (error) {
    console.error('[Learning] Error updating trade outcome:', error)
  }
}

// Update token performance stats
async function updateTokenStats(
  symbol: string, 
  outcome: 'WIN' | 'LOSS', 
  profitPercent: number,
  holdDuration: number
): Promise<void> {
  try {
    const existing = await db.tokenPerformance.findUnique({
      where: { symbol }
    })
    
    if (existing) {
      const totalTrades = existing.totalTrades + 1
      const wins = existing.wins + (outcome === 'WIN' ? 1 : 0)
      const losses = existing.losses + (outcome === 'LOSS' ? 1 : 0)
      const totalProfit = existing.totalProfit + profitPercent
      const winRate = wins / totalTrades
      const avgProfitPercent = (existing.avgProfitPercent * existing.totalTrades + profitPercent) / totalTrades
      const bestTrade = Math.max(existing.bestTrade, profitPercent)
      const worstTrade = Math.min(existing.worstTrade, profitPercent)
      const avgHoldDuration = (existing.avgHoldDuration * existing.totalTrades + holdDuration) / totalTrades
      const isBlacklisted = totalTrades >= 3 && winRate < 0.3
      
      await db.tokenPerformance.update({
        where: { symbol },
        data: {
          totalTrades,
          wins,
          losses,
          totalProfit,
          winRate,
          avgProfitPercent,
          bestTrade,
          worstTrade,
          avgHoldDuration,
          isBlacklisted,
          lastTradeAt: new Date()
        }
      })
    } else {
      await db.tokenPerformance.create({
        data: {
          symbol,
          totalTrades: 1,
          wins: outcome === 'WIN' ? 1 : 0,
          losses: outcome === 'LOSS' ? 1 : 0,
          totalProfit: profitPercent,
          avgProfitPercent: profitPercent,
          winRate: outcome === 'WIN' ? 1 : 0,
          bestTrade: profitPercent,
          worstTrade: profitPercent,
          avgHoldDuration: holdDuration,
          isBlacklisted: false,
          lastTradeAt: new Date()
        }
      })
    }
  } catch (error) {
    console.error('[Learning] Error updating token stats:', error)
  }
}

// Update strategy performance stats
async function updateStrategyStats(
  name: string,
  outcome: 'WIN' | 'LOSS',
  profit: number
): Promise<void> {
  try {
    const existing = await db.strategyPerformance.findUnique({
      where: { name }
    })
    
    if (existing) {
      const totalTrades = existing.totalTrades + 1
      const wins = existing.wins + (outcome === 'WIN' ? 1 : 0)
      const totalProfit = existing.totalProfit + profit
      const winRate = wins / totalTrades
      const avgProfit = totalProfit / totalTrades
      
      await db.strategyPerformance.update({
        where: { name },
        data: {
          totalTrades,
          wins,
          totalProfit,
          winRate,
          avgProfit
        }
      })
    } else {
      await db.strategyPerformance.create({
        data: {
          name,
          totalTrades: 1,
          wins: outcome === 'WIN' ? 1 : 0,
          totalProfit: profit,
          winRate: outcome === 'WIN' ? 1 : 0,
          avgProfit: profit
        }
      })
    }
  } catch (error) {
    console.error('[Learning] Error updating strategy stats:', error)
  }
}

// Record trading pattern
async function recordPattern(
  aiScore: number,
  outcome: 'WIN' | 'LOSS',
  profit: number
): Promise<void> {
  try {
    const hour = new Date().getHours()
    const scoreMin = Math.floor(aiScore)
    const scoreMax = Math.ceil(aiScore)
    
    const existing = await db.tradingPattern.findFirst({
      where: {
        aiScoreMin: scoreMin,
        aiScoreMax: scoreMax,
        timeOfDay: hour
      }
    })
    
    if (existing) {
      await db.tradingPattern.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: existing.occurrenceCount + 1,
          totalProfit: existing.totalProfit + profit,
          outcome
        }
      })
    } else {
      await db.tradingPattern.create({
        data: {
          aiScoreMin: scoreMin,
          aiScoreMax: scoreMax,
          timeOfDay: hour,
          sentiment: 'NEUTRAL',
          outcome,
          totalProfit: profit,
          occurrenceCount: 1
        }
      })
    }
  } catch (error) {
    console.error('[Learning] Error recording pattern:', error)
  }
}

// Get learning insights from database
export async function getLearningInsights(): Promise<LearningInsights> {
  try {
    // Get best tokens
    const bestTokens = await db.tokenPerformance.findMany({
      where: {
        totalTrades: { gte: 2 },
        winRate: { gt: 0.5 }
      },
      orderBy: { winRate: 'desc' },
      take: 5
    })
    
    // Get worst tokens
    const worstTokens = await db.tokenPerformance.findMany({
      where: {
        totalTrades: { gte: 2 },
        winRate: { lt: 0.5 }
      },
      orderBy: { winRate: 'asc' },
      take: 5
    })
    
    // Get best strategies
    const bestStrategies = await db.strategyPerformance.findMany({
      where: { totalTrades: { gte: 2 } },
      orderBy: { winRate: 'desc' }
    })
    
    // Get winning trades for score analysis
    const winningTrades = await db.tradeRecord.findMany({
      where: { outcome: 'WIN' },
      select: { aiScore: true }
    })
    
    // Calculate best AI score range
    const scoreCounts: Record<number, number> = {}
    for (const trade of winningTrades) {
      const score = Math.floor(trade.aiScore)
      scoreCounts[score] = (scoreCounts[score] || 0) + 1
    }
    
    const bestScoreEntry = Object.entries(scoreCounts)
      .sort((a, b) => b[1] - a[1])[0]
    
    // Get recent trades for trend analysis
    const recentTrades = await db.tradeRecord.findMany({
      where: { outcome: { in: ['WIN', 'LOSS'] } },
      orderBy: { timestamp: 'desc' },
      take: 20
    })
    
    const last10 = recentTrades.slice(0, 10)
    const prev10 = recentTrades.slice(10, 20)
    
    const recentWinRate = last10.length > 0 
      ? last10.filter(t => t.outcome === 'WIN').length / last10.length 
      : 0
    const previousWinRate = prev10.length > 0
      ? prev10.filter(t => t.outcome === 'WIN').length / prev10.length
      : recentWinRate
    
    const winRateTrend = recentWinRate - previousWinRate
    
    // Recent performance
    const recentPerformance = last10.slice(0, 5)
      .reduce((sum, t) => sum + (t.profitPercent || 0), 0) / 5
    
    // Optimal hold duration
    const winningWithDuration = await db.tradeRecord.findMany({
      where: { 
        outcome: 'WIN',
        holdDuration: { not: null }
      },
      select: { holdDuration: true }
    })
    
    const optimalHoldDuration = winningWithDuration.length > 0
      ? winningWithDuration.reduce((sum, t) => sum + (t.holdDuration || 0), 0) / winningWithDuration.length
      : 60000
    
    // Generate learned rules
    const learnedRules: string[] = []
    
    if (bestTokens.length > 0) {
      learnedRules.push(`Tokens with best win rate: ${bestTokens.map(t => t.symbol).join(', ')}`)
    }
    
    if (worstTokens.length > 0) {
      learnedRules.push(`Avoid tokens: ${worstTokens.map(t => t.symbol).join(', ')}`)
    }
    
    if (bestScoreEntry) {
      learnedRules.push(`Best AI score range: ${bestScoreEntry[0]}/10`)
    }
    
    if (winRateTrend < -0.1) {
      learnedRules.push('Performance declining - consider reducing trade size')
    } else if (winRateTrend > 0.1) {
      learnedRules.push('Performance improving - current strategy working well')
    }
    
    return {
      bestTokens: bestTokens.map(t => ({
        symbol: t.symbol,
        winRate: t.winRate,
        avgProfit: t.avgProfitPercent
      })),
      worstTokens: worstTokens.map(t => ({
        symbol: t.symbol,
        winRate: t.winRate,
        avgLoss: t.avgProfitPercent
      })),
      bestStrategies: bestStrategies.map(s => ({
        name: s.name,
        winRate: s.winRate,
        avgProfit: s.avgProfit
      })),
      bestScoreRange: bestScoreEntry 
        ? [parseInt(bestScoreEntry[0]), parseInt(bestScoreEntry[0]) + 1] 
        : [7, 10],
      optimalHoldDuration,
      winRateTrend,
      recentPerformance,
      learnedRules
    }
  } catch (error) {
    console.error('[Learning] Error getting insights:', error)
    return {
      bestTokens: [],
      worstTokens: [],
      bestStrategies: [],
      bestScoreRange: [7, 10],
      optimalHoldDuration: 60000,
      winRateTrend: 0,
      recentPerformance: 0,
      learnedRules: []
    }
  }
}

// Get token-specific learned data
export async function getTokenLearning(symbol: string): Promise<TokenStats | null> {
  try {
    const token = await db.tokenPerformance.findUnique({
      where: { symbol }
    })
    
    if (!token) return null
    
    return {
      symbol: token.symbol,
      totalTrades: token.totalTrades,
      wins: token.wins,
      losses: token.losses,
      winRate: token.winRate,
      avgProfitPercent: token.avgProfitPercent,
      isBlacklisted: token.isBlacklisted,
      recommendedSizeMultiplier: token.winRate > 0.7 ? 1.2 : 
                                 token.winRate > 0.5 ? 1.0 :
                                 token.winRate > 0.3 ? 0.5 : 0.2
    }
  } catch (error) {
    console.error('[Learning] Error getting token learning:', error)
    return null
  }
}

// Check if token is blacklisted
export async function isTokenBlacklisted(symbol: string): Promise<boolean> {
  try {
    const token = await db.tokenPerformance.findUnique({
      where: { symbol }
    })
    
    if (!token || token.totalTrades < 3) return false
    return token.isBlacklisted || (token.winRate < 0.3 && token.totalTrades >= 3)
  } catch {
    return false
  }
}

// Get recommended trade size
export async function getRecommendedTradeSize(symbol: string, baseSize: number): Promise<number> {
  try {
    const token = await db.tokenPerformance.findUnique({
      where: { symbol }
    })
    
    if (!token) return baseSize
    
    if (token.winRate > 0.7) return baseSize * 1.2
    if (token.winRate > 0.5) return baseSize
    if (token.winRate > 0.3) return baseSize * 0.5
    return baseSize * 0.2
  } catch {
    return baseSize
  }
}

// Get all trade history
export async function getTradeHistory(limit: number = 50) {
  try {
    return await db.tradeRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  } catch (error) {
    console.error('[Learning] Error getting trade history:', error)
    return []
  }
}

// Get all stats
export async function getAllStats(): Promise<{
  totalTrades: number
  wins: number
  losses: number
  pending: number
  totalProfit: number
  winRate: number
  tokenCount: number
}> {
  try {
    const [totalTrades, wins, losses, pending, stats, tokenCount] = await Promise.all([
      db.tradeRecord.count(),
      db.tradeRecord.count({ where: { outcome: 'WIN' } }),
      db.tradeRecord.count({ where: { outcome: 'LOSS' } }),
      db.tradeRecord.count({ where: { outcome: 'PENDING' } }),
      db.tradeRecord.aggregate({
        _sum: { profit: true }
      }),
      db.tokenPerformance.count()
    ])
    
    return {
      totalTrades,
      wins,
      losses,
      pending,
      totalProfit: stats._sum.profit || 0,
      winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
      tokenCount
    }
  } catch (error) {
    console.error('[Learning] Error getting stats:', error)
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalProfit: 0,
      winRate: 0,
      tokenCount: 0
    }
  }
}

// Clear all learning data (reset)
export async function clearMemory(): Promise<void> {
  try {
    await Promise.all([
      db.tradeRecord.deleteMany(),
      db.tokenPerformance.deleteMany(),
      db.strategyPerformance.deleteMany(),
      db.tradingPattern.deleteMany()
    ])
    console.log('[Learning] All learning data cleared')
  } catch (error) {
    console.error('[Learning] Error clearing memory:', error)
  }
}
