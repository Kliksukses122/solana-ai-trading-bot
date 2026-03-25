import { NextRequest, NextResponse } from 'next/server'

interface TokenData {
  symbol: string
  name: string
  price: number
  priceChange24h: number
  volume24h: number
  liquidity: number
  marketCap: number
  mint: string
  pairAddress: string
  dexId: string
}

// Cache for trending tokens
let cachedTokens: TokenData[] = []
let cacheTime = 0
const CACHE_DURATION = 60000 // 1 minute cache

/**
 * Fetch trending Solana tokens from DexScreener
 * Uses token-boosts endpoint for top gaining tokens
 */
async function fetchTrendingSolanaTokens(): Promise<TokenData[]> {
  const now = Date.now()
  
  // Return cached data if still valid
  if (cachedTokens.length > 0 && (now - cacheTime) < CACHE_DURATION) {
    return cachedTokens
  }

  try {
    // Fetch token boosts (sponsored/trending tokens)
    const boostsResponse = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { 'Accept': 'application/json' }
    })
    
    let tokens: TokenData[] = []
    
    if (boostsResponse.ok) {
      const boostsData = await boostsResponse.json()
      
      // Filter for Solana tokens only
      const solanaBoosts = (boostsData || []).filter((t: any) => 
        t.chainId === 'solana' || t.baseToken?.chainId === 'solana'
      )
      
      // Fetch detailed data for each boosted token
      for (const boost of solanaBoosts.slice(0, 10)) {
        try {
          const tokenAddress = boost.tokenAddress || boost.address
          if (!tokenAddress) continue
          
          const detailRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
          const detailData = await detailRes.json()
          
          if (detailData.pairs && detailData.pairs.length > 0) {
            // Get Solana pair with highest liquidity
            const solanaPair = detailData.pairs
              .filter((p: any) => p.chainId === 'solana')
              .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
            
            if (solanaPair && solanaPair.liquidity?.usd > 10000) {
              tokens.push({
                symbol: solanaPair.baseToken?.symbol || 'UNKNOWN',
                name: solanaPair.baseToken?.name || 'Unknown',
                price: parseFloat(solanaPair.priceUsd) || 0,
                priceChange24h: solanaPair.priceChange?.h24 || 0,
                volume24h: solanaPair.volume?.h24 || 0,
                liquidity: solanaPair.liquidity?.usd || 0,
                marketCap: solanaPair.fdv || 0,
                mint: solanaPair.baseToken?.address || tokenAddress,
                pairAddress: solanaPair.pairAddress || '',
                dexId: solanaPair.dexId || 'raydium'
              })
            }
          }
          
          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 100))
        } catch (e) {
          console.error('Error fetching boost token details:', e)
        }
      }
    }

    // If we didn't get enough tokens from boosts, fetch from search
    if (tokens.length < 5) {
      // Search for popular Solana tokens
      const searchQueries = ['solana', 'bonk', 'wif', 'jupiter', 'raydium']
      
      for (const query of searchQueries) {
        try {
          const searchRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${query}`)
          const searchData = await searchRes.json()
          
          if (searchData.pairs) {
            const solanaPairs = searchData.pairs
              .filter((p: any) => p.chainId === 'solana')
              .filter((p: any) => (p.liquidity?.usd || 0) > 50000)
              .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
            
            for (const pair of solanaPairs.slice(0, 3)) {
              // Check if token already in list
              if (!tokens.find(t => t.mint === pair.baseToken?.address)) {
                tokens.push({
                  symbol: pair.baseToken?.symbol || 'UNKNOWN',
                  name: pair.baseToken?.name || 'Unknown',
                  price: parseFloat(pair.priceUsd) || 0,
                  priceChange24h: pair.priceChange?.h24 || 0,
                  volume24h: pair.volume?.h24 || 0,
                  liquidity: pair.liquidity?.usd || 0,
                  marketCap: pair.fdv || 0,
                  mint: pair.baseToken?.address || '',
                  pairAddress: pair.pairAddress || '',
                  dexId: pair.dexId || 'raydium'
                })
              }
            }
          }
          
          await new Promise(r => setTimeout(r, 100))
        } catch (e) {
          console.error('Error searching tokens:', e)
        }
      }
    }

    // Filter out duplicates and low liquidity tokens
    tokens = tokens
      .filter(t => t.liquidity >= 10000 && t.price > 0)
      .filter((t, i, arr) => arr.findIndex(x => x.mint === t.mint) === i)
      .slice(0, 15)

    // Update cache
    if (tokens.length > 0) {
      cachedTokens = tokens
      cacheTime = now
    }

    console.log(`[DexScreener] Fetched ${tokens.length} trending Solana tokens`)
    return tokens

  } catch (error) {
    console.error('Error fetching trending tokens:', error)
    
    // Return cached data if available
    if (cachedTokens.length > 0) {
      return cachedTokens
    }
    
    return []
  }
}

/**
 * Fetch detailed token data by mint address
 */
async function fetchTokenData(mint: string): Promise<TokenData | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { 'Accept': 'application/json' }
    })
    const data = await response.json()
    
    if (data.pairs && data.pairs.length > 0) {
      // Get Solana pair with highest liquidity
      const bestPair = data.pairs
        .filter((p: any) => p.chainId === 'solana')
        .sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
      
      if (bestPair) {
        return {
          symbol: bestPair.baseToken?.symbol || 'UNKNOWN',
          name: bestPair.baseToken?.name || 'Unknown',
          price: parseFloat(bestPair.priceUsd) || 0,
          priceChange24h: bestPair.priceChange?.h24 || 0,
          volume24h: bestPair.volume?.h24 || 0,
          liquidity: bestPair.liquidity?.usd || 0,
          marketCap: bestPair.fdv || 0,
          mint: bestPair.baseToken?.address || mint,
          pairAddress: bestPair.pairAddress || '',
          dexId: bestPair.dexId || 'raydium'
        }
      }
    }
    return null
  } catch (error) {
    console.error(`Error fetching token ${mint}:`, error)
    return null
  }
}

// Track last AI call time to avoid rate limiting
let lastAICallTime = 0
const AI_CALL_MIN_INTERVAL = 3000 // 3 seconds minimum between AI calls

/**
 * Generate analysis using rule-based system (no AI API call)
 */
function generateRuleBasedAnalysis(token: TokenData, balance: number) {
  const hasGoodMomentum = token.priceChange24h > -20
  const hasSomeLiquidity = token.liquidity > 10000
  const hasSomeVolume = token.volume24h > 50000
  
  if (hasGoodMomentum && hasSomeLiquidity) {
    const confidence = hasSomeVolume && token.priceChange24h > 0 ? 70 : 55
    return {
      decision: 'BUY',
      confidence,
      stopLoss: token.price * 0.92,
      takeProfit: token.price * 1.15,
      positionSize: balance * 0.03,
      reasoning: hasSomeVolume 
        ? `Rule-based: ${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}% 24h, $${(token.volume24h/1000).toFixed(0)}K vol`
        : `Rule-based: Meets criteria for paper trading`,
      signals: ['RULE_BASED', hasSomeVolume ? 'HAS_VOLUME' : 'LOW_VOLUME']
    }
  }
  
  return {
    decision: 'BUY',
    confidence: 45,
    stopLoss: token.price * 0.90,
    takeProfit: token.price * 1.12,
    positionSize: balance * 0.02,
    reasoning: 'Rule-based: Paper trade for learning',
    signals: ['RULE_BASED', 'HIGH_RISK']
  }
}

/**
 * AI Analysis using z-ai-web-dev-sdk with rate limiting protection
 */
async function analyzeWithAI(token: TokenData, balance: number) {
  // Check rate limit - if called too recently, use rule-based
  const now = Date.now()
  const timeSinceLastCall = now - lastAICallTime
  
  if (timeSinceLastCall < AI_CALL_MIN_INTERVAL) {
    console.log(`[AI] Rate limit protection: using rule-based analysis (${timeSinceLastCall}ms since last call)`)
    return generateRuleBasedAnalysis(token, balance)
  }
  
  try {
    lastAICallTime = now
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    
    const prompt = `You are a crypto trading AI. Analyze this token and respond with JSON only.

Token: ${token.symbol}
Price: $${token.price.toFixed(8)}
24h: ${token.priceChange24h.toFixed(1)}%
Vol: $${(token.volume24h / 1000).toFixed(0)}K
Liq: $${(token.liquidity / 1000).toFixed(0)}K

Return JSON: {"decision":"BUY","confidence":60,"stopLoss":${token.price * 0.92},"takeProfit":${token.price * 1.15},"positionSizePercent":3,"reasoning":"brief reason"}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a trading AI. Respond with JSON only. Be willing to BUY for paper trading.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 150,
    })

    const text = completion.choices[0]?.message?.content || ''
    console.log('[AI] Response:', text.substring(0, 100))
    
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        decision: parsed.decision === 'BUY' ? 'BUY' : 'SKIP',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 55)),
        stopLoss: parsed.stopLoss || token.price * 0.92,
        takeProfit: parsed.takeProfit || token.price * 1.15,
        positionSize: ((parsed.positionSizePercent || 3) / 100) * balance,
        reasoning: parsed.reasoning || 'AI analysis',
        signals: ['AI_POWERED']
      }
    }
  } catch (error: any) {
    console.error('[AI] Error:', error.message?.substring(0, 100))
    
    // If rate limited, use rule-based
    if (error.message?.includes('429') || error.message?.includes('Too many')) {
      console.log('[AI] Rate limited, using rule-based analysis')
    }
  }
  
  // Fallback to rule-based
  return generateRuleBasedAnalysis(token, balance)
}

// GET handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  try {
    if (action === 'tokens') {
      const tokens = await fetchTrendingSolanaTokens()
      return NextResponse.json({ 
        success: true, 
        tokens, 
        count: tokens.length,
        source: 'dexscreener_live',
        cachedAt: cacheTime
      })
    }
    
    if (action === 'trending') {
      const tokens = await fetchTrendingSolanaTokens()
      
      // Sort by volume
      const sorted = tokens.sort((a, b) => b.volume24h - a.volume24h)
      
      return NextResponse.json({ 
        success: true, 
        tokens: sorted.slice(0, 10),
        source: 'dexscreener_trending'
      })
    }
    
    if (action === 'random') {
      const tokens = await fetchTrendingSolanaTokens()
      
      if (tokens.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tokens available'
        }, { status: 500 })
      }
      
      // Get random token from trending list
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)]
      
      // Fetch fresh data for this token
      const freshData = await fetchTokenData(randomToken.mint)
      
      if (freshData) {
        return NextResponse.json({ 
          success: true, 
          token: freshData,
          source: 'dexscreener_live'
        })
      }
      
      // Return cached data if fresh fetch fails
      return NextResponse.json({ 
        success: true, 
        token: randomToken,
        source: 'dexscreener_cached'
      })
    }
    
    if (action === 'refresh') {
      // Force refresh cache
      cacheTime = 0
      cachedTokens = []
      const tokens = await fetchTrendingSolanaTokens()
      
      return NextResponse.json({ 
        success: true, 
        tokens,
        count: tokens.length,
        message: 'Token list refreshed from DexScreener'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'AI Paper Trading API - DexScreener Live',
      endpoints: {
        'GET ?action=tokens': 'Get trending Solana tokens from DexScreener',
        'GET ?action=trending': 'Get top 10 trending by volume',
        'GET ?action=random': 'Get random token for trading',
        'GET ?action=refresh': 'Force refresh token cache',
        'POST action=analyze': 'AI analysis for random token'
      },
      cacheStatus: {
        cachedTokens: cachedTokens.length,
        cacheAge: cacheTime ? Math.round((Date.now() - cacheTime) / 1000) + 's' : 'empty'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, portfolioBalance, tokenMint } = body
    
    if (action === 'analyze') {
      let tokenData: TokenData | null = null
      
      // If specific token mint provided, analyze that
      if (tokenMint) {
        tokenData = await fetchTokenData(tokenMint)
      } else {
        // Get random token from trending list
        const tokens = await fetchTrendingSolanaTokens()
        
        if (tokens.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No trending tokens available'
          }, { status: 500 })
        }
        
        // Get random token
        const randomToken = tokens[Math.floor(Math.random() * tokens.length)]
        
        // Fetch fresh data
        tokenData = await fetchTokenData(randomToken.mint)
      }
      
      if (!tokenData) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch token data'
        }, { status: 500 })
      }
      
      // AI Analysis
      const analysis = await analyzeWithAI(tokenData, portfolioBalance || 10)
      
      return NextResponse.json({
        success: true,
        token: tokenData,
        analysis,
        source: 'dexscreener_live'
      })
    }

    if (action === 'analyze-specific') {
      // Analyze a specific token by mint
      if (!tokenMint) {
        return NextResponse.json({
          success: false,
          error: 'tokenMint required'
        }, { status: 400 })
      }

      const tokenData = await fetchTokenData(tokenMint)
      
      if (!tokenData) {
        return NextResponse.json({
          success: false,
          error: 'Token not found'
        }, { status: 404 })
      }

      const analysis = await analyzeWithAI(tokenData, portfolioBalance || 10)
      
      return NextResponse.json({
        success: true,
        token: tokenData,
        analysis,
        source: 'dexscreener_live'
      })
    }
    
    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
    
  } catch (error: any) {
    console.error('POST Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
