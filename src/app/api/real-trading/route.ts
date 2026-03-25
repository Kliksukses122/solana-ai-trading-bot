import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import config from '@/config/config';
import bs58 from 'bs58';

const RPC_ENDPOINT = config.solana.rpcUrl || 'https://api.mainnet-beta.solana.com';
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

function getTreasuryKeypair(): Keypair | null {
  try {
    const privateKey = config.wallet.privateKey;
    if (!privateKey) return null;
    
    if (privateKey.startsWith('[')) {
      const secretKey = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(secretKey));
    } else {
      const secretKey = bs58.decode(privateKey);
      return Keypair.fromSecretKey(secretKey);
    }
  } catch { return null; }
}

async function getRealBalance(): Promise<number> {
  try {
    const keypair = getTreasuryKeypair();
    if (!keypair) return 0;
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    const balance = await connection.getBalance(keypair.publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch { return 0; }
}

async function getJupiterQuote(inputMint: string, outputMint: string, amount: number, slippageBps = 500) {
  const url = `${JUPITER_QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
  const response = await fetch(url);
  return response.ok ? await response.json() : null;
}

async function executeSwap(keypair: Keypair, quoteResponse: any) {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: keypair.publicKey.toString(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  const { swapTransaction } = await swapResponse.json();
  const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  transaction.sign([keypair]);
  const txid = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
  await connection.confirmTransaction(txid, 'confirmed');
  return txid;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  const balance = await getRealBalance();
  const keypair = getTreasuryKeypair();
  
  if (action === 'balance') {
    return NextResponse.json({ success: true, balance, wallet: keypair?.publicKey.toString(), mode: 'REAL' });
  }
  
  if (action === 'quote') {
    const quote = await getJupiterQuote(SOL_MINT, searchParams.get('outputMint')!, parseInt(searchParams.get('amount')!));
    return NextResponse.json({ success: !!quote, quote });
  }
  
  return NextResponse.json({ success: true, balance, wallet: keypair?.publicKey.toString(), mode: 'REAL' });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, tokenMint, amountSOL } = body;
  const keypair = getTreasuryKeypair();
  
  if (!keypair) return NextResponse.json({ success: false, error: 'No wallet configured' }, { status: 500 });
  
  const balance = await getRealBalance();
  
  if (action === 'buy' && tokenMint && amountSOL) {
    if (balance < amountSOL) return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 });
    const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
    const quote = await getJupiterQuote(SOL_MINT, tokenMint, amountLamports);
    if (!quote) return NextResponse.json({ success: false, error: 'Quote failed' }, { status: 500 });
    const signature = await executeSwap(keypair, quote);
    return NextResponse.json({ success: true, action: 'BUY', signature, explorer: `https://solscan.io/tx/${signature}` });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}
