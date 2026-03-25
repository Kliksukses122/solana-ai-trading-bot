import { NextRequest, NextResponse } from 'next/server'
import { 
  recordTrade, 
  updateTradeOutcome, 
  getLearningInsights, 
  getTokenLearning,
  isTokenBlacklisted,
  getRecommendedTradeSize,
  getTradeHistory,
  getAllStats,
  clearMemory
} from '@/services/aiLearningService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'record-trade': {
        const tradeId = recordTrade(data)
        return NextResponse.json({ success: true, tradeId })
      }

      case 'update-outcome': {
        const { tradeId, outcome, exitPrice, profitPercent } = data
        updateTradeOutcome(tradeId, outcome, exitPrice, profitPercent)
        return NextResponse.json({ success: true })
      }

      case 'get-insights': {
        const insights = getLearningInsights()
        return NextResponse.json({ success: true, insights })
      }

      case 'token-stats': {
        const stats = getTokenLearning(data.symbol)
        return NextResponse.json({ success: true, stats })
      }

      case 'check-blacklist': {
        const blacklisted = isTokenBlacklisted(data.symbol)
        return NextResponse.json({ success: true, blacklisted })
      }

      case 'recommended-size': {
        const size = getRecommendedTradeSize(data.symbol, data.baseSize)
        return NextResponse.json({ success: true, recommendedSize: size })
      }

      case 'history': {
        const history = getTradeHistory(data?.limit || 50)
        return NextResponse.json({ success: true, history })
      }

      case 'stats': {
        const stats = getAllStats()
        return NextResponse.json({ success: true, stats })
      }

      case 'clear': {
        clearMemory()
        return NextResponse.json({ success: true, message: 'Memory cleared' })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Learning API error:', error)
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
      case 'insights': {
        const insights = getLearningInsights()
        return NextResponse.json({ success: true, insights })
      }

      case 'stats': {
        const stats = getAllStats()
        return NextResponse.json({ success: true, stats })
      }

      case 'history': {
        const limit = parseInt(searchParams.get('limit') || '50')
        const history = getTradeHistory(limit)
        return NextResponse.json({ success: true, history })
      }

      default:
        return NextResponse.json({ 
          success: true, 
          stats: getAllStats(),
          insights: getLearningInsights()
        })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
