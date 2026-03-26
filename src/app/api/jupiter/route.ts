import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from '@/config/config';

const connection = new Connection(config.solana.rpcUrl, 'confirmed');
const treasuryPublicKey = new PublicKey(config.treasury.publicKey);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'balance') {
      const balance = await connection.getBalance(treasuryPublicKey);
      return NextResponse.json({
        balance: balance / LAMPORTS_PER_SOL,
        wallet: config.treasury.publicKey,
      });
    }

    if (action === 'price') {
      const mint = searchParams.get('mint') || config.tokens.SOL;
      const response = await fetch(`https://quote-api.jup.ag/v6/price?ids=${mint}`);
      const data = await response.json();
      return NextResponse.json(data);
    }

    if (action === 'quote') {
      const inputMint = searchParams.get('inputMint');
      const outputMint = searchParams.get('outputMint');
      const amount = searchParams.get('amount');
      
      const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
      const response = await fetch(url);
      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, inputMint, outputMint, amount } = body;

    // Get quote from Jupiter
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (!quoteData.outAmount) {
      return NextResponse.json({ success: false, error: 'Failed to get quote' });
    }

    // Get swap transaction
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: config.treasury.publicKey,
        wrapAndUnwrapSol: true,
      }),
    });
    const swapData = await swapResponse.json();

    // Note: To execute the transaction, you need to sign it with the treasury private key
    // This requires additional implementation with @solana/web3.js Keypair

    return NextResponse.json({
      success: true,
      quote: quoteData,
      swapTransaction: swapData.swapTransaction,
      message: 'Transaction prepared. Sign and send to execute.',
    });
  } catch (error: any) {
    console.error('Trade Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
