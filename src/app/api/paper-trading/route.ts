import { NextRequest, NextResponse } from 'next/server'
import {
  initPaperTrading,
  openPaperPosition,
  updatePaperPrices,
  closePaperPosition,
  getPaperPortfolio,
  getPaperTradeLogs,
  getEquityCurve,
  getPaperPerformanceSummary
} from '@/services/paperTradingService'

// GET - Get paper trading status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    switch (action) {
      case 'portfolio':
        return NextResponse.json({
          success: true,
          portfolio: getPaperPortfolio()
        })
      
      case 'logs':
        const limit = parseInt(searchParams.get('limit') || '50')
        return NextResponse.json({
          success: true,
          logs: getPaperTradeLogs(limit)
        })
      
      case 'equity':
        return NextResponse.json({
          success: true,
          equityCurve: getEquityCurve()
        })
      
      case 'summary':
        return NextResponse.json({
          success: true,
          ...getPaperPerformanceSummary()
        })
      
      default:
        return NextResponse.json({
          success: true,
          portfolio: getPaperPortfolio(),
          summary: getPaperPerformanceSummary()
        })
    }
  } catch (error: any) {
    console.error('Paper trading API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Execute paper trading actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, params } = body
    
    switch (action) {
      case 'init':
        const initialBalance = params?.initialBalance || 10
        const portfolio = initPaperTrading(initialBalance)
        return NextResponse.json({
          success: true,
          message: `Paper trading initialized with ${initialBalance} SOL`,
          portfolio
        })
      
      case 'open':
        const openResult = openPaperPosition(params)
        if (!openResult.success) {
          return NextResponse.json({
            success: false,
            error: openResult.error
          }, { status: 400 })
        }
        return NextResponse.json({
          success: true,
          position: openResult.position,
          portfolio: getPaperPortfolio()
        })
      
      case 'update':
        const { closedPositions, portfolio: updatedPortfolio } = updatePaperPrices(params.priceUpdates)
        return NextResponse.json({
          success: true,
          closedPositions,
          portfolio: updatedPortfolio
        })
      
      case 'close':
        const closedPosition = closePaperPosition(
          params.positionId,
          params.exitPrice,
          params.reason || 'MANUAL'
        )
        if (!closedPosition) {
          return NextResponse.json({
            success: false,
            error: 'Position not found'
          }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          position: closedPosition,
          portfolio: getPaperPortfolio()
        })
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Paper trading API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
