import { NextRequest, NextResponse } from 'next/server'
import { getBotState, startBot, stopBot } from '@/lib/auto-trading-bot'

export async function GET() {
  const state = getBotState()
  return NextResponse.json({
    success: true,
    bot: {
      isRunning: state.isRunning,
      startTime: state.startTime,
      lastTradeTime: state.lastTradeTime,
      balance: state.balance,
      stats: {
        totalTrades: state.totalTrades,
        successfulTrades: state.successfulTrades,
        failedTrades: state.failedTrades,
        successRate: state.totalTrades > 0 ? ((state.successfulTrades / state.totalTrades) * 100).toFixed(1) : 0,
      },
      positions: state.currentPositions,
      recentLogs: state.logs.slice(0, 20),
    },
    config: {
      treasuryWallet: process.env.TREASURY_PUBLIC_KEY || 'Not set',
      hasPrivateKey: !!process.env.TREASURY_PRIVATE_KEY,
    },
  })
}

export async function POST(request: NextRequest) {
  const { action } = await request.json()
  if (action === 'start') return NextResponse.json({ success: startBot(), state: getBotState() })
  if (action === 'stop') { stopBot(); return NextResponse.json({ success: true, state: getBotState() }) }
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
}
