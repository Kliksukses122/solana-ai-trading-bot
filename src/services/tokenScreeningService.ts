'use client'

// Token Screening Service - Uses server-side API to avoid CORS
// All external API calls go through our /api/tokens endpoint

export interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  price: number
  priceChange24h: number
  priceChange1h?: number
  priceChange5m?: number
  volume24h: number
  marketCap: number
  liquidity: number
  holders: number
  txns24h: number
  createdAt: number
  isVerified: boolean
  score: number
  signals: string[]
  pairAddress?: string
}

export interface TokenSignal {
  type: 'WHALE_BUY' | 'VOLUME_SPIKE' | 'NEW_TOKEN' | 'MOMENTUM_UP' | 'LIQUIDITY_ADDED'
  strength: number
  timestamp: number
  details: string
}

// Fetch trending tokens from our proxy API
export async function fetchTrendingTokens(): Promise<TokenInfo[]> {
  try {
    const response = await fetch('/api/tokens?action=trending')
    
    if (!response.ok) {
      console.error('Token API error:', response.status)
      return []
    }
    
    const data = await response.json()
    
    if (!data.success || !data.tokens) return []
    
    // Get detailed info for each token
    const tokenInfos: TokenInfo[] = []
    
    for (const token of data.tokens.slice(0, 15)) {
      try {
        const detailResponse = await fetch(`/api/tokens?action=detail&address=${token.address}`)
        if (detailResponse.ok) {
          const detailData = await detailResponse.json()
          if (detailData.success && detailData.token) {
            tokenInfos.push({
              address: detailData.token.address,
              symbol: detailData.token.symbol,
              name: detailData.token.name,
              decimals: 9,
              price: detailData.token.price,
              priceChange24h: detailData.token.priceChange24h,
              priceChange1h: detailData.token.priceChange1h || 0,
              priceChange5m: detailData.token.priceChange5m || 0,
              volume24h: detailData.token.volume24h,
              marketCap: detailData.token.marketCap,
              liquidity: detailData.token.liquidity,
              holders: 0,
              txns24h: detailData.token.txns24h,
              createdAt: detailData.token.createdAt,
              isVerified: false,
              score: calculateTokenScore(detailData.token),
              signals: detectSignals(detailData.token),
              pairAddress: detailData.token.pairAddress
            })
          }
        }
      } catch {
        // Skip if can't get details
      }
      
      // Limit concurrent requests
      if (tokenInfos.length >= 10) break
    }
    
    return tokenInfos
  } catch (error) {
    console.error('Error fetching trending tokens:', error)
    return []
  }
}

// Search tokens by query
export async function searchTokens(query: string): Promise<TokenInfo[]> {
  try {
    const response = await fetch(`/api/tokens?action=search&q=${encodeURIComponent(query)}`)
    
    if (!response.ok) return []
    
    const data = await response.json()
    
    if (!data.success || !data.tokens) return []
    
    return data.tokens.map((token: any) => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: 9,
      price: token.price,
      priceChange24h: token.priceChange24h,
      volume24h: token.volume24h,
      marketCap: token.marketCap,
      liquidity: token.liquidity,
      holders: 0,
      txns24h: 0,
      createdAt: Date.now(),
      isVerified: false,
      score: calculateTokenScore(token),
      signals: []
    }))
  } catch (error) {
    console.error('Error searching tokens:', error)
    return []
  }
}

// Get token details by address
export async function getTokenByAddress(address: string): Promise<TokenInfo | null> {
  try {
    const response = await fetch(`/api/tokens?action=detail&address=${address}`)
    
    if (!response.ok) return null
    
    const data = await response.json()
    
    if (!data.success || !data.token) return null
    
    return {
      address: data.token.address,
      symbol: data.token.symbol,
      name: data.token.name,
      decimals: 9,
      price: data.token.price,
      priceChange24h: data.token.priceChange24h,
      volume24h: data.token.volume24h,
      marketCap: data.token.marketCap,
      liquidity: data.token.liquidity,
      holders: 0,
      txns24h: data.token.txns24h,
      createdAt: data.token.createdAt,
      isVerified: false,
      score: calculateTokenScore(data.token),
      signals: detectSignals(data.token)
    }
  } catch (error) {
    console.error('Error fetching token:', error)
    return null
  }
}

// Calculate token score for trading decision (0-10)
function calculateTokenScore(token: any): number {
  let score = 0
  
  // Volume score (max 3 points)
  const volume = token.volume24h || 0
  if (volume > 1000000) score += 3
  else if (volume > 100000) score += 2
  else if (volume > 10000) score += 1
  
  // Liquidity score (max 3 points)
  const liquidity = token.liquidity || 0
  if (liquidity > 100000) score += 3
  else if (liquidity > 10000) score += 2
  else if (liquidity > 1000) score += 1
  
  // Price change momentum (max 2 points)
  const priceChange = token.priceChange24h || 0
  if (priceChange > 50) score += 2
  else if (priceChange > 10) score += 1
  else if (priceChange < -20) score -= 1
  
  // Transactions activity (max 2 points)
  const txns = token.txns24h || 0
  if (txns > 1000) score += 2
  else if (txns > 100) score += 1
  
  return Math.min(10, Math.max(0, score))
}

// Detect trading signals
function detectSignals(token: any): string[] {
  const signals: string[] = []
  
  const volume = token.volume24h || 0
  const liquidity = token.liquidity || 0
  const priceChange = token.priceChange24h || 0
  
  if (volume > 100000) {
    signals.push('VOLUME_SPIKE')
  }
  
  if (priceChange > 20) {
    signals.push('MOMENTUM_UP')
  }
  
  if (liquidity > 50000 && liquidity < 1000000) {
    signals.push('LIQUIDITY_ADDED')
  }
  
  if (token.createdAt && Date.now() - token.createdAt < 86400000) {
    signals.push('NEW_TOKEN')
  }
  
  return signals
}

// Screening filters
export interface ScreeningFilters {
  minVolume?: number
  minLiquidity?: number
  minScore?: number
  maxMarketCap?: number
  signals?: string[]
  sortBy?: 'volume24h' | 'liquidity' | 'score' | 'priceChange24h' | 'marketCap'
  sortOrder?: 'asc' | 'desc'
}

export function filterTokens(tokens: TokenInfo[], filters: ScreeningFilters): TokenInfo[] {
  let filtered = [...tokens]
  
  if (filters.minVolume) {
    filtered = filtered.filter(t => t.volume24h >= filters.minVolume!)
  }
  
  if (filters.minLiquidity) {
    filtered = filtered.filter(t => t.liquidity >= filters.minLiquidity!)
  }
  
  if (filters.minScore) {
    filtered = filtered.filter(t => t.score >= filters.minScore!)
  }
  
  if (filters.maxMarketCap) {
    filtered = filtered.filter(t => t.marketCap <= filters.maxMarketCap!)
  }
  
  if (filters.signals && filters.signals.length > 0) {
    filtered = filtered.filter(t => 
      filters.signals!.some(s => t.signals.includes(s))
    )
  }
  
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      const aVal = a[filters.sortBy!]
      const bVal = b[filters.sortBy!]
      return filters.sortOrder === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal)
    })
  }
  
  return filtered
}

// Format large numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K'
  }
  return num.toFixed(2)
}

// Format price
export function formatPrice(price: number): string {
  if (price === 0) return '$0'
  if (price < 0.00001) return '$' + price.toExponential(2)
  if (price < 1) return '$' + price.toFixed(6)
  if (price < 100) return '$' + price.toFixed(4)
  return '$' + price.toFixed(2)
}

// Get Solscan URL for token
export function getSolscanUrl(address: string): string {
  return `https://solscan.io/token/${address}`
}

// Get DexScreener URL for token
export function getDexscreenerUrl(pairAddress: string): string {
  return `https://dexscreener.com/solana/${pairAddress}`
}
