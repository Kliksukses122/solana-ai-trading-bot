/**
 * Slippage Protection Service - Proteksi terhadap slippage tinggi
 * Estimasi slippage sebelum swap dan reject jika terlalu tinggi
 */

export interface SlippageEstimate {
  inputMint: string
  outputMint: string
  inputAmount: number
  expectedOutput: number
  minimumOutput: number
  priceImpact: number // percent
  slippageBps: number // basis points
  route: string[]
  warning: string | null
  canProceed: boolean
  recommendation: string
}

export interface SlippageConfig {
  maxSlippageBps: number // Default max 200 (2%)
  maxPriceImpact: number // Default max 5%
  minLiquidityUsd: number // Default min $10k
  warningSlippageBps: number // Warn at 100 bps (1%)
}

const DEFAULT_CONFIG: SlippageConfig = {
  maxSlippageBps: 200, // 2%
  maxPriceImpact: 5, // 5%
  minLiquidityUsd: 10000, // $10k minimum liquidity
  warningSlippageBps: 100 // 1%
}

// Token decimals map
const TOKEN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9, // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
}

// === ESTIMATE SLIPPAGE ===
export async function estimateSlippage(
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  customConfig?: Partial<SlippageConfig>
): Promise<SlippageEstimate> {
  const config = { ...DEFAULT_CONFIG, ...customConfig }
  
  try {
    // Get quote from Jupiter
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${config.maxSlippageBps}`
    
    const response = await fetch(quoteUrl)
    const quote = await response.json()
    
    if (quote.error) {
      return createErrorEstimate(inputMint, outputMint, inputAmount, quote.error)
    }
    
    // Parse quote data
    const inputAmountNum = parseFloat(quote.inAmount) || inputAmount
    const expectedOutput = parseFloat(quote.outAmount) || 0
    const priceImpact = parseFloat(quote.priceImpactPct) || 0
    const route = quote.routePlan?.map((r: any) => r.swapInfo?.label || 'Unknown') || []
    
    // Calculate minimum output with slippage
    const slippageMultiplier = 1 - (config.maxSlippageBps / 10000)
    const minimumOutput = expectedOutput * slippageMultiplier
    
    // Check liquidity (approximate from quote)
    const routeInfo = quote.routePlan?.[0]?.swapInfo || {}
    const liquidityUsd = estimateLiquidityFromQuote(routeInfo)
    
    // Determine warnings and if can proceed
    let warning: string | null = null
    let canProceed = true
    let recommendation = ''
    
    // Check price impact
    if (Math.abs(priceImpact) > config.maxPriceImpact) {
      warning = `High price impact: ${Math.abs(priceImpact).toFixed(2)}%`
      canProceed = false
      recommendation = `Price impact too high. Reduce trade size or find alternative route.`
    }
    // Check slippage
    else if (config.maxSlippageBps >= config.warningSlippageBps * 2) {
      warning = `High slippage expected: ${(config.maxSlippageBps / 100).toFixed(1)}%`
      recommendation = 'Consider splitting into smaller trades.'
    }
    // Check liquidity
    else if (liquidityUsd < config.minLiquidityUsd) {
      warning = `Low liquidity: $${(liquidityUsd / 1000).toFixed(1)}K`
      canProceed = false
      recommendation = 'Insufficient liquidity. Find another pool or DEX.'
    }
    // Normal case
    else {
      recommendation = 'Trade looks good. Proceed with caution.'
    }
    
    return {
      inputMint,
      outputMint,
      inputAmount: inputAmountNum,
      expectedOutput,
      minimumOutput,
      priceImpact: Math.abs(priceImpact),
      slippageBps: config.maxSlippageBps,
      route,
      warning,
      canProceed,
      recommendation
    }
    
  } catch (error) {
    console.error('[Slippage] Error estimating:', error)
    return createErrorEstimate(inputMint, outputMint, inputAmount, 'Failed to get quote')
  }
}

// === ESTIMATE LIQUIDITY FROM QUOTE ===
function estimateLiquidityFromQuote(routeInfo: any): number {
  // Estimate liquidity from feeAmount and other data
  // This is approximate - real implementation would query on-chain data
  const feeAmount = parseFloat(routeInfo.feeAmount || '0')
  const lpFee = parseFloat(routeInfo.lpFee || '0')
  
  // Rough estimate: liquidity ~ fees / 0.003 (0.3% fee typical)
  const estimatedLiquidity = (feeAmount + lpFee) / 0.003
  
  // Minimum $50k if we can't estimate
  return Math.max(estimatedLiquidity, 50000)
}

// === CREATE ERROR ESTIMATE ===
function createErrorEstimate(
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  error: string
): SlippageEstimate {
  return {
    inputMint,
    outputMint,
    inputAmount,
    expectedOutput: 0,
    minimumOutput: 0,
    priceImpact: 100,
    slippageBps: 10000,
    route: [],
    warning: `Error: ${error}`,
    canProceed: false,
    recommendation: 'Cannot estimate slippage. Do not proceed.'
  }
}

// === CHECK IF TRADE SAFE ===
export async function isTradeSafe(
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  customConfig?: Partial<SlippageConfig>
): Promise<{ safe: boolean; reason: string; estimate: SlippageEstimate }> {
  
  const estimate = await estimateSlippage(inputMint, outputMint, inputAmount, customConfig)
  
  if (!estimate.canProceed) {
    return {
      safe: false,
      reason: estimate.warning || 'Unknown issue',
      estimate
    }
  }
  
  if (estimate.priceImpact > 5) {
    return {
      safe: false,
      reason: `Price impact too high: ${estimate.priceImpact.toFixed(2)}%`,
      estimate
    }
  }
  
  if (estimate.slippageBps > 300) {
    return {
      safe: false,
      reason: `Slippage too high: ${(estimate.slippageBps / 100).toFixed(1)}%`,
      estimate
    }
  }
  
  return {
    safe: true,
    reason: 'Trade is safe to proceed',
    estimate
  }
}

// === GET OPTIMAL SLIPPAGE ===
export function getOptimalSlippage(
  liquidityUsd: number,
  tradeSizeUsd: number,
  volatility: 'LOW' | 'MEDIUM' | 'HIGH'
): number {
  // Base slippage based on liquidity
  let baseSlippage: number
  
  if (liquidityUsd > 1000000) {
    baseSlippage = 0.5 // 0.5% for high liquidity
  } else if (liquidityUsd > 100000) {
    baseSlippage = 1.0 // 1% for medium liquidity
  } else if (liquidityUsd > 10000) {
    baseSlippage = 2.0 // 2% for low liquidity
  } else {
    baseSlippage = 5.0 // 5% for very low liquidity
  }
  
  // Adjust for trade size relative to liquidity
  const sizeRatio = tradeSizeUsd / liquidityUsd
  const sizeAdjustment = sizeRatio * 100 // Each 1% of liquidity adds ~1% slippage
  
  // Adjust for volatility
  const volatilityMultiplier = volatility === 'HIGH' ? 1.5 : volatility === 'LOW' ? 0.8 : 1.0
  
  const optimalSlippage = (baseSlippage + sizeAdjustment) * volatilityMultiplier
  
  // Cap at reasonable level
  return Math.min(Math.max(optimalSlippage, 0.5), 10)
}

// === SPLIT LARGE TRADE ===
export function suggestTradeSplit(
  inputMint: string,
  outputMint: string,
  totalAmount: number,
  maxSlippageBps: number = 200
): { splits: number[]; estimatedSavings: number } {
  // Suggest splitting into smaller trades
  const numSplits = Math.ceil(totalAmount / 1000000000) // Split per 1 SOL equivalent
  const splitAmount = Math.floor(totalAmount / numSplits)
  
  const splits: number[] = []
  let remaining = totalAmount
  
  for (let i = 0; i < numSplits; i++) {
    if (remaining >= splitAmount) {
      splits.push(splitAmount)
      remaining -= splitAmount
    } else if (remaining > 0) {
      splits.push(remaining)
      remaining = 0
    }
  }
  
  // Estimate savings (rough approximation)
  const singleTradeSlippage = maxSlippageBps / 100
  const splitTradeSlippage = (maxSlippageBps * 0.7) / 100 // ~30% less slippage
  const estimatedSavings = singleTradeSlippage - splitTradeSlippage
  
  return {
    splits,
    estimatedSavings: estimatedSavings * totalAmount / 100
  }
}

// === CHECK ROUTE QUALITY ===
export function checkRouteQuality(route: string[]): {
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  reasons: string[]
} {
  const reasons: string[] = []
  let score = 0
  
  // Check number of hops
  if (route.length === 1) {
    score += 40
    reasons.push('Direct route')
  } else if (route.length === 2) {
    score += 30
    reasons.push('2-hop route')
  } else if (route.length <= 4) {
    score += 20
    reasons.push(`${route.length}-hop route`)
  } else {
    score += 10
    reasons.push(`Long route (${route.length} hops)`)
  }
  
  // Check for preferred DEXes
  const preferredDEXes = ['Raydium', 'Orca', 'Meteora', 'Phoenix']
  const hasPreferred = route.some(r => preferredDEXes.some(d => r.includes(d)))
  if (hasPreferred) {
    score += 30
    reasons.push('Uses preferred DEX')
  }
  
  // Check for unknown DEXes
  const knownDEXes = [...preferredDEXes, 'Whirlpool', 'Crema', 'Sencha', 'Lifinity']
  const hasUnknown = route.some(r => !knownDEXes.some(d => r.includes(d)))
  if (hasUnknown) {
    score -= 20
    reasons.push('Uses unknown DEX')
  }
  
  // Determine quality
  let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  if (score >= 60) quality = 'EXCELLENT'
  else if (score >= 40) quality = 'GOOD'
  else if (score >= 20) quality = 'FAIR'
  else quality = 'POOR'
  
  return { quality, reasons }
}

// === REAL-TIME SLIPPAGE MONITOR ===
export class SlippageMonitor {
  private history: { timestamp: number; actual: number; estimated: number }[] = []
  
  record(estimated: number, actual: number): void {
    this.history.push({
      timestamp: Date.now(),
      estimated,
      actual
    })
    
    // Keep last 100 records
    if (this.history.length > 100) {
      this.history.shift()
    }
  }
  
  getAccuracy(): { avgDiff: number; maxDiff: number; accuracy: number } {
    if (this.history.length === 0) {
      return { avgDiff: 0, maxDiff: 0, accuracy: 100 }
    }
    
    const diffs = this.history.map(h => Math.abs(h.actual - h.estimated))
    const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length
    const maxDiff = Math.max(...diffs)
    
    // Accuracy as percentage (lower diff = higher accuracy)
    const accuracy = Math.max(0, 100 - avgDiff * 10)
    
    return { avgDiff, maxDiff, accuracy }
  }
  
  getRecentSlippage(count: number = 10): number[] {
    return this.history.slice(-count).map(h => h.actual)
  }
}

// === EXPORT SINGLETON MONITOR ===
export const slippageMonitor = new SlippageMonitor()

// === EXPORT CONFIG ===
export { DEFAULT_CONFIG as SLIPPAGE_CONFIG }
