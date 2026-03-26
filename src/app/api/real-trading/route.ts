import { NextRequest, NextResponse } from 'next/server'
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'

const RPC = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
const JUPITER = 'https://quote-api.jup.ag/v6'
const SOL = 'So11111111111111111111111111111111111111112'

function getWallet() {
  try {
    const key = process.env.TREASURY_PRIVATE_KEY
    if (!key) return null
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(key)))
  } catch { return null }
}

async function getBalance() {
  const wallet = getWallet()
  if (!wallet) return 0
  const conn = new Connection(RPC, 'confirmed')
  return (await conn.getBalance(wallet.publicKey)) / LAMPORTS_PER_SOL
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const wallet = getWallet()
  const balance = await getBalance()
  
  if (searchParams.get('action') === 'balance') {
    return NextResponse.json({ success: true, balance, wallet: wallet?.publicKey.toBase58(), mode: 'REAL' })
  }
  
  if (searchParams.get('action') === 'quote') {
    const res = await fetch(`${JUPITER}/quote?inputMint=${SOL}&outputMint=${searchParams.get('token')}&amount=${searchParams.get('amount')}&slippageBps=500`)
    return NextResponse.json({ success: true, quote: await res.json() })
  }
  
  return NextResponse.json({ success: true, balance, wallet: wallet?.publicKey.toBase58(), mode: 'REAL' })
}

export async function POST(req: NextRequest) {
  const body = await request.json()
  const wallet = getWallet()
  if (!wallet) return NextResponse.json({ success: false, error: 'Wallet not configured' }, { status: 500 })
  
  const balance = await getBalance()
  const { action, tokenMint, amountSOL } = body
  
  if (action === 'buy' && tokenMint && amountSOL) {
    if (balance < amountSOL) return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 })
    
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL)
    const quoteRes = await fetch(`${JUPITER}/quote?inputMint=${SOL}&outputMint=${tokenMint}&amount=${lamports}&slippageBps=500`)
    const quote = await quoteRes.json()
    
    const swapRes = await fetch(`${JUPITER}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteResponse: quote, userPublicKey: wallet.publicKey.toBase58(), wrapAndUnwrapSol: true, prioritizationFeeLamports: 'auto' })
    })
    const { swapTransaction } = await swapRes.json()
    
    const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'))
    tx.sign([wallet])
    
    const conn = new Connection(RPC, 'confirmed')
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true })
    await conn.confirmTransaction(sig, 'confirmed')
    
    return NextResponse.json({ success: true, action: 'BUY', signature: sig, explorer: `https://solscan.io/tx/${sig}` })
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
}
