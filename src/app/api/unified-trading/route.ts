import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Simple endpoints that don't require learning service
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  try {
    switch (action) {
      case 'readiness': {
        // Get basic stats from database
        const [totalTrades, wins, losses] = await Promise.all([
          db.tradeRecord.count(),
          db.tradeRecord.count({ where: { outcome: 'WIN' } }),
          db.tradeRecord.count({ where: { outcome: 'LOSS' } }),
        ])
        
        const winRate = wins + losses > 0 ? wins / (wins + losses) : 0
        
        // Calculate grade
        let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F'
        if (winRate >= 0.65) grade = 'A'
        else if (winRate >= 0.55) grade = 'B'
        else if (winRate >= 0.45) grade = 'C'
        else if (winRate >= 0.35) grade = 'D'
        
        const recommendations: string[] = []
        if (totalTrades < 20) {
          recommendations.push(`Need more trades (${totalTrades}/20)`)
        }
        if (winRate < 0.55) {
          recommendations.push('Win rate too low. Adjust SL/TP.')
        }
        
        return NextResponse.json({
          success: true,
          readiness: {
            grade,
            isReadyForReal: grade === 'A' || grade === 'B',
            winRate,
            profitFactor: wins > 0 ? wins / (losses || 1) : 0,
            maxDrawdown: 0,
            totalTrades,
            recommendations
          }
        })
      }
      
      case 'stats': {
        const stats = await db.tradeRecord.aggregate({
          _count: true,
          _sum: { profit: true }
        })
        
        const wins = await db.tradeRecord.count({ where: { outcome: 'WIN' } })
        const losses = await db.tradeRecord.count({ where: { outcome: 'LOSS' } })
        
        return NextResponse.json({
          success: true,
          stats: {
            totalTrades: stats._count,
            wins,
            losses,
            pending: await db.tradeRecord.count({ where: { outcome: 'PENDING' } }),
            totalProfit: stats._sum.profit || 0,
            winRate: wins + losses > 0 ? wins / (wins + losses) : 0,
            tokenCount: await db.tokenPerformance.count()
          }
        })
      }
      
      case 'history': {
        const limit = parseInt(searchParams.get('limit') || '50')
        const history = await db.tradeRecord.findMany({
          orderBy: { timestamp: 'desc' },
          take: limit
        })
        return NextResponse.json({ success: true, history })
      }
      
      case 'tokens': {
        const tokens = await db.tokenPerformance.findMany({
          orderBy: { winRate: 'desc' },
          take: 10
        })
        return NextResponse.json({ success: true, tokens })
      }
      
      default:
        return NextResponse.json({
          success: true,
          message: 'Unified Trading API',
          endpoints: {
            'GET ?action=readiness': 'Check strategy readiness',
            'GET ?action=stats': 'Get all stats',
            'GET ?action=history': 'Get trade history',
            'GET ?action=tokens': 'Get token performance',
            'POST action=record': 'Record a trade',
            'POST action=update': 'Update trade outcome'
          }
        })
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body
    
    switch (action) {
      case 'record': {
        // Record a new trade
        const trade = await db.tradeRecord.create({
          data: {
            tokenSymbol: data.token.symbol,
            tokenName: data.token.name,
            tokenMint: data.token.mint || '',
            action: data.action,
            amount: data.amount,
            entryPrice: data.entryPrice,
            strategy: data.strategy || 'PAPER_TRADING',
            aiScore: data.confidence ? data.confidence / 10 : 5,
            aiRecommendation: data.reasoning || '',
            marketCondition: data.signals?.join(', ') || '',
            outcome: 'PENDING'
          }
        })
        
        return NextResponse.json({
          success: true,
          tradeId: trade.id,
          message: 'Trade recorded'
        })
      }
      
      case 'update': {
        const { tradeId, outcome, exitPrice, profitPercent } = data
        
        const trade = await db.tradeRecord.findUnique({
          where: { id: tradeId }
        })
        
        if (!trade) {
          return NextResponse.json({
            success: false,
            error: 'Trade not found'
          }, { status: 404 })
        }
        
        const now = new Date()
        const holdDuration = now.getTime() - trade.timestamp.getTime()
        const profit = trade.amount * (profitPercent || 0)
        
        // Update trade
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
        const existing = await db.tokenPerformance.findUnique({
          where: { symbol: trade.tokenSymbol }
        })
        
        if (existing) {
          const totalTrades = existing.totalTrades + 1
          const wins = existing.wins + (outcome === 'WIN' ? 1 : 0)
          const losses = existing.losses + (outcome === 'LOSS' ? 1 : 0)
          const winRate = wins / totalTrades
          
          await db.tokenPerformance.update({
            where: { symbol: trade.tokenSymbol },
            data: {
              totalTrades,
              wins,
              losses,
              winRate,
              avgProfitPercent: (existing.avgProfitPercent * existing.totalTrades + (profitPercent || 0)) / totalTrades,
              isBlacklisted: totalTrades >= 3 && winRate < 0.3,
              lastTradeAt: now
            }
          })
        } else {
          await db.tokenPerformance.create({
            data: {
              symbol: trade.tokenSymbol,
              totalTrades: 1,
              wins: outcome === 'WIN' ? 1 : 0,
              losses: outcome === 'LOSS' ? 1 : 0,
              winRate: outcome === 'WIN' ? 1 : 0,
              avgProfitPercent: profitPercent || 0,
              bestTrade: profitPercent || 0,
              worstTrade: profitPercent || 0,
              isBlacklisted: false,
              lastTradeAt: now
            }
          })
        }
        
        return NextResponse.json({
          success: true,
          message: `Trade updated: ${outcome}`
        })
      }
      
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('POST Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
