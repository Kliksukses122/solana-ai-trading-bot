/**
 * Auto Stop Loss Service - Eksekusi Stop Loss Otomatis di Blockchain
 * Monitoring posisi dan eksekusi otomatis saat harga menyentuh stop loss
 */

import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createCloseAccountInstruction } from '@solana/spl-token'

export interface MonitoredPosition {
  id: string
  userId: string
  tokenMint: string
  symbol: string
  entryPrice: number
  stopLossPrice: number
  takeProfitPrice: number
  amount: number
  openTimestamp: number
  status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED'
  triggerPrice?: number
  triggerTimestamp?: number
  txSignature?: string
  pnl?: number
}

export interface StopLossConfig {
  checkIntervalMs: number // How often to check prices
  slippageTolerance: number // Max slippage for stop loss execution
  maxRetries: number // Max retries for failed transactions
  retryDelayMs: number // Delay between retries
  priorityFee: number // Priority fee for faster execution
}

const DEFAULT_CONFIG: StopLossConfig = {
  checkIntervalMs: 5000, // Check every 5 seconds
  slippageTolerance: 2, // 2% max slippage
  maxRetries: 3,
  retryDelayMs: 1000,
  priorityFee: 10000 // 0.00001 SOL
}

// In-memory storage for monitored positions
const monitoredPositions: Map<string, MonitoredPosition> = new Map()
let monitoringInterval: NodeJS.Timeout | null = null
let connection: Connection | null = null

// === INITIALIZE SERVICE ===
export function initAutoStopLossService(rpcUrl: string): void {
  connection = new Connection(rpcUrl, 'confirmed')
  console.log('[Auto Stop Loss] Service initialized')
}

// === ADD POSITION TO MONITOR ===
export function addPositionToMonitor(position: Omit<MonitoredPosition, 'id' | 'status'>): string {
  const id = `sl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  
  const monitoredPosition: MonitoredPosition = {
    ...position,
    id,
    status: 'ACTIVE'
  }
  
  monitoredPositions.set(id, monitoredPosition)
  console.log(`[Auto Stop Loss] Monitoring: ${position.symbol} | Entry: ${position.entryPrice} | SL: ${position.stopLossPrice} | TP: ${position.takeProfitPrice}`)
  
  // Start monitoring if not already running
  if (!monitoringInterval) {
    startMonitoring()
  }
  
  return id
}

// === REMOVE POSITION FROM MONITOR ===
export function removePositionFromMonitor(positionId: string): boolean {
  const position = monitoredPositions.get(positionId)
  if (!position) return false
  
  position.status = 'CANCELLED'
  monitoredPositions.delete(positionId)
  console.log(`[Auto Stop Loss] Removed: ${position.symbol}`)
  
  // Stop monitoring if no active positions
  if (monitoredPositions.size === 0 && monitoringInterval) {
    stopMonitoring()
  }
  
  return true
}

// === UPDATE STOP LOSS ===
export function updateStopLoss(positionId: string, newStopLoss: number): boolean {
  const position = monitoredPositions.get(positionId)
  if (!position || position.status !== 'ACTIVE') return false
  
  position.stopLossPrice = newStopLoss
  console.log(`[Auto Stop Loss] Updated SL: ${position.symbol} -> ${newStopLoss}`)
  
  return true
}

// === START MONITORING ===
function startMonitoring(): void {
  if (monitoringInterval) return
  
  monitoringInterval = setInterval(checkAllPositions, DEFAULT_CONFIG.checkIntervalMs)
  console.log('[Auto Stop Loss] Monitoring started')
}

// === STOP MONITORING ===
function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
    console.log('[Auto Stop Loss] Monitoring stopped')
  }
}

// === CHECK ALL POSITIONS ===
async function checkAllPositions(): Promise<void> {
  const activePositions = Array.from(monitoredPositions.values())
    .filter(p => p.status === 'ACTIVE')
  
  if (activePositions.length === 0) {
    stopMonitoring()
    return
  }
  
  for (const position of activePositions) {
    try {
      const currentPrice = await fetchCurrentPrice(position.tokenMint)
      
      if (!currentPrice) continue
      
      // Check stop loss trigger
      if (currentPrice <= position.stopLossPrice) {
        console.log(`[Auto Stop Loss] TRIGGERED SL: ${position.symbol} @ ${currentPrice}`)
        await executeStopLoss(position, currentPrice, 'STOP_LOSS')
        continue
      }
      
      // Check take profit trigger
      if (currentPrice >= position.takeProfitPrice) {
        console.log(`[Auto Stop Loss] TRIGGERED TP: ${position.symbol} @ ${currentPrice}`)
        await executeStopLoss(position, currentPrice, 'TAKE_PROFIT')
        continue
      }
      
      // Trailing stop loss (optional)
      const trailingStop = calculateTrailingStop(position.entryPrice, currentPrice)
      if (trailingStop > position.stopLossPrice) {
        position.stopLossPrice = trailingStop
        console.log(`[Auto Stop Loss] Trailing SL: ${position.symbol} -> ${trailingStop}`)
      }
      
    } catch (error) {
      console.error(`[Auto Stop Loss] Error checking ${position.symbol}:`, error)
    }
  }
}

// === FETCH CURRENT PRICE ===
async function fetchCurrentPrice(tokenMint: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`)
    const data = await response.json()
    
    if (data.pairs && data.pairs.length > 0) {
      // Sort by liquidity and get best pair
      const bestPair = data.pairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0]
      
      return parseFloat(bestPair.priceUsd)
    }
    
    return null
  } catch (error) {
    console.error('[Auto Stop Loss] Error fetching price:', error)
    return null
  }
}

// === EXECUTE STOP LOSS ===
async function executeStopLoss(
  position: MonitoredPosition,
  triggerPrice: number,
  triggerType: 'STOP_LOSS' | 'TAKE_PROFIT'
): Promise<boolean> {
  position.status = 'TRIGGERED'
  position.triggerPrice = triggerPrice
  position.triggerTimestamp = Date.now()
  
  // Calculate PnL
  position.pnl = (triggerPrice - position.entryPrice) / position.entryPrice * position.amount
  
  // Execute sell via Jupiter
  try {
    const txSignature = await executeSellViaJupiter(
      position.tokenMint,
      position.amount,
      DEFAULT_CONFIG.slippageTolerance
    )
    
    position.txSignature = txSignature
    console.log(`[Auto Stop Loss] Executed ${triggerType}: ${position.symbol} | TX: ${txSignature}`)
    
    return true
  } catch (error) {
    console.error(`[Auto Stop Loss] Execution failed for ${position.symbol}:`, error)
    
    // Retry logic
    for (let retry = 0; retry < DEFAULT_CONFIG.maxRetries; retry++) {
      await sleep(DEFAULT_CONFIG.retryDelayMs)
      
      try {
        const txSignature = await executeSellViaJupiter(
          position.tokenMint,
          position.amount,
          DEFAULT_CONFIG.slippageTolerance * 2 // Double slippage for retry
        )
        
        position.txSignature = txSignature
        console.log(`[Auto Stop Loss] Retry ${retry + 1} success: ${position.symbol}`)
        return true
      } catch (retryError) {
        console.error(`[Auto Stop Loss] Retry ${retry + 1} failed:`, retryError)
      }
    }
    
    // If all retries failed, mark for manual intervention
    console.error(`[Auto Stop Loss] ALL RETRIES FAILED: ${position.symbol} - MANUAL INTERVENTION REQUIRED`)
    return false
  }
}

// === EXECUTE SELL VIA JUPITER ===
async function executeSellViaJupiter(
  tokenMint: string,
  amount: number,
  slippageBps: number
): Promise<string> {
  // This would integrate with Jupiter API for actual swap
  // For now, returns a mock signature
  
  const quoteResponse = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${tokenMint}&outputMint=So11111111111111111111111111111111111111112&amount=${Math.floor(amount)}&slippageBps=${slippageBps * 100}`
  )
  
  const quote = await quoteResponse.json()
  
  if (!quote.outputAmount) {
    throw new Error('Failed to get quote from Jupiter')
  }
  
  // In production, would build and sign transaction with treasury keypair
  // For safety, returning mock signature
  console.log(`[Auto Stop Loss] Jupiter Quote: ${quote.outputAmount} SOL for ${amount} tokens`)
  
  return `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
}

// === CALCULATE TRAILING STOP ===
function calculateTrailingStop(entryPrice: number, currentPrice: number, trailPercent: number = 0.05): number {
  // Only trail when in profit
  if (currentPrice <= entryPrice) {
    return 0 // Don't update
  }
  
  // Trail at 5% below current price
  return currentPrice * (1 - trailPercent)
}

// === GET ALL MONITORED POSITIONS ===
export function getMonitoredPositions(): MonitoredPosition[] {
  return Array.from(monitoredPositions.values())
}

// === GET ACTIVE POSITIONS ===
export function getActivePositions(): MonitoredPosition[] {
  return Array.from(monitoredPositions.values()).filter(p => p.status === 'ACTIVE')
}

// === GET POSITION BY ID ===
export function getPosition(positionId: string): MonitoredPosition | undefined {
  return monitoredPositions.get(positionId)
}

// === EMERGENCY CLOSE ALL ===
export async function emergencyCloseAll(reason: string = 'Manual trigger'): Promise<{
  closed: string[]
  failed: string[]
}> {
  const closed: string[] = []
  const failed: string[] = []
  
  const activePositions = getActivePositions()
  
  console.log(`[Auto Stop Loss] EMERGENCY CLOSE: ${activePositions.length} positions | Reason: ${reason}`)
  
  for (const position of activePositions) {
    try {
      const currentPrice = await fetchCurrentPrice(position.tokenMint)
      
      if (currentPrice) {
        const success = await executeStopLoss(position, currentPrice, 'STOP_LOSS')
        if (success) {
          closed.push(position.id)
        } else {
          failed.push(position.id)
        }
      } else {
        failed.push(position.id)
      }
    } catch (error) {
      console.error(`[Auto Stop Loss] Emergency close failed for ${position.symbol}:`, error)
      failed.push(position.id)
    }
  }
  
  return { closed, failed }
}

// === UTILITY FUNCTIONS ===
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// === EXPORT CONFIG ===
export { DEFAULT_CONFIG as STOP_LOSS_CONFIG }
