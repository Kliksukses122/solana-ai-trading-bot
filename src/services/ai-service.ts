// src/services/ai-service.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MarketData {
  solPrice: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
}

interface AgentAnalysis {
  agent: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  targetToken: string;
  amount: number;
  reasoning: string;
  agentAnalyses: AgentAnalysis[];
}

// Agent 1: Technical Analyst
async function technicalAnalysis(marketData: MarketData): Promise<AgentAnalysis> {
  const prompt = `You are a Technical Analyst for crypto trading. Analyze this SOL market data and provide a trading signal.

Market Data:
- Current SOL Price: $${marketData.solPrice}
- 24h Price Change: ${marketData.priceChange24h}%
- 24h Volume: $${marketData.volume24h}
- Market Cap: $${marketData.marketCap}

Provide your analysis in this exact JSON format:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signal: 'HOLD', confidence: 50, reasoning: 'Analysis unavailable' };
  
  return { agent: 'Technical Analyst', ...result };
}

// Agent 2: Sentiment Analyst
async function sentimentAnalysis(marketData: MarketData): Promise<AgentAnalysis> {
  const prompt = `You are a Sentiment Analyst for crypto trading. Based on market conditions, analyze market sentiment.

Current SOL Price: $${marketData.solPrice}
24h Change: ${marketData.priceChange24h}%

Consider: fear/greed index, market momentum, social sentiment indicators.

Respond in this exact JSON format:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signal: 'HOLD', confidence: 50, reasoning: 'Analysis unavailable' };
  
  return { agent: 'Sentiment Analyst', ...result };
}

// Agent 3: Liquidity Analyst
async function liquidityAnalysis(marketData: MarketData): Promise<AgentAnalysis> {
  const prompt = `You are a Liquidity Analyst. Evaluate market liquidity conditions for trading SOL.

Volume: $${marketData.volume24h}
Price: $${marketData.solPrice}

Consider: slippage risk, order book depth, swap feasibility.

Respond in this exact JSON format:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signal: 'HOLD', confidence: 50, reasoning: 'Analysis unavailable' };
  
  return { agent: 'Liquidity Analyst', ...result };
}

// Agent 4: Risk Manager
async function riskAnalysis(marketData: MarketData, currentBalance: number): Promise<AgentAnalysis> {
  const prompt = `You are a Risk Manager. Assess risk for trading with current portfolio.

Current Balance: ${currentBalance} SOL ($${currentBalance * marketData.solPrice})
SOL Price: $${marketData.solPrice}
24h Volatility: ${Math.abs(marketData.priceChange24h)}%

Consider: position sizing, stop-loss levels, portfolio exposure.

Respond in this exact JSON format:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signal: 'HOLD', confidence: 50, reasoning: 'Analysis unavailable' };
  
  return { agent: 'Risk Manager', ...result };
}

// Agent 5: Portfolio Manager
async function portfolioAnalysis(marketData: MarketData, currentBalance: number): Promise<AgentAnalysis> {
  const prompt = `You are a Portfolio Manager. Evaluate overall portfolio strategy.

Current Portfolio: ${currentBalance} SOL
SOL Price: $${marketData.solPrice}
Portfolio Value: $${currentBalance * marketData.solPrice}

Consider: diversification, rebalancing needs, long-term strategy.

Respond in this exact JSON format:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signal: 'HOLD', confidence: 50, reasoning: 'Analysis unavailable' };
  
  return { agent: 'Portfolio Manager', ...result };
}

// Agent 6: Execution Engine
async function executionAnalysis(analyses: AgentAnalysis[]): Promise<AgentAnalysis> {
  const buySignals = analyses.filter(a => a.signal === 'BUY').length;
  const sellSignals = analyses.filter(a => a.signal === 'SELL').length;
  const holdSignals = analyses.filter(a => a.signal === 'HOLD').length;

  const prompt = `You are the Execution Engine. Based on other agents' analyses, make the final execution decision.

Agent Analyses:
 ${analyses.map(a => `- ${a.agent}: ${a.signal} (${a.confidence}% confidence) - ${a.reasoning}`).join('\n')}

Summary: ${buySignals} BUY, ${sellSignals} SELL, ${holdSignals} HOLD signals.

Respond in this exact JSON format:
{
  "signal": "BUY" or "SELL" or "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation for final decision"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signal: 'HOLD', confidence: 50, reasoning: 'Analysis unavailable' };
  
  return { agent: 'Execution Engine', ...result };
}

// Main function: Run all agents and get trading decision
export async function runAIAnalysis(marketData: MarketData, currentBalance: number): Promise<TradingDecision> {
  console.log('🤖 Running AI Agent Analysis...');
  
  // Run all analysis agents in parallel
  const [technical, sentiment, liquidity, risk, portfolio] = await Promise.all([
    technicalAnalysis(marketData),
    sentimentAnalysis(marketData),
    liquidityAnalysis(marketData),
    riskAnalysis(marketData, currentBalance),
    portfolioAnalysis(marketData, currentBalance),
  ]);

  const agentAnalyses = [technical, sentiment, liquidity, risk, portfolio];
  
  // Run execution engine with all analyses
  const execution = await executionAnalysis(agentAnalyses);
  agentAnalyses.push(execution);

  // Calculate weighted decision
  const weights = {
    'Technical Analyst': 0.25,
    'Sentiment Analyst': 0.20,
    'Liquidity Analyst': 0.15,
    'Risk Manager': 0.20,
    'Portfolio Manager': 0.10,
    'Execution Engine': 0.10,
  };

  let buyScore = 0;
  let sellScore = 0;
  let holdScore = 0;

  agentAnalyses.forEach(a => {
    const weight = weights[a.agent as keyof typeof weights] || 0.1;
    const weightedConfidence = a.confidence * weight;
    
    if (a.signal === 'BUY') buyScore += weightedConfidence;
    else if (a.signal === 'SELL') sellScore += weightedConfidence;
    else holdScore += weightedConfidence;
  });

  // Determine final action
  let action: 'BUY' | 'SELL' | 'HOLD';
  let confidence: number;
  
  if (buyScore > sellScore && buyScore > holdScore) {
    action = 'BUY';
    confidence = buyScore;
  } else if (sellScore > buyScore && sellScore > holdScore) {
    action = 'SELL';
    confidence = sellScore;
  } else {
    action = 'HOLD';
    confidence = holdScore;
  }

  // Calculate trade amount (max 10% of balance for buy, or 50% of holdings for sell)
  const amount = action === 'BUY' 
    ? Math.min(currentBalance * 0.1, 0.01) // Max 10% of balance or 0.01 SOL
    : action === 'SELL'
    ? currentBalance * 0.5 // Sell 50% of holdings
    : 0;

  return {
    action,
    confidence: Math.round(confidence),
    targetToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount,
    reasoning: execution.reasoning,
    agentAnalyses,
  };
}

export default { runAIAnalysis };
