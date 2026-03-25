import { NextRequest, NextResponse } from 'next/server'
import { analyzeToken, generateTradingSignal, analyzeMarketSentiment, assessRisk } from '@/services/aiAgentService'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'AI Agent API',
    endpoints: [
      'POST action=analyze - Analyze a token',
      'POST action=signal - Generate trading signal',
      'POST action=sentiment - Analyze market sentiment',
      'POST action=risk - Assess risk',
      'POST action=full-analysis - Full analysis including sentiment'
    ]
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'analyze': {
        // Analyze a token
        if (!data?.token) {
          return NextResponse.json({ error: 'Token data required' }, { status: 400 })
        }
        const analysis = await analyzeToken(data.token)
        return NextResponse.json({ success: true, analysis })
      }

      case 'signal': {
        // Generate trading signal
        if (!data?.token || data?.portfolioBalance === undefined) {
          return NextResponse.json({ error: 'Token and portfolio balance required' }, { status: 400 })
        }
        const signal = await generateTradingSignal(data)
        return NextResponse.json({ success: true, signal })
      }

      case 'sentiment': {
        // Analyze market sentiment
        if (!data?.symbol) {
          return NextResponse.json({ error: 'Token symbol required' }, { status: 400 })
        }
        const sentiment = await analyzeMarketSentiment(data.symbol)
        return NextResponse.json({ success: true, sentiment })
      }

      case 'risk': {
        // Assess risk
        if (!data?.tokenSymbol) {
          return NextResponse.json({ error: 'Token symbol required' }, { status: 400 })
        }
        const risk = await assessRisk(data)
        return NextResponse.json({ success: true, risk })
      }

      case 'full-analysis': {
        // Full analysis including sentiment
        if (!data?.token) {
          return NextResponse.json({ error: 'Token data required' }, { status: 400 })
        }
        
        const [analysis, sentiment] = await Promise.all([
          analyzeToken(data.token),
          analyzeMarketSentiment(data.token.symbol)
        ])
        
        return NextResponse.json({
          success: true,
          analysis,
          sentiment,
          combinedScore: analysis.score + (sentiment.sentiment === 'BULLISH' ? 1 : sentiment.sentiment === 'BEARISH' ? -1 : 0)
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('AI Agent error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
