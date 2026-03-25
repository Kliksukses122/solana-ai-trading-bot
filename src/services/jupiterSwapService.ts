'use server'

/**
 * Jupiter Swap Service - Real Swap Execution
 * Executes swaps automatically using treasury wallet without user signing
 */

import { Connection, Keypair, VersionedTransaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'
const SOL_MINT = 'So11111111111111111111111111111111111111112'

interface QuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
}

interface SwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  priorityFeeLamports: number
}

// Get connection
function getConnection(): Connection {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
  return new Connection(rpcUrl, 'confirmed')
}

// Get treasury wallet keypair from private key
function getTreasuryKeypair(): Keypair | null {
  try {
    const privateKey = process.env.TREASURY_PRIVATE_KEY
    if (!privateKey) {
      console.error('TREASURY_PRIVATE_KEY not set in environment')
      return null
    }
    
    // Parse private key (can be base58 or JSON array format)
    let secretKey: Uint8Array
    
    if (privateKey.startsWith('[')) {
      // JSON array format
      secretKey = new Uint8Array(JSON.parse(privateKey))
    } else {
      // Base58 format - need to decode
      const bs58 = require('bs58')
      secretKey = bs58.default.decode(privateKey)
    }
    
    return Keypair.fromSecretKey(secretKey)
  } catch (error) {
    console.error('Error parsing treasury private key:', error)
    return null
  }
}

// Fetch quote from Jupiter
export async function fetchQuote(
  inputMint: string,
  outputMint: string,
  amount: number, // in lamports for SOL, smallest unit for tokens
  slippageBps: number = 100
): Promise<QuoteResponse | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    })
    
    const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`)
    
    if (!response.ok) {
      console.error('Quote API error:', response.status, await response.text())
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching quote:', error)
    return null
  }
}

// Get swap transaction from Jupiter
export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string
): Promise<SwapResponse | null> {
  try {
    const response = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    })
    
    if (!response.ok) {
      console.error('Swap API error:', response.status, await response.text())
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error getting swap transaction:', error)
    return null
  }
}

// Execute swap with treasury wallet
export async function executeSwap(
  outputMint: string,
  amountSol: number,
  slippageBps: number = 100
): Promise<{
  success: boolean
  signature?: string
  inputAmount?: number
  outputAmount?: number
  error?: string
  explorerUrl?: string
}> {
  try {
    const connection = getConnection()
    const treasuryKeypair = getTreasuryKeypair()
    
    if (!treasuryKeypair) {
      return {
        success: false,
        error: 'Treasury wallet not configured. Set TREASURY_PRIVATE_KEY in environment.'
      }
    }
    
    const treasuryPubkey = treasuryKeypair.publicKey
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
    
    console.log(`[Jupiter] Executing swap: ${amountSol} SOL -> Token ${outputMint}`)
    console.log(`[Jupiter] Treasury: ${treasuryPubkey.toBase58()}`)
    
    // Check balance
    const balance = await connection.getBalance(treasuryPubkey)
    if (balance < amountLamports) {
      return {
        success: false,
        error: `Insufficient balance. Have ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL, need ${amountSol} SOL`
      }
    }
    
    // 1. Get quote
    console.log('[Jupiter] Fetching quote...')
    const quote = await fetchQuote(SOL_MINT, outputMint, amountLamports, slippageBps)
    
    if (!quote) {
      return { success: false, error: 'Failed to get quote from Jupiter' }
    }
    
    console.log(`[Jupiter] Quote: ${quote.outAmount} output tokens, price impact: ${quote.priceImpactPct}%`)
    
    // 2. Get swap transaction
    console.log('[Jupiter] Building swap transaction...')
    const swapResponse = await getSwapTransaction(quote, treasuryPubkey.toBase58())
    
    if (!swapResponse) {
      return { success: false, error: 'Failed to build swap transaction' }
    }
    
    // 3. Deserialize and sign transaction
    console.log('[Jupiter] Signing transaction...')
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64')
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
    
    // Sign with treasury keypair
    transaction.sign([treasuryKeypair])
    
    // 4. Send transaction
    console.log('[Jupiter] Sending transaction...')
    const rawTransaction = transaction.serialize()
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    })
    
    console.log(`[Jupiter] Transaction sent: ${txid}`)
    
    // 5. Confirm transaction
    const latestBlockHash = await connection.getLatestBlockhash()
    const confirmation = await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed')
    
    if (confirmation.value.err) {
      console.error('[Jupiter] Transaction failed:', confirmation.value.err)
      return {
        success: false,
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        signature: txid,
      }
    }
    
    console.log(`[Jupiter] Transaction confirmed: ${txid}`)
    
    return {
      success: true,
      signature: txid,
      inputAmount: amountSol,
      outputAmount: parseInt(quote.outAmount),
      explorerUrl: `https://solscan.io/tx/${txid}`,
    }
    
  } catch (error) {
    console.error('[Jupiter] Swap error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Get token balance for treasury wallet
export async function getTokenBalance(
  tokenMint: string
): Promise<number> {
  try {
    const connection = getConnection()
    const treasuryKeypair = getTreasuryKeypair()
    
    if (!treasuryKeypair) return 0
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      treasuryKeypair.publicKey,
      { mint: new PublicKey(tokenMint) }
    )
    
    if (tokenAccounts.value.length === 0) return 0
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
    return balance
  } catch (error) {
    console.error('Error getting token balance:', error)
    return 0
  }
}

// Get SOL balance for treasury wallet
export async function getSolBalance(): Promise<number> {
  try {
    const connection = getConnection()
    const treasuryKeypair = getTreasuryKeypair()
    
    if (!treasuryKeypair) return 0
    
    const balance = await connection.getBalance(treasuryKeypair.publicKey)
    return balance / LAMPORTS_PER_SOL
  } catch (error) {
    console.error('Error getting SOL balance:', error)
    return 0
  }
}

// Sell token back to SOL
export async function executeSell(
  inputMint: string,
  amount: number, // in smallest unit
  slippageBps: number = 100
): Promise<{
  success: boolean
  signature?: string
  outputAmount?: number
  error?: string
}> {
  try {
    const connection = getConnection()
    const treasuryKeypair = getTreasuryKeypair()
    
    if (!treasuryKeypair) {
      return { success: false, error: 'Treasury wallet not configured' }
    }
    
    const treasuryPubkey = treasuryKeypair.publicKey
    
    // Get quote (token -> SOL)
    const quote = await fetchQuote(inputMint, SOL_MINT, amount, slippageBps)
    
    if (!quote) {
      return { success: false, error: 'Failed to get quote' }
    }
    
    // Get swap transaction
    const swapResponse = await getSwapTransaction(quote, treasuryPubkey.toBase58())
    
    if (!swapResponse) {
      return { success: false, error: 'Failed to build swap transaction' }
    }
    
    // Sign and send
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64')
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
    transaction.sign([treasuryKeypair])
    
    const rawTransaction = transaction.serialize()
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    })
    
    // Confirm
    const latestBlockHash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed')
    
    return {
      success: true,
      signature: txid,
      outputAmount: parseInt(quote.outAmount) / LAMPORTS_PER_SOL,
    }
    
  } catch (error) {
    console.error('Sell error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
