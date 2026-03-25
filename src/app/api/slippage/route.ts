import { NextRequest, NextResponse } from 'next/server'
import {
  estimateSlippage,
  isTradeSafe,
  getOptimalSlippage,
  suggestTradeSplit,
  checkRouteQuality,
  slippageMonitor
} from '@/services/slippageProtectionService'

// GET - Get slippage config and monitor status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'monitor') {
      return NextResponse.json({
        success: true,
        monitor: {
          accuracy: slippageMonitor.getAccuracy(),
          recentSlippage: slippageMonitor.getRecentSlippage(10)
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      config: {
        maxSlippageBps: 200, // 2%
        maxPriceImpact: 5, // 5%
        minLiquidityUsd: 10000
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Estimate or check slippage
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, params } = body
    
    switch (action) {
      case 'estimate':
        const estimate = await estimateSlippage(
          params.inputMint,
          params.outputMint,
          params.inputAmount,
          params.config
        )
        return NextResponse.json({
          success: true,
          estimate
        })
      
      case 'check':
        const safetyCheck = await isTradeSafe(
          params.inputMint,
          params.outputMint,
          params.inputAmount,
          params.config
        )
        return NextResponse.json({
          success: true,
          ...safetyCheck
        })
      
      case 'optimal':
        const optimalSlippage = getOptimalSlippage(
          params.liquidityUsd,
          params.tradeSizeUsd,
          params.volatility || 'MEDIUM'
        )
        return NextResponse.json({
          success: true,
          optimalSlippage
        })
      
      case 'split':
        const splitSuggestion = suggestTradeSplit(
          params.inputMint,
          params.outputMint,
          params.totalAmount,
          params.maxSlippageBps
        )
        return NextResponse.json({
          success: true,
          ...splitSuggestion
        })
      
      case 'route':
        const routeQuality = checkRouteQuality(params.route)
        return NextResponse.json({
          success: true,
          ...routeQuality
        })
      
      case 'record':
        slippageMonitor.record(params.estimated, params.actual)
        return NextResponse.json({
          success: true,
          accuracy: slippageMonitor.getAccuracy()
        })
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Slippage API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
