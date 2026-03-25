'use server'

import { createChatCompletion, parseJSONFromResponse } from '@/lib/ai-service'
import { getLearningInsights, getTokenLearning, isTokenBlacklisted, type LearningInsights } from './aiLearningService'

export interface TokenAnalysis {
  symbol: string
  score: number
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID'
  reasoning: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
  keyFactors: string[]
  pricePrediction: { shortTerm: 'UP' | 'DOWN' | 'SIDEWAYS'; confidence: number }
}

export interface AISignal {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  suggestedAmount: number
  stopLoss: number
  takeProfit: number
}

export async function analyzeToken(tokenData: {
  symbol: string; name: string; price: number; priceChange24h: number
  volume24h: number; marketCap: number; liquidity: number; txns24h: number; signals: string[]
}): Promise<TokenAnalysis> {
  try {
    const insights = getLearningInsights()
    const tokenHistory = getTokenLearning(tokenData.symbol)
    
    if (isTokenBlacklisted(tokenData.symbol)) {
      return {
        symbol: tokenData.symbol, score: 1, recommendation: 'AVOID',
        reasoning: 'Token blacklisted due to poor performance', riskLevel: 'VERY_HIGH',
        keyFactors: ['Blacklisted'], pricePrediction: { shortTerm: 'DOWN', confidence: 80 }
      }
    }

    const prompt = `Analyze this Solana token:
Symbol: ${tokenData.symbol}, Name: ${tokenData.name}, Price: $${tokenData.price.toFixed(8)}
24h: ${tokenData.priceChange24h.toFixed(2)}%, Vol: $${(tokenData.volume24h/1000000).toFixed(2)}M
MCap: $${(tokenData.marketCap/1000000).toFixed(2)}M, Liq: $${(tokenData.liquidity/1000).toFixed(0)}K

Return JSON: {"score":1-10,"recommendation":"STRONG_BUY|BUY|HOLD|AVOID","reasoning":"...","riskLevel":"LOW|MEDIUM|HIGH|VERY_HIGH","keyFactors":["..."],"pricePrediction":{"shortTerm":"UP|DOWN|SIDEWAYS","confidence":0-100}}`

    const result = await createChatCompletion([
      { role: 'system', content: 'You are a crypto analyst. Respond with JSON only.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 400 })

    if (result.success && result.content) {
      const parsed = parseJSONFromResponse<TokenAnalysis>(result.content)
      if (parsed) return { ...parsed, symbol: tokenData.symbol }
    }
    
    return getDefaultAnalysis(tokenData.symbol)
  } catch (error) {
    return getDefaultAnalysis(tokenData.symbol)
  }
}

export async function generateTradingSignal(data: {
  token: TokenAnalysis; portfolioBalance: number
  recentTrades: { profit: number; status: string }[]; marketCondition: string
}): Promise<AISignal> {
  try {
    const prompt = `Trading decision for ${data.token.symbol}:
Score: ${data.token.score}/10, Recommendation: ${data.token.recommendation}
Risk: ${data.token.riskLevel}, Balance: ${data.portfolioBalance.toFixed(4)} SOL

Return JSON: {"action":"BUY|SELL|HOLD","confidence":0-100,"reasoning":"...","suggestedAmount":0-0.05,"stopLoss":1-5,"takeProfit":5-15}`

    const result = await createChatCompletion([
      { role: 'system', content: 'You are a trading AI. Respond with JSON only.' },
      { role: 'user', content: prompt }
    ], { temperature: 0.2, maxTokens: 250 })

    if (result.success && result.content) {
      const parsed = parseJSONFromResponse<AISignal>(result.content)
      if (parsed) return parsed
    }
    return { action: 'HOLD', confidence: 0, reasoning: 'Parse error', suggestedAmount: 0, stopLoss: 2, takeProfit: 8 }
  } catch (error) {
    return { action: 'HOLD', confidence: 0, reasoning: 'Error', suggestedAmount: 0, stopLoss: 2, takeProfit: 8 }
  }
}

export async function analyzeMarketSentiment(tokenSymbol: string) {
  return { sentiment: 'NEUTRAL' as const, summary: 'Analysis unavailable', trending: false }
}

export async function assessRisk(data: { tokenSymbol: string; liquidity: number; marketCap: number; holderCount: number; topHolderPercent: number }) {
  return { riskScore: 5, riskFactors: ['Unknown'], recommendation: 'Caution advised', maxPositionSize: 0.01 }
}

function getDefaultAnalysis(symbol: string): TokenAnalysis {
  return { symbol, score: 5, recommendation: 'HOLD', reasoning: 'AI analysis unavailable', riskLevel: 'MEDIUM', keyFactors: ['Analysis unavailable'], pricePrediction: { shortTerm: 'SIDEWAYS', confidence: 50 } }
}
