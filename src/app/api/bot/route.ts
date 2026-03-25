import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import config from '@/config/config';

const TREASURY_PUBLIC_KEY = config.wallet.address || 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE';
const RPC_ENDPOINT = config.solana.rpcUrl || 'https://api.mainnet-beta.solana.com';

async function getRealBalance(): Promise<number> {
  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const balance = await connection.getBalance(new PublicKey(TREASURY_PUBLIC_KEY));
    return balance / 1_000_000_000;
  } catch { return 0; }
}

let botState = { status: 'STOPPED' as const, totalTrades: 0, wins: 0, losses: 0 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const balance = await getRealBalance();

  if (action === 'balance') {
    return NextResponse.json({ success: true, balance, wallet: TREASURY_PUBLIC_KEY, mode: 'REAL' });
  }

  return NextResponse.json({
    success: true,
    data: { status: botState.status, mode: 'REAL', balance, ...botState, winRate: botState.totalTrades > 0 ? botState.wins / botState.totalTrades : 0 }
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === 'start') botState.status = 'RUNNING';
  if (body.action === 'stop') botState.status = 'STOPPED';
  return NextResponse.json({ success: true, status: botState.status });
}
