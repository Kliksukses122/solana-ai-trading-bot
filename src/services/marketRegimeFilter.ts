/**
 * Market Regime Filter Service
 * Determines market conditions to filter low-quality trading environments
 */

// === TYPES ===
export type MarketRegime = 'BULL' | 'BEAR' | 'CHOPPY' | 'VOLATILE';
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

export interface MarketData {
  solPrice: number;
  solChange24h: number;
  solChange1h: number;
  solVolume24h: number;
  btcPrice: number;
  btcChange24h: number;
  marketCap: number;
  totalVolume: number;
  fearGreedIndex?: number;
}

export interface TokenMarketData {
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  volumeSpikePercent: number;
  rsi: number;
  liquidityDepth: number;
  spread: number;
  volatility: number;
  trendDirection: TrendDirection;
  correlationWithSol: number;
}

export interface MarketCondition {
  regime: MarketRegime;
  solTrend: TrendDirection;
  btcTrend: TrendDirection;
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  tradeable: boolean;
  reason: string;
  riskMultiplier: number;
}

// === MARKET REGIME DETECTION ===
export function getMarketCondition(solTrend: TrendDirection, btcTrend: TrendDirection): MarketCondition {
  let regime: MarketRegime;
  let tradeable: boolean;
  let reason: string;
  let riskMultiplier = 1.0;
  
  // Determine regime based on SOL and BTC trends
  if (solTrend === 'UP' && btcTrend === 'UP') {
    regime = 'BULL';
    tradeable = true;
    reason = 'Strong bullish alignment - SOL and BTC both trending up';
    riskMultiplier = 1.0; // Normal risk
  } else if (solTrend === 'DOWN' && btcTrend === 'DOWN') {
    regime = 'BEAR';
    tradeable = false;
    reason = 'Bearish market - both SOL and BTC trending down. NO TRADE';
    riskMultiplier = 0; // No trading
  } else if (solTrend === 'SIDEWAYS' && btcTrend === 'SIDEWAYS') {
    regime = 'CHOPPY';
    tradeable = false;
    reason = 'Choppy market - no clear direction. NO TRADE';
    riskMultiplier = 0;
  } else if (solTrend === 'DOWN' || btcTrend === 'DOWN') {
    regime = 'CHOPPY';
    tradeable = false;
    reason = 'Mixed signals with downward pressure. NO TRADE';
    riskMultiplier = 0;
  } else {
    regime = 'CHOPPY';
    tradeable = false;
    reason = 'Unclear market conditions. NO TRADE';
    riskMultiplier = 0;
  }
  
  return {
    regime,
    solTrend,
    btcTrend,
    volatilityLevel: 'MEDIUM',
    tradeable,
    reason,
    riskMultiplier
  };
}

// === DETERMINE TREND ===
export function determineTrend(
  change1h: number,
  change24h: number,
  threshold: number = 2
): TrendDirection {
  const avgChange = (change1h + change24h) / 2;
  
  if (avgChange > threshold) {
    return 'UP';
  } else if (avgChange < -threshold) {
    return 'DOWN';
  } else {
    return 'SIDEWAYS';
  }
}

// === VOLATILITY ASSESSMENT ===
export function assessVolatility(
  priceChanges: number[],
  volumeChanges: number[]
): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  // Calculate average absolute price change
  const avgPriceChange = priceChanges.reduce((sum, c) => sum + Math.abs(c), 0) / priceChanges.length;
  
  // Calculate volume volatility
  const avgVolumeChange = volumeChanges.reduce((sum, c) => sum + Math.abs(c), 0) / volumeChanges.length;
  
  // Combined volatility score
  const volatilityScore = avgPriceChange + (avgVolumeChange / 100);
  
  if (volatilityScore > 30) {
    return 'EXTREME';
  } else if (volatilityScore > 15) {
    return 'HIGH';
  } else if (volatilityScore > 5) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}

// === TOKEN QUALITY FILTER ===
export interface TokenQualityCheck {
  passed: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
}

export function checkTokenQuality(token: TokenMarketData): TokenQualityCheck {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  
  // Price change checks
  if (token.priceChange24h > 15 || token.priceChange24h < -15) {
    warnings.push(`High 24h price change: ${token.priceChange24h.toFixed(1)}%`);
    score -= 10;
  }
  
  if (token.priceChange5m > 10) {
    warnings.push(`Recent pump detected: ${token.priceChange5m.toFixed(1)}% in 5m`);
    score -= 20;
  }
  
  if (token.priceChange1h > 15) {
    warnings.push(`Significant 1h pump: ${token.priceChange1h.toFixed(1)}%`);
    score -= 15;
  }
  
  // RSI check
  if (token.rsi > 70) {
    warnings.push(`Overbought: RSI ${token.rsi.toFixed(1)}`);
    score -= 10;
  } else if (token.rsi < 30) {
    reasons.push(`Oversold: RSI ${token.rsi.toFixed(1)} - potential bounce`);
    score += 5;
  } else if (token.rsi >= 40 && token.rsi <= 60) {
    reasons.push('RSI in neutral zone');
    score += 5;
  }
  
  // Liquidity check
  if (token.liquidityDepth < 10000) {
    warnings.push('Low liquidity depth');
    score -= 15;
  } else if (token.liquidityDepth > 100000) {
    reasons.push('Good liquidity depth');
    score += 10;
  }
  
  // Spread check
  if (token.spread > 5) {
    warnings.push(`High spread: ${token.spread.toFixed(2)}%`);
    score -= 10;
  } else if (token.spread < 1) {
    reasons.push('Tight spread');
    score += 5;
  }
  
  // Volatility check
  if (token.volatility > 50) {
    warnings.push(`Extreme volatility: ${token.volatility.toFixed(1)}%`);
    score -= 20;
  } else if (token.volatility > 30) {
    warnings.push(`High volatility: ${token.volatility.toFixed(1)}%`);
    score -= 10;
  }
  
  // Volume spike check
  if (token.volumeSpikePercent > 500) {
    warnings.push(`Extreme volume spike: ${token.volumeSpikePercent.toFixed(0)}%`);
    score -= 15;
  } else if (token.volumeSpikePercent > 200) {
    warnings.push(`High volume spike: ${token.volumeSpikePercent.toFixed(0)}%`);
    score -= 5;
  } else if (token.volumeSpikePercent > 50) {
    reasons.push('Moderate volume increase');
    score += 5;
  }
  
  // Trend alignment
  if (token.trendDirection === 'UP') {
    reasons.push('Upward trend confirmed');
    score += 10;
  } else if (token.trendDirection === 'DOWN') {
    warnings.push('Downward trend');
    score -= 5;
  }
  
  // SOL correlation
  if (token.correlationWithSol > 0.7) {
    reasons.push('High SOL correlation - follows market');
    score += 5;
  } else if (token.correlationWithSol < -0.3) {
    warnings.push('Negative SOL correlation - moves opposite to market');
    score -= 10;
  }
  
  // Determine if passed
  const passed = score >= 0 && warnings.length < 3;
  
  return {
    passed,
    score,
    reasons: passed ? reasons : [...reasons, 'Score too low or too many warnings'],
    warnings
  };
}

// === SHOULD TRADE ===
export function shouldTrade(
  marketCondition: MarketCondition,
  tokenQuality: TokenQualityCheck
): { proceed: boolean; reason: string } {
  // Check market regime first
  if (!marketCondition.tradeable) {
    return {
      proceed: false,
      reason: `Market not tradeable: ${marketCondition.reason}`
    };
  }
  
  // Check token quality
  if (!tokenQuality.passed) {
    return {
      proceed: false,
      reason: `Token quality check failed: score ${tokenQuality.score}`
    };
  }
  
  // Check for extreme volatility
  if (marketCondition.volatilityLevel === 'EXTREME') {
    return {
      proceed: false,
      reason: 'Extreme market volatility - trading paused'
    };
  }
  
  return {
    proceed: true,
    reason: 'Market and token conditions favorable'
  };
}

// === GET RSI (Simplified calculation) ===
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    return 50; // Default neutral
  }
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) {
    return 100;
  }
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

// === GET VOLATILITY ===
export function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1] * 100);
  }
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

// === FORMAT MARKET SUMMARY ===
export function formatMarketSummary(condition: MarketCondition): string {
  return `
Market Regime: ${condition.regime}
SOL Trend: ${condition.solTrend}
BTC Trend: ${condition.btcTrend}
Volatility: ${condition.volatilityLevel}
Tradeable: ${condition.tradeable ? 'YES' : 'NO'}
Risk Multiplier: ${condition.riskMultiplier}x
Reason: ${condition.reason}
  `.trim();
}
