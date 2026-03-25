import { NextRequest, NextResponse } from 'next/server'
import { 
  professionalTokenAnalysis,
  analyzeMarketSentimentEnhanced
} from '@/services/professionalAIAgent'
import { 
  canTrade, 
  calculatePositionSize, 
  getDailyStats,
  validateTradeRequest,
  MAX_RISK_PER_TRADE,
  MAX_DAILY_LOSS,
  MAX_OPEN_TRADES,
  MAX_TRADES_PER_DAY,
  LOSS_STREAK_KILL_SWITCH,
  type RiskState 
} from '@/services/riskEngine'
import {
  getMarketCondition,
  checkTokenQuality,
  shouldTrade,
  type TokenMarketData
} from '@/services/marketRegimeFilter'
import { getEnhancedLearningInsights } from '@/services/enhancedLearningService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'professional-analysis': {
        // Full professional analysis with risk management
        if (!data?.token || !data?.riskState) {
          return NextResponse.json({ error: 'Token and riskState required' }, { status: 400 })
        }
        
        const result = await professionalTokenAnalysis(
          data.token,
          data.riskState as RiskState,
          data.solTrend || 'SIDEWAYS',
          data.btcTrend || 'SIDEWAYS'
        )
        
        return NextResponse.json({ success: true, analysis: result })
      }

      case 'risk-check': {
        // Check if trading is allowed
        if (!data?.riskState) {
          return NextResponse.json({ error: 'riskState required' }, { status: 400 })
        }
        
        const result = canTrade(data.riskState as RiskState)
        return NextResponse.json({ success: true, result })
      }

      case 'position-size': {
        // Calculate position size
        if (!data?.balance || !data?.entryPrice || !data?.stopLoss) {
          return NextResponse.json({ error: 'balance, entryPrice, stopLoss required' }, { status: 400 })
        }
        
        const result = calculatePositionSize(
          data.balance,
          data.entryPrice,
          data.stopLoss,
          data.riskPerTrade || MAX_RISK_PER_TRADE
        )
        
        return NextResponse.json({ success: true, ...result })
      }

      case 'validate-trade': {
        // Validate trade request
        if (!data?.tradeRequest || !data?.riskState) {
          return NextResponse.json({ error: 'tradeRequest and riskState required' }, { status: 400 })
        }
        
        const result = validateTradeRequest(data.tradeRequest, data.riskState as RiskState)
        return NextResponse.json({ success: true, result })
      }

      case 'market-condition': {
        // Get market condition
        const { solTrend, btcTrend } = data || {}
        const result = getMarketCondition(solTrend || 'SIDEWAYS', btcTrend || 'SIDEWAYS')
        return NextResponse.json({ success: true, condition: result })
      }

      case 'token-quality': {
        // Check token quality
        if (!data?.token) {
          return NextResponse.json({ error: 'Token data required' }, { status: 400 })
        }
        
        const result = checkTokenQuality(data.token as TokenMarketData)
        return NextResponse.json({ success: true, quality: result })
      }

      case 'sentiment': {
        // Enhanced sentiment analysis
        if (!data?.symbol) {
          return NextResponse.json({ error: 'Token symbol required' }, { status: 400 })
        }
        
        const result = await analyzeMarketSentimentEnhanced(data.symbol)
        return NextResponse.json({ success: true, sentiment: result })
      }

      case 'daily-stats': {
        // Get daily trading stats
        if (!data?.riskState) {
          return NextResponse.json({ error: 'riskState required' }, { status: 400 })
        }
        
        const result = getDailyStats(data.riskState as RiskState)
        return NextResponse.json({ success: true, stats: result })
      }

      case 'should-trade': {
        // Combined check: should we trade?
        if (!data?.marketCondition || !data?.tokenQuality) {
          return NextResponse.json({ error: 'marketCondition and tokenQuality required' }, { status: 400 })
        }
        
        const result = shouldTrade(data.marketCondition, data.tokenQuality)
        return NextResponse.json({ success: true, result })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Professional AI Agent error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'risk-constants': {
        return NextResponse.json({
          success: true,
          constants: {
            MAX_RISK_PER_TRADE,
            MAX_DAILY_LOSS,
            MAX_OPEN_TRADES,
            MAX_TRADES_PER_DAY,
            LOSS_STREAK_KILL_SWITCH
          }
        })
      }

      case 'learning-insights': {
        const insights = getEnhancedLearningInsights()
        return NextResponse.json({ success: true, insights })
      }

      default:
        return NextResponse.json({ 
          success: true,
          message: 'Professional AI Agent API',
          endpoints: [
            'POST /api/professional-agent - Professional analysis',
            'POST action=risk-check - Check trading permission',
            'POST action=position-size - Calculate position size',
            'POST action=validate-trade - Validate trade request',
            'POST action=market-condition - Get market condition',
            'POST action=token-quality - Check token quality',
            'POST action=sentiment - Enhanced sentiment analysis',
            'POST action=daily-stats - Daily trading stats',
            'GET action=risk-constants - Get risk constants',
            'GET action=learning-insights - Get learning insights'
          ]
        })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
