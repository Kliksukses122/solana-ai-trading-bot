import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// AI Trading Analysis for Paper Trading
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, portfolio, tradingParams } = body

    const zai = await ZAI.create()

    const prompt = `You are a professional crypto trader analyzing a token for a paper trading simulation.

TOKEN DATA:
- Symbol: ${token.symbol}
- Name: ${token.name}
- Base Price: $${token.basePrice}

CURRENT PORTFOLIO:
- Balance: ${portfolio.balance.toFixed(4)} SOL
- Open Positions: ${portfolio.openPositions} / ${tradingParams.maxPositions}
- Win Rate: ${(portfolio.winRate * 100).toFixed(1)}%
- Recent P&L: ${portfolio.totalPnL >= 0 ? '+' : ''}${portfolio.totalPnL.toFixed(4)} SOL

TRADING PARAMETERS:
- Stop Loss: ${tradingParams.stopLossPercent}%
- Take Profit: ${tradingParams.takeProfitPercent}%
- Position Size: ${tradingParams.positionSizePercent}%

Based on the token data and your portfolio state, decide whether to BUY or SKIP this token.

Consider:
1. Diversification (don't over-concentrate)
2. Risk management (portfolio balance)
3. Market conditions (random for simulation)
4. Win rate optimization

Respond with JSON only:
{
  "decision": "BUY" or "SKIP",
  "confidence": 0-100,
  "reasoning": "Brief explanation",
  "suggestedSL": number (stop loss %),
  "suggestedTP": number (take profit %),
  "positionSizeMultiplier": 0.5-1.5
}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a professional crypto trading AI. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const aiDecision = JSON.parse(jsonMatch[0])
      
      return NextResponse.json({
        success: true,
        decision: aiDecision.decision || 'SKIP',
        confidence: aiDecision.confidence || 50,
        reasoning: aiDecision.reasoning || 'AI analysis completed',
        suggestedSL: aiDecision.suggestedSL || tradingParams.stopLossPercent,
        suggestedTP: aiDecision.suggestedTP || tradingParams.takeProfitPercent,
        positionSizeMultiplier: aiDecision.positionSizeMultiplier || 1.0
      })
    }

    // Fallback if parsing fails
    return NextResponse.json({
      success: true,
      decision: 'SKIP',
      confidence: 0,
      reasoning: 'Unable to parse AI response',
      suggestedSL: tradingParams.stopLossPercent,
      suggestedTP: tradingParams.takeProfitPercent,
      positionSizeMultiplier: 1.0
    })

  } catch (error: any) {
    console.error('AI Paper Trading error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      decision: 'SKIP',
      confidence: 0
    }, { status: 500 })
  }
}
