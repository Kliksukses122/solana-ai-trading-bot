/**
 * Trading Bot API Route
 * 
 * Provides REST API for dashboard
 */

import { NextResponse } from 'next/server';

// Simulated trading bot state (in production, this would connect to actual bot)
function getBotState() {
  return {
    status: 'RUNNING',
    mode: 'MOCK',
    balance: 10.5,
    totalPnL: 2.34,
    totalTrades: 156,
    winRate: 0.62,
    currentDrawdown: 0.04,

    strategies: {
      SNIPER: { trades: 45, wins: 28, pnl: 1.12, enabled: true },
      WHALE: { trades: 52, wins: 33, pnl: 0.89, enabled: true },
      MOMENTUM: { trades: 38, wins: 22, pnl: 0.45, enabled: true },
      COMBO: { trades: 21, wins: 14, pnl: -0.12, enabled: true },
    },

    adaptiveConfig: {
      minScore: 6,
      takeProfit: 0.08,
      stopLoss: 0.02,
      tradeSize: 0.012,
      weights: { whale: 5, early: 3, momentum: 2, volume: 2, liquidity: 2, combo: 3 },
    },

    learning: {
      enabled: true,
      learningInterval: 20,
      lastLearningTime: Date.now() - 3600000,
      learningCount: 7,
    },

    recentTrades: [],
    signals: [],
    agentLogs: [],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Different endpoints
  if (action === 'status') {
    return NextResponse.json({
      success: true,
      data: getBotState(),
    });
  }

  if (action === 'summary') {
    const state = getBotState();
    return NextResponse.json({
      success: true,
      data: {
        isRunning: state.status === 'RUNNING',
        mode: state.mode,
        stats: {
          balance: state.balance,
          totalPnL: state.totalPnL,
          totalTrades: state.totalTrades,
          winRate: state.winRate,
          currentDrawdown: state.currentDrawdown,
        },
        strategies: state.strategies,
        learning: state.learning,
        adaptiveConfig: state.adaptiveConfig,
      },
    });
  }

  // Default: return full state
  return NextResponse.json({
    success: true,
    data: getBotState(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'start':
        return NextResponse.json({
          success: true,
          message: 'Bot started',
          data: { status: 'RUNNING' },
        });

      case 'stop':
        return NextResponse.json({
          success: true,
          message: 'Bot stopped',
          data: { status: 'STOPPED' },
        });

      case 'forceLearn':
        return NextResponse.json({
          success: true,
          message: 'Learning cycle triggered',
          data: { learningCount: 8 },
        });

      case 'toggleStrategy':
        return NextResponse.json({
          success: true,
          message: `Strategy ${params.strategy} toggled`,
          data: { strategy: params.strategy },
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
        }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
