/**
 * Risk Engine Service - Institutional-Grade Risk Management
 * Hard limits that CANNOT be overridden by AI
 */

// === RISK CONSTANTS ===
export const MAX_RISK_PER_TRADE = 0.01; // 1% max risk per trade
export const MAX_DAILY_LOSS = 0.03; // 3% max daily loss
export const MAX_OPEN_TRADES = 3; // Max 3 concurrent positions
export const MAX_TRADES_PER_DAY = 5; // Anti-overtrading
export const LOSS_STREAK_KILL_SWITCH = 5; // Stop after 5 consecutive losses
export const COOLDOWN_AFTER_BIG_LOSS = 24 * 60 * 60 * 1000; // 24 hours cooldown

export interface RiskState {
  balance: number;
  dailyPnL: number;
  dailyLoss: number;
  openTrades: number;
  tradesToday: number;
  lossStreak: number;
  lastBigLossTime: number | null;
  lastTradeTime: number | null;
  totalTrades: number;
  winRate: number;
}

export interface TradeRequest {
  tokenMint: string;
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  riskRewardRatio: number;
  positionSizePct: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason: string;
  warnings: string[];
  adjustedPositionSize?: number;
  riskAmount?: number;
}

// === CAN TRADE CHECK ===
export function canTrade(state: RiskState): RiskCheckResult {
  const warnings: string[] = [];
  
  // Check daily loss limit
  if (state.dailyLoss >= MAX_DAILY_LOSS * state.balance) {
    return {
      allowed: false,
      reason: `Daily loss limit reached: ${(state.dailyLoss / state.balance * 100).toFixed(2)}% >= ${MAX_DAILY_LOSS * 100}%`,
      warnings: ['TRADING HALTED - Daily loss limit exceeded']
    };
  }
  
  // Check open trades
  if (state.openTrades >= MAX_OPEN_TRADES) {
    return {
      allowed: false,
      reason: `Max open trades reached: ${state.openTrades}/${MAX_OPEN_TRADES}`,
      warnings: ['Wait for existing positions to close']
    };
  }
  
  // Check daily trade limit
  if (state.tradesToday >= MAX_TRADES_PER_DAY) {
    return {
      allowed: false,
      reason: `Daily trade limit reached: ${state.tradesToday}/${MAX_TRADES_PER_DAY}`,
      warnings: ['Anti-overtrading protection active']
    };
  }
  
  // Check loss streak kill switch
  if (state.lossStreak >= LOSS_STREAK_KILL_SWITCH) {
    return {
      allowed: false,
      reason: `Kill switch activated: ${state.lossStreak} consecutive losses`,
      warnings: ['Bot paused - Review strategy before resuming']
    };
  }
  
  // Check cooldown after big loss
  if (state.lastBigLossTime) {
    const timeSinceBigLoss = Date.now() - state.lastBigLossTime;
    if (timeSinceBigLoss < COOLDOWN_AFTER_BIG_LOSS) {
      const remainingTime = COOLDOWN_AFTER_BIG_LOSS - timeSinceBigLoss;
      const hoursRemaining = (remainingTime / (60 * 60 * 1000)).toFixed(1);
      return {
        allowed: false,
        reason: `Cooldown active after big loss. ${hoursRemaining}h remaining`,
        warnings: [`Wait ${hoursRemaining} hours before trading again`]
      };
    }
  }
  
  // Check balance
  if (state.balance <= 0) {
    return {
      allowed: false,
      reason: 'No balance available',
      warnings: ['Deposit funds to start trading']
    };
  }
  
  // Add warnings for edge cases
  if (state.dailyLoss > 0) {
    warnings.push(`Daily P&L: -${(state.dailyLoss / state.balance * 100).toFixed(2)}%`);
  }
  
  if (state.lossStreak >= 3) {
    warnings.push(`Warning: ${state.lossStreak} consecutive losses - be extra cautious`);
  }
  
  return {
    allowed: true,
    reason: 'Risk checks passed',
    warnings
  };
}

// === POSITION SIZING ===
export function calculatePositionSize(
  balance: number,
  entryPrice: number,
  stopLoss: number,
  riskPerTrade: number = MAX_RISK_PER_TRADE
): { positionSize: number; riskAmount: number; units: number } {
  // Risk amount in SOL
  const riskAmount = balance * riskPerTrade;
  
  // Risk per unit (price difference)
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  
  // Calculate units to buy
  const units = riskAmount / riskPerUnit;
  
  // Position size in SOL
  const positionSize = units * entryPrice;
  
  // Never risk more than riskAmount
  const maxPositionSize = balance * 0.05; // Max 5% of portfolio per trade
  
  const finalPositionSize = Math.min(positionSize, maxPositionSize);
  
  return {
    positionSize: finalPositionSize,
    riskAmount,
    units: finalPositionSize / entryPrice
  };
}

// === TRADE QUALITY CHECK ===
export function isHighQualityTrade(aiOutput: {
  confidence: number;
  riskRewardRatio: number;
  warnings?: string[];
}): { passed: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  // Confidence check
  if (aiOutput.confidence >= 80) {
    score += 30;
    reasons.push('High confidence (80%+)');
  } else if (aiOutput.confidence >= 75) {
    score += 20;
    reasons.push('Good confidence (75%+)');
  } else if (aiOutput.confidence >= 70) {
    score += 10;
    reasons.push('Acceptable confidence (70%+)');
  } else {
    reasons.push('Low confidence (<70%) - REJECTED');
    return { passed: false, score, reasons };
  }
  
  // Risk/Reward check
  if (aiOutput.riskRewardRatio >= 3) {
    score += 30;
    reasons.push('Excellent R:R (3+)');
  } else if (aiOutput.riskRewardRatio >= 2) {
    score += 20;
    reasons.push('Good R:R (2+)');
  } else if (aiOutput.riskRewardRatio >= 1.5) {
    score += 10;
    reasons.push('Acceptable R:R (1.5+)');
  } else {
    reasons.push('Poor R:R (<1.5) - REJECTED');
    return { passed: false, score, reasons };
  }
  
  // Check for warnings
  if (aiOutput.warnings && aiOutput.warnings.length > 0) {
    score -= aiOutput.warnings.length * 5;
    reasons.push(`Has ${aiOutput.warnings.length} warnings`);
  }
  
  // Minimum score threshold
  const passed = score >= 30;
  
  if (!passed) {
    reasons.push(`Quality score too low: ${score}/60 - REJECTED`);
  }
  
  return { passed, score, reasons };
}

// === TRAILING STOP ===
export function calculateTrailingStop(
  currentPrice: number,
  entryPrice: number,
  currentStopLoss: number,
  trailPercent: number = 0.03 // 3% trail
): { newStopLoss: number; shouldUpdate: boolean } {
  // Only trail when in profit
  if (currentPrice <= entryPrice) {
    return { newStopLoss: currentStopLoss, shouldUpdate: false };
  }
  
  // Calculate new stop loss
  const trailingStop = currentPrice * (1 - trailPercent);
  
  // Only move stop up, never down
  if (trailingStop > currentStopLoss) {
    return { 
      newStopLoss: trailingStop, 
      shouldUpdate: true 
    };
  }
  
  return { newStopLoss: currentStopLoss, shouldUpdate: false };
}

// === DAILY STATS ===
export function getDailyStats(state: RiskState): {
  canContinueTrading: boolean;
  remainingRisk: number;
  remainingTrades: number;
  summary: string;
} {
  const remainingRisk = Math.max(0, (MAX_DAILY_LOSS * state.balance) - state.dailyLoss);
  const remainingTrades = Math.max(0, MAX_TRADES_PER_DAY - state.tradesToday);
  
  const canContinueTrading = 
    state.dailyLoss < MAX_DAILY_LOSS * state.balance &&
    state.tradesToday < MAX_TRADES_PER_DAY &&
    state.lossStreak < LOSS_STREAK_KILL_SWITCH;
  
  let summary = '';
  if (!canContinueTrading) {
    if (state.dailyLoss >= MAX_DAILY_LOSS * state.balance) {
      summary = 'Daily loss limit reached';
    } else if (state.tradesToday >= MAX_TRADES_PER_DAY) {
      summary = 'Daily trade limit reached';
    } else {
      summary = 'Kill switch active due to loss streak';
    }
  } else {
    summary = `Ready to trade. ${remainingTrades} trades remaining, ${(remainingRisk / state.balance * 100).toFixed(2)}% risk budget left`;
  }
  
  return {
    canContinueTrading,
    remainingRisk,
    remainingTrades,
    summary
  };
}

// === VALIDATE TRADE REQUEST ===
export function validateTradeRequest(
  request: TradeRequest,
  state: RiskState
): RiskCheckResult {
  const warnings: string[] = [];
  
  // Check if stop loss makes sense
  if (request.stopLoss >= request.entryPrice) {
    return {
      allowed: false,
      reason: 'Invalid stop loss: must be below entry price',
      warnings: ['Stop loss validation failed']
    };
  }
  
  // Check if take profit makes sense
  if (request.takeProfit <= request.entryPrice) {
    return {
      allowed: false,
      reason: 'Invalid take profit: must be above entry price',
      warnings: ['Take profit validation failed']
    };
  }
  
  // Calculate risk/reward
  const risk = request.entryPrice - request.stopLoss;
  const reward = request.takeProfit - request.entryPrice;
  const actualRR = reward / risk;
  
  if (actualRR < 1.5) {
    warnings.push(`Low R:R ratio: ${actualRR.toFixed(2)}`);
  }
  
  // Check position size
  if (request.positionSizePct > 0.05) {
    warnings.push(`Position size too large: ${(request.positionSizePct * 100).toFixed(1)}%`);
    warnings.push('Reducing to 5% max');
  }
  
  // Check confidence
  if (request.confidence < 70) {
    return {
      allowed: false,
      reason: `Confidence too low: ${request.confidence}%`,
      warnings: ['Minimum confidence is 70%']
    };
  }
  
  // Calculate proper position size
  const { positionSize, riskAmount } = calculatePositionSize(
    state.balance,
    request.entryPrice,
    request.stopLoss
  );
  
  // Final risk check
  const riskCheck = canTrade(state);
  if (!riskCheck.allowed) {
    return riskCheck;
  }
  
  return {
    allowed: true,
    reason: 'Trade validated successfully',
    warnings: [...warnings, ...riskCheck.warnings],
    adjustedPositionSize: positionSize,
    riskAmount
  };
}
