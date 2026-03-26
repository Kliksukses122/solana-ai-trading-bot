/**
 * Auto Trading Bot - Runs automatically on server startup
 * No browser needed - fully server-side autonomous trading
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } from '@solana/web3.js'

// ============ CONFIGURATION ============
const CONFIG = {
  TREASURY_PUBLIC_KEY: process.env.TREASURY_PUBLIC_KEY || 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE',
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  JUPITER_API: 'https://quote-api.jup.ag/v6',
  SOL_MINT: 'So11111111111111111111111111111111111111112',
  
  // Trading parameters
  MIN_BALANCE: 0.005,
  TRADE_SIZE_PERCENT: 0.05,
  MIN_TRADE_SIZE: 0.001,
  MAX_TRADE_SIZE: 0.01,
  SLIPPAGE_BPS: 100,
  CONFIDENCE_THRESHOLD: 50,
  TRADE_INTERVAL_MS: 60000,
  
  TARGET_TOKENS: [
    { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
    { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { symbol: 'POPCAT', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
    { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  ],
}

interface BotState {
  isRunning: boolean
  startTime: Date | null
  lastTradeTime: Date | null
  totalTrades: number
  successfulTrades: number
  failedTrades: number
  balance: number
  logs: Array<{ time: Date; message: string; type: 'info' | 'success' | 'error' | 'trade' }>
  currentPositions: Array<{
    symbol: string
    mint: string
    amount: number
    entryPrice: number
    entryTime: Date
    txSignature: string
  }>
}

const state: BotState = {
  isRunning: false,
  startTime: null,
  lastTradeTime: null,
  totalTrades: 0,
  successfulTrades: 0,
  failedTrades: 0,
  balance: 0,
  logs: [],
  currentPositions: [],
}

let connection: Connection | null = null
let keypair: Keypair | null = null
let intervalId: NodeJS.Timeout | null = null

function log(message: string, type: 'info' | 'success' | 'error' | 'trade' = 'info') {
  const timestamp = new Date().toISOString()
  state.logs.unshift({ time: new Date(), message, type })
  if (state.logs.length > 100) state.logs.pop()
  const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'trade' ? '💰' : 'ℹ️'
  console.log(`[BOT] ${timestamp} ${emoji} ${message}`)
}

function initializeConnection(): boolean {
  try {
    if (!connection) {
      connection = new Connection(CONFIG.RPC_URL, 'confirmed')
      log('Connected to Solana RPC', 'success')
    }
    
    if (!keypair && CONFIG.TREASURY_PRIVATE_KEY) {
      let secretKey: Uint8Array
      if (CONFIG.TREASURY_PRIVATE_KEY.startsWith('[')) {
        secretKey = new Uint8Array(JSON.parse(CONFIG.TREASURY_PRIVATE_KEY))
      } else {
        const bs58 = require('bs58')
        secretKey = bs58.default.decode(CONFIG.TREASURY_PRIVATE_KEY)
      }
      keypair = Keypair.fromSecretKey(secretKey)
      log(`Treasury wallet loaded: ${keypair.publicKey.toBase58()}`, 'success')
    }
    return true
  } catch (error) {
    log(`Failed to initialize: ${error}`, 'error')
    return false
  }
}

async function getBalance(): Promise<number> {
  if (!connection || !keypair) return 0
  try {
    const balance = await connection.getBalance(keypair.publicKey)
    return balance / LAMPORTS_PER_SOL
  } catch (error) {
    log(`Error getting balance: ${error}`, 'error')
    return 0
  }
}

async function getTokenData(mint: string) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
    const data = await res.json()
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs.find((p: any) => p.chainId === 'solana') || data.pairs[0]
      return {
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        price: parseFloat(pair.priceUsd) || 0,
        priceChange24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        liquidity: pair.liquidity?.usd || 0,
      }
    }
    return null
  } catch { return null }
}

async function analyzeToken(tokenData: any) {
  let score = 0
  const reasons: string[] = []
  
  if (tokenData.priceChange24h > 20) { score += 25; reasons.push('Strong momentum') }
  else if (tokenData.priceChange24h > 10) { score += 15; reasons.push('Good momentum') }
  else if (tokenData.priceChange24h > 0) { score += 5; reasons.push('Positive') }
  
  if (tokenData.volume24h > 1000000) { score += 25; reasons.push('High volume') }
  else if (tokenData.volume24h > 100000) { score += 15; reasons.push('Good volume') }
  
  if (tokenData.liquidity > 100000) { score += 25; reasons.push('High liquidity') }
  else if (tokenData.liquidity > 50000) { score += 15; reasons.push('Good liquidity') }
  
  const confidence = Math.max(0, Math.min(100, score + 30))
  return { shouldBuy: confidence >= CONFIG.CONFIDENCE_THRESHOLD, confidence, reasoning: reasons.join(' | ') }
}

async function executeSwap(outputMint: string, amountSol: number) {
  if (!connection || !keypair) return { success: false, error: 'Not initialized' }
  
  try {
    const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
    
    const quoteUrl = `${CONFIG.JUPITER_API}/quote?inputMint=${CONFIG.SOL_MINT}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${CONFIG.SLIPPAGE_BPS}`
    const quoteRes = await fetch(quoteUrl)
    if (!quoteRes.ok) return { success: false, error: 'Quote failed' }
    const quoteData = await quoteRes.json()
    
    const swapRes = await fetch(`${CONFIG.JUPITER_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    })
    const swapData = await swapRes.json()
    
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64')
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
    transaction.sign([keypair])
    
    const rawTransaction = transaction.serialize()
    const txid = await connection.sendRawTransaction(rawTransaction, { skipPreflight: true, maxRetries: 2 })
    
    const latestBlockHash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed')
    
    return { success: true, signature: txid, outputAmount: parseInt(quoteData.outAmount) }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

async function runTradingCycle() {
  if (!state.isRunning) return
  
  try {
    const balance = await getBalance()
    state.balance = balance
    
    if (balance < CONFIG.MIN_BALANCE) {
      log(`Balance too low: ${balance.toFixed(4)} SOL`, 'error')
      return
    }
    
    const token = CONFIG.TARGET_TOKENS[Math.floor(Math.random() * CONFIG.TARGET_TOKENS.length)]
    log(`Analyzing ${token.symbol}...`, 'info')
    
    const tokenData = await getTokenData(token.mint)
    if (!tokenData) { log(`No data for ${token.symbol}`, 'error'); return }
    
    log(`${token.symbol}: $${tokenData.price.toFixed(8)} | 24h: ${tokenData.priceChange24h.toFixed(1)}%`, 'info')
    
    const analysis = await analyzeToken(tokenData)
    log(`Decision: ${analysis.shouldBuy ? 'BUY' : 'SKIP'} (${analysis.confidence}%)`, 'info')
    
    if (analysis.shouldBuy && analysis.confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
      let tradeSize = Math.min(balance * CONFIG.TRADE_SIZE_PERCENT, CONFIG.MAX_TRADE_SIZE)
      if (tradeSize > balance - 0.001) tradeSize = balance - 0.001
      
      if (tradeSize >= CONFIG.MIN_TRADE_SIZE) {
        log(`BUY: ${tradeSize.toFixed(4)} SOL -> ${token.symbol}`, 'trade')
        const result = await executeSwap(token.mint, tradeSize)
        
        state.totalTrades++
        state.lastTradeTime = new Date()
        
        if (result.success) {
          state.successfulTrades++
          log(`SUCCESS! TX: ${result.signature}`, 'success')
          state.currentPositions.push({
            symbol: token.symbol, mint: token.mint,
            amount: result.outputAmount || 0, entryPrice: tokenData.price,
            entryTime: new Date(), txSignature: result.signature || '',
          })
          state.balance = await getBalance()
        } else {
          state.failedTrades++
          log(`FAILED: ${result.error}`, 'error')
        }
      }
    }
  } catch (error) {
    log(`Cycle error: ${error}`, 'error')
  }
}

export function startBot(): boolean {
  if (state.isRunning) return true
  if (!CONFIG.TREASURY_PRIVATE_KEY) { log('TREASURY_PRIVATE_KEY not set!', 'error'); return false }
  if (!initializeConnection()) return false
  
  state.isRunning = true
  state.startTime = new Date()
  
  log('🚀 AUTO TRADING BOT STARTED', 'success')
  runTradingCycle()
  intervalId = setInterval(runTradingCycle, CONFIG.TRADE_INTERVAL_MS)
  return true
}

export function stopBot() {
  if (intervalId) clearInterval(intervalId)
  state.isRunning = false
  log('🛑 BOT STOPPED', 'info')
}

export function getBotState() { return { ...state, logs: [...state.logs], currentPositions: [...state.currentPositions] } }
export function isBotRunning() { return state.isRunning }
