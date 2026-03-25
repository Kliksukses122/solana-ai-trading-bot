import { NextRequest, NextResponse } from 'next/server'
import { executeSwap, getSolBalance, getTokenBalance } from '@/services/jupiterSwapService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, tokenMint, amountSol, slippageBps } = body
    
    // Check for treasury private key
    if (!process.env.TREASURY_PRIVATE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'TREASURY_PRIVATE_KEY not configured. Please add your treasury wallet private key to .env'
      }, { status: 500 })
    }
    
    switch (action) {
      case 'swap': {
        if (!tokenMint || !amountSol) {
          return NextResponse.json({
            success: false,
            error: 'Missing tokenMint or amountSol'
          }, { status: 400 })
        }
        
        const result = await executeSwap(tokenMint, amountSol, slippageBps || 100)
        return NextResponse.json(result)
      }
      
      case 'balance': {
        const solBalance = await getSolBalance()
        let tokenBalance = 0
        
        if (tokenMint) {
          tokenBalance = await getTokenBalance(tokenMint)
        }
        
        return NextResponse.json({
          success: true,
          solBalance,
          tokenBalance
        })
      }
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use "swap" or "balance"'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Jupiter API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const tokenMint = searchParams.get('tokenMint')
    
    if (action === 'balance') {
      const solBalance = await getSolBalance()
      let tokenBalance = 0
      
      if (tokenMint) {
        tokenBalance = await getTokenBalance(tokenMint)
      }
      
      return NextResponse.json({
        success: true,
        solBalance,
        tokenBalance
      })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
