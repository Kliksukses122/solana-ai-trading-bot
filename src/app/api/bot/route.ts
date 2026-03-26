// src/app/api/bot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import tradingEngine from '@/services/trading-engine';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'status') {
      const state = tradingEngine.getState();
      const balance = await tradingEngine.getBalance();
      
      return NextResponse.json({
        ...state,
        balance,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'start') {
      const interval = parseInt(searchParams.get('interval') || '300000'); // 5 minutes
      tradingEngine.start(interval);
      
      return NextResponse.json({
        success: true,
        message: 'Trading bot started',
        state: tradingEngine.getState(),
      });
    }

    if (action === 'stop') {
      tradingEngine.stop();
      
      return NextResponse.json({
        success: true,
        message: 'Trading bot stopped',
        state: tradingEngine.getState(),
      });
    }

    if (action === 'analyze') {
      await tradingEngine.runAnalysisAndTrade();
      
      return NextResponse.json({
        success: true,
        message: 'Analysis cycle completed',
        state: tradingEngine.getState(),
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use: status, start, stop, analyze' }, { status: 400 });
  } catch (error: any) {
    console.error('Bot API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, interval } = body;

    if (action === 'start') {
      tradingEngine.start(interval || 300000);
      return NextResponse.json({ success: true, message: 'Bot started' });
    }

    if (action === 'stop') {
      tradingEngine.stop();
      return NextResponse.json({ success: true, message: 'Bot stopped' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
