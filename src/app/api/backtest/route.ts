import { NextRequest, NextResponse } from 'next/server'
import { runBacktest, quickBacktest, DEFAULT_CONFIG } from '@/services/backtestingEngine'

// GET - Get backtest config
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      defaultConfig: DEFAULT_CONFIG,
      description: 'Use POST to run a backtest with custom parameters'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Run backtest
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, params } = body
    
    if (type === 'quick') {
      // Quick simulation with specified parameters
      const result = quickBacktest(
        params?.numTrades || 100,
        params?.winRate || 0.55,
        params?.avgWinPercent || 8,
        params?.avgLossPercent || 4
      )
      
      return NextResponse.json({
        success: true,
        result
      })
    }
    
    if (type === 'full') {
      // Full backtest with token list
      const tokenList = params?.tokenList || [
        { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
        { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' }
      ]
      
      const config = params?.config || {}
      
      const result = await runBacktest(tokenList, config)
      
      return NextResponse.json({
        success: true,
        result
      })
    }
    
    // Default: run quick backtest with default params
    const result = quickBacktest()
    
    return NextResponse.json({
      success: true,
      result
    })
    
  } catch (error: any) {
    console.error('Backtest API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
