import { NextRequest, NextResponse } from 'next/server'
import config from '@/config/config'

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

// Popular Solana token mints for Helius API
const POPULAR_TOKEN_MINTS = [
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', // POPCAT
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
  'MEW1gQWJ3NEXViWtHmfavmSzto5hVwmewNgXFWYBXgJ', // MEW
  'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahKUNnPDPu5', // MYRO
  '3rxtVostGBFBJid5wQ9BdLsJ6Lm3iN7gZzLPwiE7Z9Zj', // PENGU
  '5y3SBh7sPENXgFPfdH7yXqPA3f9C5o4aZDmAoiv8eNzV', // PONKE
  '9fm4j4jArtG3MbJDvz9CKtqUKXm5Yx5fG8gT3vYfDwFb', // BOME
  '2jDnVLG9qoM36M7j9tMxKAKYvqUPi5uNJn2D3hZuvKDQ', // WYNN
]

// Helius API configuration
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || ''
const HELIUS_RPC_URL = config.solana.rpcUrl || 'https://api.mainnet-beta.solana.com'

/**
 * Fetch token price using Helius DAS API
 */
async function fetchTokenPriceHelius(mint: string): Promise<{ price: number; marketCap: number } | null> {
  try {
    // Use Helius DAS API for token info
    const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mintAccounts: [mint],
        includeOffChainData: true
      })
    })

    if (!response.ok) return null
    
    const data = await response.json()
    if (data && data[0]) {
      const tokenInfo = data[0]
      return {
        price: tokenInfo.offChainData?.price_usd || tokenInfo.onChainData?.price || 0,
        marketCap: tokenInfo.offChainData?.market_cap || 0
      }
    }
  } catch (error) {
    console.error('[Helius] Token price error:', error)
  }
  return null
}

/**
 * Fetch trending Solana tokens using DexScreener with Helius RPC
 */
async function fetchTrendingSolanaTokens(): Promise<TokenData[]> {
  const now = Date.now()
  
  // Return cached data if still valid
  if (cachedTokens.length > 0 && (now - cacheTime) < CACHE_DURATION) {
    return cachedTokens
  }

  try {
    let tokens: TokenData[] = []
    
    // Method 1: Try DexScreener with popular tokens
    for (const mint of POPULAR_TOKEN_MINTS) {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
        
        if (!response.ok) continue
        
        const data = await response.json()
        
        if (data.pairs && data.pairs.length > 0) {
          // Get Solana pair with highest liquidity
          const solanaPair = data.pairs
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
              mint: solanaPair.baseToken?.address || mint,
              pairAddress: solanaPair.pairAddress || '',
              dexId: solanaPair.dexId || 'raydium'
            })
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 50))
      } catch (e) {
        // Continue to next token on error
        continue
      }
    }

    // Method 2: Try token boosts if we don't have enough tokens
    if (tokens.length < 5) {
      try {
        const boostsResponse = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        })
        
        if (boostsResponse.ok) {
          const boostsData = await boostsResponse.json()
          
          const solanaBoosts = (boostsData || [])
            .filter((t: any) => t.chainId === 'solana')
            .slice(0, 5)
          
          for (const boost of solanaBoosts) {
            const mint = boost.tokenAddress || boost.address
            if (!mint || tokens.find(t => t.mint === mint)) continue
            
            try {
              const detailRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
                signal: AbortSignal.timeout(5000)
              })
              const detailData = await detailRes.json()
              
              if (detailData.pairs && detailData.pairs.length > 0) {
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
                    mint: solanaPair.baseToken?.address || mint,
                    pairAddress: solanaPair.pairAddress || '',
                    dexId: solanaPair.dexId || 'raydium'
                  })
                }
              }
              
              await new Promise(r => setTimeout(r, 50))
            } catch (e) {
              continue
            }
          }
        }
      } catch (e) {
        console.error('[DexScreener] Boosts fetch error:', e)
      }
    }

    // Filter and dedupe
    tokens = tokens
      .filter(t => t.liquidity >= 10000 && t.price > 0)
      .filter((t, i, arr) => arr.findIndex(x => x.mint === t.mint) === i)
      .slice(0, 15)

    if (tokens.length > 0) {
      cachedTokens = tokens
      cacheTime = now
      console.log(`[Tokens] Fetched ${tokens.length} tokens`)
    }

    return tokens

  } catch (error) {
    console.error('[Tokens] Error:', error)
    
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
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    })
    const data = await response.json()
    
    if (data.pairs && data.pairs.length > 0) {
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
    console.error(`[Tokens] Error fetching ${mint}:`, error)
    return null
  }
}

// Track last AI call time to avoid rate limiting
let lastAICallTime = 0
const AI_CALL_MIN_INTERVAL = 3000

/**
 * Generate analysis using rule-based system
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
      reasoning: `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}% 24h, $${(token.volume24h/1000).toFixed(0)}K vol`,
      signals: ['RULE_BASED', hasSomeVolume ? 'HAS_VOLUME' : 'LOW_VOLUME']
    }
  }
  
  return {
    decision: 'BUY',
    confidence: 45,
    stopLoss: token.price * 0.90,
    takeProfit: token.price * 1.12,
    positionSize: balance * 0.02,
    reasoning: 'Paper trade for learning',
    signals: ['RULE_BASED', 'HIGH_RISK']
  }
}

/**
 * AI Analysis using z-ai-web-dev-sdk
 */
async function analyzeWithAI(token: TokenData, balance: number) {
  const now = Date.now()
  const timeSinceLastCall = now - lastAICallTime
  
  if (timeSinceLastCall < AI_CALL_MIN_INTERVAL) {
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
        { role: 'system', content: 'You are a trading AI. Respond with JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 150,
    })

    const text = completion.choices[0]?.message?.content || ''
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
    console.error('[AI] Error:', error.message?.substring(0, 50))
  }
  
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
        source: 'dexscreener_helius',
        cachedAt: cacheTime
      })
    }
    
    if (action === 'trending') {
      const tokens = await fetchTrendingSolanaTokens()
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
      
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)]
      const freshData = await fetchTokenData(randomToken.mint)
      
      return NextResponse.json({ 
        success: true, 
        token: freshData || randomToken,
        source: 'dexscreener_live'
      })
    }
    
    if (action === 'refresh') {
      cacheTime = 0
      cachedTokens = []
      const tokens = await fetchTrendingSolanaTokens()
      
      return NextResponse.json({ 
        success: true, 
        tokens,
        count: tokens.length,
        message: 'Token list refreshed'
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'AI Trading API - DexScreener + Helius',
      endpoints: {
        'GET ?action=tokens': 'Get trending Solana tokens',
        'GET ?action=trending': 'Get top 10 by volume',
        'GET ?action=random': 'Get random token',
        'GET ?action=refresh': 'Force refresh cache',
        'POST action=analyze': 'AI analysis'
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
      
      if (tokenMint) {
        tokenData = await fetchTokenData(tokenMint)
      } else {
        const tokens = await fetchTrendingSolanaTokens()
        
        if (tokens.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No tokens available'
          }, { status: 500 })
        }
        
        const randomToken = tokens[Math.floor(Math.random() * tokens.length)]
        tokenData = await fetchTokenData(randomToken.mint)
      }
      
      if (!tokenData) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch token data'
        }, { status: 500 })
      }
      
      const analysis = await analyzeWithAI(tokenData, portfolioBalance || 10)
      
      return NextResponse.json({
        success: true,
        token: tokenData,
        analysis,
        source: 'dexscreener_live'
      })
    }

    if (action === 'analyze-specific') {
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
