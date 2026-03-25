import { NextRequest, NextResponse } from 'next/server'

const DEXSCREENER_API = 'https://api.dexscreener.com'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  try {
    switch (action) {
      case 'trending': {
        // Get trending/boosted tokens
        const response = await fetch(`${DEXSCREENER_API}/token-boosts/top/v1`)
        if (!response.ok) {
          return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: response.status })
        }
        const data = await response.json()
        
        // Filter Solana tokens
        const solanaTokens = (Array.isArray(data) ? data : [])
          .filter((token: any) => token.chainId === 'solana')
          .slice(0, 20)
          .map((token: any) => ({
            address: token.tokenAddress,
            symbol: token.description?.substring(0, 10) || 'UNKNOWN',
            name: token.description || 'Unknown Token',
            icon: token.icon ? `https://cdn.dexscreener.com/cms/images/${token.icon}` : null,
            boostAmount: token.totalAmount || 0,
            url: token.url
          }))
        
        return NextResponse.json({ success: true, tokens: solanaTokens })
      }
      
      case 'detail': {
        // Get detailed token info
        const address = searchParams.get('address')
        if (!address) {
          return NextResponse.json({ error: 'Address required' }, { status: 400 })
        }
        
        const response = await fetch(`${DEXSCREENER_API}/latest/dex/tokens/${address}`)
        if (!response.ok) {
          return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: response.status })
        }
        const data = await response.json()
        
        // Find Solana pair
        const pair = data.pairs?.find((p: any) => p.chainId === 'solana') || data.pairs?.[0]
        
        if (!pair) {
          return NextResponse.json({ success: false, error: 'No pair found' }, { status: 404 })
        }
        
        const tokenInfo = {
          address: pair.baseToken?.address || address,
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown Token',
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          priceChange5m: pair.priceChange?.m5 || 0,
          volume24h: pair.volume?.h24 || 0,
          marketCap: pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          pairAddress: pair.pairAddress,
          pairUrl: `https://dexscreener.com/solana/${pair.pairAddress}`,
          createdAt: pair.pairCreatedAt || Date.now()
        }
        
        return NextResponse.json({ success: true, token: tokenInfo })
      }
      
      case 'search': {
        // Search tokens
        const query = searchParams.get('q')
        if (!query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 })
        }
        
        const response = await fetch(`${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`)
        if (!response.ok) {
          return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: response.status })
        }
        const data = await response.json()
        
        const tokens = (data.pairs || [])
          .filter((pair: any) => pair.chainId === 'solana')
          .slice(0, 10)
          .map((pair: any) => ({
            address: pair.baseToken?.address || '',
            symbol: pair.baseToken?.symbol || 'UNKNOWN',
            name: pair.baseToken?.name || 'Unknown Token',
            price: parseFloat(pair.priceUsd) || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            liquidity: pair.liquidity?.usd || 0
          }))
        
        return NextResponse.json({ success: true, tokens })
      }
      
      default:
        return NextResponse.json({
          success: true,
          message: 'Token Screening API',
          endpoints: [
            'GET action=trending - Get trending tokens',
            'GET action=detail&address=XXX - Get token details',
            'GET action=search&q=XXX - Search tokens'
          ]
        })
    }
  } catch (error) {
    console.error('Token API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
