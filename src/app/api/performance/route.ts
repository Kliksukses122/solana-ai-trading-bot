import { NextRequest, NextResponse } from 'next/server'
import {
  initPerformanceTracker,
  recordTrade,
  calculateMetrics,
  getEquityCurve,
  getTradeHistory,
  getDailyStats,
  exportPerformanceReport
} from '@/services/performanceMetricsService'

// GET - Get performance metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    switch (action) {
      case 'metrics':
        return NextResponse.json({
          success: true,
          metrics: calculateMetrics()
        })
      
      case 'equity':
        return NextResponse.json({
          success: true,
          equityCurve: getEquityCurve()
        })
      
      case 'trades':
        const limit = parseInt(searchParams.get('limit') || '100')
        return NextResponse.json({
          success: true,
          trades: getTradeHistory(limit)
        })
      
      case 'daily':
        const days = parseInt(searchParams.get('days') || '30')
        return NextResponse.json({
          success: true,
          dailyStats: getDailyStats(days)
        })
      
      case 'export':
        return NextResponse.json({
          success: true,
          report: exportPerformanceReport()
        })
      
      default:
        return NextResponse.json({
          success: true,
          metrics: calculateMetrics(),
          recentTrades: getTradeHistory(10)
        })
    }
  } catch (error: any) {
    console.error('Performance API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// POST - Initialize or record trade
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, params } = body
    
    switch (action) {
      case 'init':
        const balance = params?.balance || 100
        initPerformanceTracker(balance)
        return NextResponse.json({
          success: true,
          message: `Performance tracker initialized with ${balance} SOL`
        })
      
      case 'record':
        const tradeId = recordTrade(params)
        return NextResponse.json({
          success: true,
          tradeId,
          metrics: calculateMetrics()
        })
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action'
        }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Performance API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
