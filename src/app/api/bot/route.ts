import { NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'

const WALLET = 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE'
const RPC = 'https://api.mainnet-beta.solana.com'

export async function GET() {
  const conn = new Connection(RPC, 'confirmed')
  const balance = await conn.getBalance(new PublicKey(WALLET)).then(b => b / 1e9).catch(() => 0)
  
  return NextResponse.json({
    success: true,
    data: { status: 'RUNNING', mode: 'REAL', balance, wallet: WALLET }
  })
}

export async function POST(req: Request) {
  return NextResponse.json({ success: true, message: 'OK' })
}
