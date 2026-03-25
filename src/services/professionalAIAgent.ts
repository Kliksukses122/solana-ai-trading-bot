'use server'

/**
 * Professional AI Trading Agent Service
 * Institutional-grade trading with strict risk management
 */

import ZAI from 'z-ai-web-dev-sdk'
import { 
  getLearningInsights, 
  getTokenLearning, 
  isTokenBlacklisted,
  getTradeHistory,
  type LearningInsights 
} from './aiLearningService'
import {
  canTrade,
  calculatePositionSize,
  isHighQualityTrade,
  validateTradeRequest,
  type RiskState,
  type TradeRequest,
  MAX_RISK_PER_TRADE
} from './riskEngine'
import {
  getMarketCondition,
  checkTokenQuality,
  determineTrend,
  shouldTrade,
  type MarketCondition,
  type TokenMarketData,
  type TokenQualityCheck
} from './marketRegimeFilter'

// === TYPES ===
export interface ProfessionalAnalysis {
  decision: 'BUY' | 'SELL' | 'SKIP'
  confidence: number
  riskRewardRatio: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  positionSizePct: number
  reasoning: string
  warnings: string[]
  marketCondition: MarketCondition
  tokenQuality: TokenQualityCheck
  riskCheck: {
    allowed: boolean
    reason: string
  }
}

export interface EnhancedTokenData {
  symbol: string
  name: string
  price: number
  priceChange5m: number
  priceChange1h: number
  priceChange24h: number
  volumeSpikePercent: number
  rsi: number
  liquidityDepth: number
  spread: number
  volatility: number
  trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS'
  correlationWithSol: number
  volume24h: number
  marketCap: number
  liquidity: number
  txns24h: number
  signals: string[]
}

// === PROFESSIONAL TRADING SYSTEM PROMPT ===
const PROFESSIONAL_TRADING_PROMPT = `You are a professional quantitative crypto trader operating in the Solana ecosystem.

Your objective is to maximize long-term risk-adjusted returns, not short-term profits.

You must strictly follow institutional-grade trading discipline:

=== CORE PRINCIPLES ===
- Capital preservation is the highest priority
- Selectivity over frequency (fewer, higher quality trades)
- Always think in probabilities, never certainty

=== MARKET FILTER ===
Only trade if:
- Market is trending or showing clear structure
- No chaotic or erratic price behavior
- SOL and BTC are not showing strong opposing trends

=== ENTRY CONDITIONS (ALL REQUIRED) ===
- Confirmed trend or breakout structure
- Volume expansion (above average)
- No recent pump > 15-20%
- Liquidity is sufficient for entry/exit
- Risk/Reward >= 2.0

=== RISK MANAGEMENT ===
- Max risk per trade: 1% capital
- Never widen stop loss after entry
- Define stop loss BEFORE entering
- Avoid correlated positions

=== EXIT STRATEGY ===
- Predefine take profit
- Use trailing stop for strong trends
- Exit early if market conditions change

=== TRADE FILTER ===
DO NOT TRADE if:
- Low liquidity
- Sudden hype / meme spikes
- Conflicting indicators
- Unclear direction

=== SELF VALIDATION ===
Before final decision:
"Would a professional hedge fund take this trade?"

If NO → SKIP

Remember: Missing a trade is better than taking a bad trade.`

// === INITIALIZE AI ===
async function getAI() {
  return await ZAI.create()
}

// === PROFESSIONAL TOKEN ANALYSIS ===
export async function professionalTokenAnalysis(
  tokenData: EnhancedTokenData,
  riskState: RiskState,
  solTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS',
  btcTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS'
): Promise<ProfessionalAnalysis> {
  
  // Step 1: Check if trading is allowed by risk engine
  const riskCheck = canTrade(riskState)
  
  // Step 2: Check market regime
  const marketCondition = getMarketCondition(solTrend, btcTrend)
  
  // Step 3: Check token quality
  const tokenQuality = checkTokenQuality(tokenData)
  
  // Step 4: Check if we should even proceed to AI analysis
  const tradeCheck = shouldTrade(marketCondition, tokenQuality)
  
  // If any hard check fails, return early with SKIP
  if (!riskCheck.allowed || !tradeCheck.proceed) {
    return {
      decision: 'SKIP',
      confidence: 0,
      riskRewardRatio: 0,
      entryPrice: tokenData.price,
      stopLoss: tokenData.price * 0.95,
      takeProfit: tokenData.price * 1.10,
      positionSizePct: 0,
      reasoning: `Risk/Market check failed: ${riskCheck.allowed ? tradeCheck.reason : riskCheck.reason}`,
      warnings: [...riskCheck.warnings, ...tokenQuality.warnings],
      marketCondition,
      tokenQuality,
      riskCheck: {
        allowed: false,
        reason: riskCheck.allowed ? tradeCheck.reason : riskCheck.reason
      }
    }
  }
  
  // Step 5: Check if token is blacklisted
  if (isTokenBlacklisted(tokenData.symbol)) {
    return {
      decision: 'SKIP',
      confidence: 0,
      riskRewardRatio: 0,
      entryPrice: tokenData.price,
      stopLoss: tokenData.price * 0.95,
      takeProfit: tokenData.price * 1.10,
      positionSizePct: 0,
      reasoning: 'Token blacklisted due to poor historical performance',
      warnings: ['Do not trade this token'],
      marketCondition,
      tokenQuality,
      riskCheck: { allowed: false, reason: 'Blacklisted token' }
    }
  }
  
  // Step 6: Get learning insights
  const insights = getLearningInsights()
  const tokenHistory = getTokenLearning(tokenData.symbol)
  
  // Step 7: AI Analysis with full context
  try {
    const zai = await getAI()
    
    const prompt = buildAnalysisPrompt(tokenData, insights, tokenHistory, riskState)
    
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: PROFESSIONAL_TRADING_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2, // Low temperature for consistency
      max_tokens: 600,
    })
    
    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse AI response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const aiOutput = JSON.parse(jsonMatch[0])
      
      // Step 8: Validate with quality scoring
      const qualityCheck = isHighQualityTrade(aiOutput)
      
      if (!qualityCheck.passed) {
        return {
          decision: 'SKIP',
          confidence: aiOutput.confidence || 0,
          riskRewardRatio: aiOutput.risk_reward_ratio || 0,
          entryPrice: aiOutput.entry_price || tokenData.price,
          stopLoss: aiOutput.stop_loss || tokenData.price * 0.95,
          takeProfit: aiOutput.take_profit || tokenData.price * 1.10,
          positionSizePct: 0,
          reasoning: `Quality check failed: ${qualityCheck.reasons.join(', ')}`,
          warnings: qualityCheck.reasons,
          marketCondition,
          tokenQuality,
          riskCheck: { allowed: false, reason: 'Quality threshold not met' }
        }
      }
      
      // Step 9: Calculate proper position size
      const { positionSize } = calculatePositionSize(
        riskState.balance,
        aiOutput.entry_price || tokenData.price,
        aiOutput.stop_loss || tokenData.price * 0.95
      )
      
      return {
        decision: aiOutput.decision || 'SKIP',
        confidence: aiOutput.confidence || 0,
        riskRewardRatio: aiOutput.risk_reward_ratio || 0,
        entryPrice: aiOutput.entry_price || tokenData.price,
        stopLoss: aiOutput.stop_loss,
        takeProfit: aiOutput.take_profit,
        positionSizePct: positionSize / riskState.balance,
        reasoning: aiOutput.reasoning || 'AI analysis completed',
        warnings: aiOutput.warnings || [],
        marketCondition,
        tokenQuality,
        riskCheck: { allowed: true, reason: 'All checks passed' }
      }
    }
    
    return getDefaultAnalysis(tokenData, marketCondition, tokenQuality, 'AI response parse error')
    
  } catch (error) {
    console.error('Professional AI analysis error:', error)
    return getDefaultAnalysis(tokenData, marketCondition, tokenQuality, 'AI analysis failed')
  }
}

// === BUILD ANALYSIS PROMPT ===
function buildAnalysisPrompt(
  token: EnhancedTokenData,
  insights: LearningInsights,
  tokenHistory: any,
  riskState: RiskState
): string {
  return `Analyze this Solana token for a professional trade:

=== TOKEN DATA ===
Symbol: ${token.symbol}
Name: ${token.name}
Price: $${token.price.toFixed(8)}

Price Changes:
- 5m: ${token.priceChange5m.toFixed(2)}%
- 1h: ${token.priceChange1h.toFixed(2)}%
- 24h: ${token.priceChange24h.toFixed(2)}%

Volume Spike: ${token.volumeSpikePercent.toFixed(1)}%
RSI: ${token.rsi.toFixed(1)}
Liquidity Depth: $${(token.liquidityDepth / 1000).toFixed(1)}K
Spread: ${token.spread.toFixed(2)}%
Volatility: ${token.volatility.toFixed(1)}%
Trend: ${token.trendDirection}
SOL Correlation: ${token.correlationWithSol.toFixed(2)}

Market Metrics:
- 24h Volume: $${(token.volume24h / 1000000).toFixed(2)}M
- Market Cap: $${(token.marketCap / 1000000).toFixed(2)}M
- Liquidity: $${(token.liquidity / 1000).toFixed(1)}K
- 24h Transactions: ${token.txns24h}

Signals: ${token.signals.join(', ') || 'None'}

=== RISK STATE ===
Balance: ${riskState.balance.toFixed(4)} SOL
Daily P&L: ${riskState.dailyPnL.toFixed(4)} SOL
Daily Loss: ${(riskState.dailyLoss / riskState.balance * 100).toFixed(2)}%
Open Trades: ${riskState.openTrades}
Trades Today: ${riskState.tradesToday}
Loss Streak: ${riskState.lossStreak}

=== LEARNING INSIGHTS ===
${insights.learnedRules.map(r => `- ${r}`).join('\n')}
${tokenHistory ? `
Token History:
- ${tokenHistory.totalTrades} trades: ${tokenHistory.wins} wins, ${tokenHistory.losses} losses
- Win Rate: ${(tokenHistory.winRate * 100).toFixed(0)}%
` : '- No previous trades with this token'}

Best Score Range: ${insights.bestScoreRange[0]}-${insights.bestScoreRange[1]}

=== TASK ===
Based on ALL the above data, provide your trading decision.

CRITICAL RULES:
1. If any major warning exists → SKIP
2. If R:R < 2.0 → SKIP
3. If confidence < 75 → SKIP
4. If market conditions unclear → SKIP

Return JSON ONLY:
{
  "decision": "BUY | SKIP",
  "confidence": 0-100,
  "risk_reward_ratio": number,
  "entry_price": number,
  "stop_loss": number,
  "take_profit": number,
  "position_size_pct": number,
  "reasoning": "...",
  "warnings": []
}`
}

// === DEFAULT ANALYSIS (Fallback) ===
function getDefaultAnalysis(
  token: EnhancedTokenData,
  marketCondition: MarketCondition,
  tokenQuality: TokenQualityCheck,
  reason: string
): ProfessionalAnalysis {
  return {
    decision: 'SKIP',
    confidence: 0,
    riskRewardRatio: 0,
    entryPrice: token.price,
    stopLoss: token.price * 0.95,
    takeProfit: token.price * 1.10,
    positionSizePct: 0,
    reasoning: reason,
    warnings: [reason],
    marketCondition,
    tokenQuality,
    riskCheck: { allowed: false, reason }
  }
}

// === ENHANCED SENTIMENT ANALYSIS ===
export async function analyzeMarketSentimentEnhanced(tokenSymbol: string): Promise<{
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  summary: string
  trending: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}> {
  try {
    const zai = await getAI()
    
    const searchResult = await zai.functions.invoke('web_search', {
      query: `${tokenSymbol} solana token crypto news price analysis today`,
      num: 5
    })

    const articles = searchResult as Array<{ name: string; snippet: string }>
    
    if (!articles || articles.length === 0) {
      return { sentiment: 'NEUTRAL', summary: 'No recent news found', trending: false, riskLevel: 'MEDIUM' }
    }

    const context = articles.map(a => `${a.name}: ${a.snippet}`).join('\n')
    
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a sentiment analyst. Respond with JSON only.' },
        { 
          role: 'user', 
          content: `Analyze sentiment for ${tokenSymbol} from these news:

${context}

Respond JSON:
{
  "sentiment": "<BULLISH|BEARISH|NEUTRAL>",
  "summary": "<brief summary>",
  "trending": <boolean>,
  "riskLevel": "<LOW|MEDIUM|HIGH>"
}` 
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return { sentiment: 'NEUTRAL', summary: 'Unable to analyze', trending: false, riskLevel: 'MEDIUM' }
  } catch (error) {
    console.error('Sentiment analysis error:', error)
    return { sentiment: 'NEUTRAL', summary: 'Analysis failed', trending: false, riskLevel: 'MEDIUM' }
  }
}

// === EXPORT FOR USE IN OTHER SERVICES ===
export { canTrade, calculatePositionSize, isHighQualityTrade, validateTradeRequest }
export { getMarketCondition, checkTokenQuality, shouldTrade, determineTrend }
