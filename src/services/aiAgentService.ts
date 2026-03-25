'use server'

/**
 * AI Agent Service - Real AI Integration for Trading
 * Uses z-ai-web-dev-sdk for LLM-powered analysis
 * Incorporates learning from past trades
 */

import ZAI from 'z-ai-web-dev-sdk'
import { getLearningInsights, getTokenLearning, isTokenBlacklisted, type LearningInsights } from './aiLearningService'

// Initialize AI
async function getAI() {
  return await ZAI.create()
}

// Token analysis result
export interface TokenAnalysis {
  symbol: string
  score: number
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID'
  reasoning: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
  keyFactors: string[]
  pricePrediction: {
    shortTerm: 'UP' | 'DOWN' | 'SIDEWAYS'
    confidence: number
  }
}

// Trading signal from AI
export interface AISignal {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  suggestedAmount: number
  stopLoss: number
  takeProfit: number
}

// Analyze token using AI with Learning
export async function analyzeToken(tokenData: {
  symbol: string
  name: string
  price: number
  priceChange24h: number
  volume24h: number
  marketCap: number
  liquidity: number
  txns24h: number
  signals: string[]
}): Promise<TokenAnalysis> {
  try {
    const zai = await getAI()
    
    // Get learning insights
    const insights = getLearningInsights()
    const tokenHistory = getTokenLearning(tokenData.symbol)
    const blacklisted = isTokenBlacklisted(tokenData.symbol)
    
    // If token is blacklisted, return AVOID immediately
    if (blacklisted) {
      return {
        symbol: tokenData.symbol,
        score: 1,
        recommendation: 'AVOID',
        reasoning: `This token has poor historical performance: ${tokenHistory?.winRate ? (tokenHistory.winRate * 100).toFixed(0) : 0}% win rate from ${tokenHistory?.totalTrades || 0} trades`,
        riskLevel: 'VERY_HIGH',
        keyFactors: ['Blacklisted due to poor performance', 'Previous trades lost money'],
        pricePrediction: { shortTerm: 'DOWN', confidence: 80 }
      }
    }
    
    // Build learning context
    const learningContext = `
LEARNING FROM PAST TRADES:
${insights.learnedRules.map(r => `- ${r}`).join('\n')}
${tokenHistory ? `
Token ${tokenData.symbol} History:
- ${tokenHistory.totalTrades} trades: ${tokenHistory.wins} wins, ${tokenHistory.losses} losses
- Win Rate: ${(tokenHistory.winRate * 100).toFixed(0)}%
- Avg Profit: ${(tokenHistory.avgProfitPercent * 100).toFixed(2)}%
` : '- No previous trades with this token'}
- Best Score Range: ${insights.bestScoreRange[0]}-${insights.bestScoreRange[1]}
- Performance Trend: ${insights.winRateTrend > 0.1 ? 'Improving' : insights.winRateTrend < -0.1 ? 'Declining' : 'Stable'}
`

    const prompt = `You are an expert crypto trader analyzing a Solana token. Provide a detailed analysis.

Token Data:
- Symbol: ${tokenData.symbol}
- Name: ${tokenData.name}
- Price: $${tokenData.price.toFixed(8)}
- 24h Change: ${tokenData.priceChange24h.toFixed(2)}%
- 24h Volume: $${(tokenData.volume24h / 1000000).toFixed(2)}M
- Market Cap: $${(tokenData.marketCap / 1000000).toFixed(2)}M
- Liquidity: $${(tokenData.liquidity / 1000).toFixed(2)}K
- 24h Transactions: ${tokenData.txns24h}
- Detected Signals: ${tokenData.signals.join(', ') || 'None'}

${learningContext}

Analyze this token and respond in JSON format:
{
  "score": <number 1-10>,
  "recommendation": "<STRONG_BUY|BUY|HOLD|AVOID>",
  "reasoning": "<brief explanation>",
  "riskLevel": "<LOW|MEDIUM|HIGH|VERY_HIGH>",
  "keyFactors": ["<factor1>", "<factor2>", ...],
  "pricePrediction": {
    "shortTerm": "<UP|DOWN|SIDEWAYS>",
    "confidence": <number 0-100>
  }
}

IMPORTANT: Learn from past performance. If this token has poor history, be more conservative. If performance is trending down, reduce confidence.`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a professional crypto trading analyst that learns from past trades. Always respond with valid JSON only. Consider historical performance heavily in decisions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      // Adjust score based on learning
      let adjustedScore = parsed.score || 5
      if (tokenHistory && tokenHistory.winRate > 0.6) {
        adjustedScore = Math.min(10, adjustedScore + 1) // Boost for proven winners
      }
      if (insights.winRateTrend < -0.15) {
        adjustedScore = Math.max(1, adjustedScore - 1) // Reduce when performance declining
      }
      
      return {
        symbol: tokenData.symbol,
        score: adjustedScore,
        recommendation: parsed.recommendation || 'HOLD',
        reasoning: parsed.reasoning || 'Unable to analyze',
        riskLevel: parsed.riskLevel || 'MEDIUM',
        keyFactors: parsed.keyFactors || [],
        pricePrediction: parsed.pricePrediction || { shortTerm: 'SIDEWAYS', confidence: 50 }
      }
    }
    
    return getDefaultAnalysis(tokenData.symbol)
  } catch (error) {
    console.error('AI analysis error:', error)
    return getDefaultAnalysis(tokenData.symbol)
  }
}

// Generate trading signal using AI with Learning
export async function generateTradingSignal(data: {
  token: TokenAnalysis
  portfolioBalance: number
  recentTrades: { profit: number; status: string }[]
  marketCondition: string
}): Promise<AISignal> {
  try {
    const zai = await getAI()
    
    // Get learning insights
    const insights = getLearningInsights()
    const tokenHistory = getTokenLearning(data.token.symbol)
    
    const winRate = data.recentTrades.length > 0 
      ? data.recentTrades.filter(t => t.status === 'WIN').length / data.recentTrades.length 
      : 0.5

    // Build learning context
    const learningContext = `
LEARNED INSIGHTS:
${insights.learnedRules.map(r => `- ${r}`).join('\n')}
- Win Rate Trend: ${insights.winRateTrend > 0.1 ? 'Improving (+)' : insights.winRateTrend < -0.1 ? 'Declining (-)' : 'Stable'}
- Recent Performance: ${(insights.recentPerformance * 100).toFixed(2)}%
${tokenHistory ? `
- This Token: ${tokenHistory.totalTrades} trades, ${(tokenHistory.winRate * 100).toFixed(0)}% win rate` : ''}
- Best Performing Tokens: ${insights.bestTokens.map(t => t.symbol).join(', ') || 'None yet'}
`

    const prompt = `You are a trading AI making a decision. Respond with JSON only.

Current Situation:
- Token: ${data.token.symbol}
- AI Score: ${data.token.score}/10
- Recommendation: ${data.token.recommendation}
- Risk Level: ${data.token.riskLevel}
- Price Prediction: ${data.token.pricePrediction.shortTerm} (${data.token.pricePrediction.confidence}% confidence)
- Portfolio Balance: ${data.portfolioBalance.toFixed(4)} SOL
- Recent Win Rate: ${(winRate * 100).toFixed(1)}%
- Market Condition: ${data.marketCondition}

${learningContext}

Make a trading decision. Respond in JSON:
{
  "action": "<BUY|SELL|HOLD>",
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation>",
  "suggestedAmount": <number, fraction of portfolio 0-0.05>,
  "stopLoss": <number, percentage 1-5>,
  "takeProfit": <number, percentage 5-15>
}

IMPORTANT RULES:
1. Learn from past trades - avoid repeating mistakes
2. Only BUY if confidence > 70 and risk is not VERY_HIGH
3. If performance is declining, be extra cautious
4. If this token has poor history, consider HOLD or SELL
5. Protect capital - smaller positions when uncertain`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a risk-aware trading AI that learns from past trades. Always respond with valid JSON only. Protect capital first. Consider historical performance in every decision.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      // Adjust based on learning
      let suggestedAmount = Math.min(parsed.suggestedAmount || 0.01, 0.05)
      
      // Reduce position size if performance declining
      if (insights.winRateTrend < -0.15) {
        suggestedAmount *= 0.5
      }
      
      // Increase position size if performance improving and token proven
      if (insights.winRateTrend > 0.15 && tokenHistory && tokenHistory.winRate > 0.6) {
        suggestedAmount *= 1.2
      }
      
      return {
        action: parsed.action || 'HOLD',
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedAmount: Math.min(suggestedAmount, 0.05),
        stopLoss: parsed.stopLoss || 2,
        takeProfit: parsed.takeProfit || 8
      }
    }
    
    return { action: 'HOLD', confidence: 0, reasoning: 'Parse error', suggestedAmount: 0, stopLoss: 2, takeProfit: 8 }
  } catch (error) {
    console.error('Signal generation error:', error)
    return { action: 'HOLD', confidence: 0, reasoning: 'Error', suggestedAmount: 0, stopLoss: 2, takeProfit: 8 }
  }
}

// Analyze market sentiment from web search
export async function analyzeMarketSentiment(tokenSymbol: string): Promise<{
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  summary: string
  trending: boolean
}> {
  try {
    const zai = await getAI()
    
    // Search for token news
    const searchResult = await zai.functions.invoke('web_search', {
      query: `${tokenSymbol} solana token crypto news today`,
      num: 5
    })

    const articles = searchResult as Array<{ name: string; snippet: string }>
    
    if (!articles || articles.length === 0) {
      return { sentiment: 'NEUTRAL', summary: 'No recent news found', trending: false }
    }

    // Analyze sentiment from search results
    const context = articles.map(a => `${a.name}: ${a.snippet}`).join('\n')
    
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a sentiment analyst. Respond with JSON only.' },
        { role: 'user', content: `Analyze sentiment for ${tokenSymbol} from these news:\n\n${context}\n\nRespond: {"sentiment": "<BULLISH|BEARISH|NEUTRAL>", "summary": "<brief summary>", "trending": <boolean>}` }
      ],
      temperature: 0.3,
      max_tokens: 200,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return { sentiment: 'NEUTRAL', summary: 'Unable to analyze', trending: false }
  } catch (error) {
    console.error('Sentiment analysis error:', error)
    return { sentiment: 'NEUTRAL', summary: 'Analysis failed', trending: false }
  }
}

// AI-powered risk assessment
export async function assessRisk(data: {
  tokenSymbol: string
  liquidity: number
  marketCap: number
  holderCount: number
  topHolderPercent: number
}): Promise<{
  riskScore: number
  riskFactors: string[]
  recommendation: string
  maxPositionSize: number
}> {
  try {
    const zai = await getAI()
    
    const prompt = `Assess risk for this Solana token:

Token: ${data.tokenSymbol}
Liquidity: $${(data.liquidity / 1000).toFixed(2)}K
Market Cap: $${(data.marketCap / 1000000).toFixed(2)}M
Holders: ${data.holderCount}
Top Holder %: ${data.topHolderPercent}%

Respond in JSON:
{
  "riskScore": <number 1-10>,
  "riskFactors": ["<factor1>", ...],
  "recommendation": "<brief advice>",
  "maxPositionSize": <fraction of portfolio 0-0.02>
}

Consider: rug pull risk, liquidity risk, concentration risk, volatility.`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a risk analyst. Be conservative. Respond with JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 300,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    return { riskScore: 5, riskFactors: ['Unknown'], recommendation: 'Caution advised', maxPositionSize: 0.01 }
  } catch (error) {
    console.error('Risk assessment error:', error)
    return { riskScore: 5, riskFactors: ['Analysis failed'], recommendation: 'Proceed with caution', maxPositionSize: 0.01 }
  }
}

// Default analysis fallback
function getDefaultAnalysis(symbol: string): TokenAnalysis {
  return {
    symbol,
    score: 5,
    recommendation: 'HOLD',
    reasoning: 'Unable to perform AI analysis',
    riskLevel: 'MEDIUM',
    keyFactors: ['Analysis unavailable'],
    pricePrediction: { shortTerm: 'SIDEWAYS', confidence: 50 }
  }
}
