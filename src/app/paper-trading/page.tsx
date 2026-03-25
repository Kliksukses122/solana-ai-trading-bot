'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { 
  ArrowLeft, Play, Pause, RotateCcw, TrendingUp, TrendingDown, Target, 
  Shield, BarChart3, Activity, Clock, DollarSign, CheckCircle, XCircle,
  AlertTriangle, Zap, RefreshCw, Brain, Sparkles, ArrowRight, Link as LinkIcon
} from 'lucide-react'

interface Position {
  id: string
  tradeId?: string // For tracking in learning service
  symbol: string
  name: string
  mint?: string
  entryPrice: number
  currentPrice: number
  amount: number
  valueSOL: number
  stopLoss: number
  takeProfit: number
  entryTime: number
  pnl: number
  pnlPercent: number
  aiConfidence: number
  aiReasoning: string
}

interface Portfolio {
  balance: number
  initialBalance: number
  totalPnL: number
  totalPnLPercent: number
  openPositions: Position[]
  closedPositions: any[]
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  maxDrawdown: number
  aiTrades: number
  aiWins: number
  aiLosses: number
  aiWinRate: number
}

interface TokenData {
  symbol: string
  name: string
  price: number
  priceChange24h: number
  volume24h: number
  liquidity: number
  mint?: string
}

interface StrategyReadiness {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  isReadyForReal: boolean
  winRate: number
  profitFactor: number
  totalTrades: number
  recommendations: string[]
}

export default function AIPaperTradingPage() {
  const [portfolio, setPortfolio] = useState<Portfolio>({
    balance: 10,
    initialBalance: 10,
    totalPnL: 0,
    totalPnLPercent: 0,
    openPositions: [],
    closedPositions: [],
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    aiTrades: 0,
    aiWins: 0,
    aiLosses: 0,
    aiWinRate: 0
  })
  const [isRunning, setIsRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initBalance, setInitBalance] = useState('10')
  const [logs, setLogs] = useState<{ time: number; message: string; type: 'info' | 'success' | 'error' | 'ai' | 'learning' }[]>([])
  const [equityPeak, setEquityPeak] = useState(10)
  const [activeTab, setActiveTab] = useState('overview')
  const [showParams, setShowParams] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [strategyReadiness, setStrategyReadiness] = useState<StrategyReadiness | null>(null)

  // Trading parameters - MUST be declared before refs that use it
  const [tradingParams, setTradingParams] = useState({
    stopLossPercent: 8,      // Increased for volatility
    takeProfitPercent: 15,   // Increased for volatility  
    positionSizePercent: 4,
    maxPositions: 3,
    tradeIntervalSec: 15,    // Increased to reduce API calls
    minAiConfidence: 40,     // Lower threshold to allow more trades
    priceVolatility: 10      // Increased to 10% for faster SL/TP hits
  })
  
  const tradingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const priceUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const portfolioRef = useRef<Portfolio>(portfolio)
  const tradingParamsRef = useRef(tradingParams)
  const equityPeakRef = useRef(equityPeak)
  
  // Keep refs updated
  useEffect(() => {
    portfolioRef.current = portfolio
  }, [portfolio])
  
  useEffect(() => {
    tradingParamsRef.current = tradingParams
  }, [tradingParams])
  
  useEffect(() => {
    equityPeakRef.current = equityPeak
  }, [equityPeak])

  // Add log
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'ai' | 'learning' = 'info') => {
    setLogs(prev => [{ time: Date.now(), message, type }, ...prev].slice(0, 50))
  }, [])

  // Fetch strategy readiness
  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch('/api/unified-trading?action=readiness')
      const data = await res.json()
      if (data.success) {
        setStrategyReadiness(data.readiness)
      }
    } catch (error) {
      console.error('Failed to fetch readiness:', error)
    }
  }, [])

  // Initialize
  const initPaperTrading = useCallback(() => {
    const balance = parseFloat(initBalance) || 10
    setPortfolio({
      balance,
      initialBalance: balance,
      totalPnL: 0,
      totalPnLPercent: 0,
      openPositions: [],
      closedPositions: [],
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      maxDrawdown: 0,
      aiTrades: 0,
      aiWins: 0,
      aiLosses: 0,
      aiWinRate: 0
    })
    setEquityPeak(balance)
    setLogs([])
    setIsRunning(false)
    addLog(`🚀 AI Paper Trading initialized with ${balance} SOL`, 'success')
    addLog(`📊 Results will be recorded for AI learning`, 'learning')
  }, [initBalance, addLog])

  // AI Token Analysis
  const analyzeTokenWithAI = useCallback(async () => {
    if (aiAnalyzing) return null
    setAiAnalyzing(true)
    
    try {
      addLog('🧠 AI analyzing market...', 'ai')
      
      const response = await fetch('/api/ai-paper-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          portfolioBalance: portfolio.balance
        })
      })
      
      const data = await response.json()
      
      if (data.success && data.analysis) {
        const { token, analysis } = data
        
        addLog(`📊 AI analyzed ${token.symbol}: ${analysis.decision} (${analysis.confidence}% confidence)`, 'ai')
        
        return { token, analysis }
      }
      
      return null
    } catch (error) {
      console.error('AI analysis error:', error)
      addLog('❌ AI analysis failed', 'error')
      return null
    } finally {
      setAiAnalyzing(false)
    }
  }, [aiAnalyzing, portfolio.balance, addLog])

  // Record trade to learning service
  const recordTradeToLearning = useCallback(async (position: Position, token: TokenData) => {
    try {
      const response = await fetch('/api/unified-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-paper-trade',
          data: {
            token: {
              symbol: position.symbol,
              name: position.name,
              mint: token.mint || ''
            },
            action: 'BUY',
            amount: position.amount,
            entryPrice: position.entryPrice,
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            confidence: position.aiConfidence,
            reasoning: position.aiReasoning,
            signals: ['AI_ANALYSIS']
          }
        })
      })
      
      const data = await response.json()
      if (data.success) {
        addLog(`📚 Trade recorded to learning service`, 'learning')
        return data.tradeId
      }
    } catch (error) {
      console.error('Failed to record trade:', error)
    }
    return null
  }, [addLog])

  // Update trade outcome in learning service
  const updateTradeOutcomeInLearning = useCallback(async (
    tradeId: string,
    outcome: 'WIN' | 'LOSS',
    exitPrice: number,
    profitPercent: number
  ) => {
    try {
      const response = await fetch('/api/unified-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-outcome',
          data: {
            tradeId,
            outcome,
            exitPrice,
            profitPercent
          }
        })
      })
      
      const data = await response.json()
      if (data.success) {
        addLog(`📊 Learning updated: Grade ${data.readiness?.grade || '?'}`, 'learning')
        setStrategyReadiness(data.readiness)
      }
    } catch (error) {
      console.error('Failed to update outcome:', error)
    }
  }, [addLog])

  // Open position based on AI recommendation
  const openPositionWithAI = useCallback(async () => {
    if (portfolio.openPositions.length >= tradingParams.maxPositions) return
    if (portfolio.balance < 0.1) return

    const result = await analyzeTokenWithAI()
    if (!result) return

    const { token, analysis } = result

    // Check AI confidence threshold
    if (analysis.decision !== 'BUY' || analysis.confidence < tradingParams.minAiConfidence) {
      addLog(`⏭️ AI SKIP ${token.symbol}: Confidence ${analysis.confidence}% < ${tradingParams.minAiConfidence}%`, 'info')
      return
    }

    const positionSize = Math.min(
      portfolio.balance * (tradingParams.positionSizePercent / 100),
      portfolio.balance * 0.1 // Max 10% per trade
    )

    if (positionSize < 0.01) {
      addLog('⚠️ Position size too small, skipping', 'info')
      return
    }

    // Validate token price
    if (!token.price || token.price <= 0) {
      addLog('⚠️ Invalid token price, skipping', 'error')
      return
    }

    const amount = positionSize / token.price
    
    // Format amount display
    const formatAmount = (amt: number) => {
      if (amt >= 1000000) return (amt / 1000000).toFixed(2) + 'M'
      if (amt >= 1000) return (amt / 1000).toFixed(2) + 'K'
      return amt.toFixed(2)
    }

    const position: Position = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      symbol: token.symbol,
      name: token.name,
      mint: token.mint,
      entryPrice: token.price,
      currentPrice: token.price,
      amount,
      valueSOL: positionSize,
      // Stop Loss: price below entry (use higher value for tighter stop)
      stopLoss: token.price * (1 - tradingParams.stopLossPercent / 100),
      // Take Profit: price above entry (use lower value for easier target)
      takeProfit: token.price * (1 + tradingParams.takeProfitPercent / 100),
      entryTime: Date.now(),
      pnl: 0,
      pnlPercent: 0,
      aiConfidence: analysis.confidence,
      aiReasoning: analysis.reasoning
    }

    console.log(`[NEW POSITION] ${token.symbol}: Entry=${token.price.toFixed(8)}, SL=${position.stopLoss.toFixed(8)} (-${tradingParams.stopLossPercent}%), TP=${position.takeProfit.toFixed(8)} (+${tradingParams.takeProfitPercent}%)`)

    // Record to learning service
    const tradeId = await recordTradeToLearning(position, token)
    position.tradeId = tradeId || undefined

    setPortfolio(prev => ({
      ...prev,
      balance: prev.balance - positionSize,
      openPositions: [...prev.openPositions, position],
      totalTrades: prev.totalTrades + 1,
      aiTrades: prev.aiTrades + 1
    }))

    addLog(`🤖 AI BUY ${token.symbol}: ${formatAmount(amount)} tokens @ $${token.price.toFixed(8)} | Size: ${positionSize.toFixed(3)} SOL | AI: ${analysis.confidence}%`, 'success')
    addLog(`📊 SL: $${position.stopLoss.toFixed(8)} | TP: $${position.takeProfit.toFixed(8)}`, 'info')
    
  }, [portfolio, tradingParams, analyzeTokenWithAI, recordTradeToLearning, addLog])

  // Update prices and check SL/TP - uses refs for always-current values
  const updatePrices = useCallback(() => {
    const currentPortfolio = portfolioRef.current
    const currentParams = tradingParamsRef.current
    
    console.log(`[updatePrices] Called, open positions: ${currentPortfolio.openPositions.length}`)
    
    if (currentPortfolio.openPositions.length === 0) return

    // Log that we're updating prices
    addLog(`⏱️ Checking ${currentPortfolio.openPositions.length} position(s)...`, 'info')

    const priceUpdates: Record<string, number> = {}
    
    for (const pos of currentPortfolio.openPositions) {
      try {
        // Simple but effective simulation:
        // Each update moves price by volatility% in random direction
        
        const volatility = currentParams.priceVolatility / 100
        const movementMultiplier = 1 + (Math.random() - 0.5) * volatility
        
        // Use current price and apply movement
        let newPrice = pos.currentPrice * movementMultiplier
        
        // Add extra movement for older positions (more likely to hit SL/TP)
        const ageSeconds = (Date.now() - pos.entryTime) / 1000
        if (ageSeconds > 10) {
          // After 10 seconds, add extra random push
          const extraPush = (Math.random() > 0.5 ? 1 : -1) * volatility * 0.5
          newPrice = newPrice * (1 + extraPush)
        }
        
        // Hard cap: force close after 30 seconds if not closed (reduced from 60)
        if (ageSeconds > 30) {
          // Force the price to hit either SL or TP
          if (Math.random() > 0.5) {
            newPrice = pos.stopLoss * 0.99 // Hit SL
            addLog(`⚡ FORCE CLOSE ${pos.symbol} → SL after 30s`, 'error')
          } else {
            newPrice = pos.takeProfit * 1.01 // Hit TP
            addLog(`⚡ FORCE CLOSE ${pos.symbol} → TP after 30s`, 'success')
          }
        }
        
        priceUpdates[pos.id] = newPrice
        
      } catch (error) {
        console.error(`Price error for ${pos.symbol}:`, error)
        priceUpdates[pos.id] = pos.currentPrice * 0.98
      }
    }
    
    // Now update all positions at once
    const closedTrades: { 
      symbol: string; 
      isWin: boolean; 
      pnlPercent: number; 
      pnl: number;
      tradeId?: string;
    }[] = []
    
    setPortfolio(prev => {
      let newBalance = prev.balance
      const stillOpen: Position[] = []
      const newlyClosed: any[] = [...prev.closedPositions]
      let newWins = prev.winCount
      let newLosses = prev.lossCount
      let newAiWins = prev.aiWins
      let newAiLosses = prev.aiLosses

      for (const p of prev.openPositions) {
        const newPrice = priceUpdates[p.id] || p.currentPrice
        const priceChange = (newPrice - p.entryPrice) / p.entryPrice
        const pnlPercent = priceChange
        const pnl = p.valueSOL * pnlPercent

        console.log(`[Price Check] ${p.symbol}: newPrice=${newPrice.toFixed(8)}, SL=${p.stopLoss.toFixed(8)}, TP=${p.takeProfit.toFixed(8)}, SL_hit=${newPrice <= p.stopLoss}, TP_hit=${newPrice >= p.takeProfit}`)

        // Check stop loss (price dropped below SL)
        if (newPrice <= p.stopLoss) {
          const exitValue = p.valueSOL + pnl
          newBalance += exitValue
          newlyClosed.push({ 
            ...p, 
            exitPrice: newPrice, 
            pnl, 
            pnlPercent, 
            exitReason: 'STOP_LOSS', 
            exitTime: Date.now() 
          })
          newLosses++
          newAiLosses++
          closedTrades.push({ 
            symbol: p.symbol, 
            isWin: false, 
            pnlPercent, 
            pnl,
            tradeId: p.tradeId 
          })
        } 
        // Check take profit (price rose above TP)
        else if (newPrice >= p.takeProfit) {
          const exitValue = p.valueSOL + pnl
          newBalance += exitValue
          newlyClosed.push({ 
            ...p, 
            exitPrice: newPrice, 
            pnl, 
            pnlPercent, 
            exitReason: 'TAKE_PROFIT', 
            exitTime: Date.now() 
          })
          newWins++
          newAiWins++
          closedTrades.push({ 
            symbol: p.symbol, 
            isWin: true, 
            pnlPercent, 
            pnl,
            tradeId: p.tradeId 
          })
        } 
        // Still open - update current price
        else {
          stillOpen.push({ ...p, currentPrice: newPrice, pnl, pnlPercent })
        }
      }

      // Calculate metrics
      const totalPnL = newBalance - prev.initialBalance
      const totalPnLPercent = (totalPnL / prev.initialBalance) * 100
      const winRate = (newWins + newLosses) > 0 ? newWins / (newWins + newLosses) : 0
      const aiWinRate = (newAiWins + newAiLosses) > 0 ? newAiWins / (newAiWins + newAiLosses) : 0

      // Track max drawdown
      const currentEquity = newBalance + stillOpen.reduce((sum, p) => sum + p.valueSOL + p.pnl, 0)
      
      const drawdown = ((equityPeakRef.current - currentEquity) / equityPeakRef.current) * 100

      return {
        ...prev,
        balance: newBalance,
        openPositions: stillOpen,
        closedPositions: newlyClosed,
        totalPnL,
        totalPnLPercent,
        winCount: newWins,
        lossCount: newLosses,
        winRate,
        maxDrawdown: Math.max(prev.maxDrawdown, Math.max(0, drawdown)),
        aiWins: newAiWins,
        aiLosses: newAiLosses,
        aiWinRate
      }
    })
    
    // Log closed trades and update learning service (OUTSIDE setPortfolio)
    for (const trade of closedTrades) {
      if (trade.isWin) {
        addLog(`🟢 TP HIT ${trade.symbol}: +${(trade.pnlPercent * 100).toFixed(2)}% (+${trade.pnl.toFixed(4)} SOL)`, 'success')
      } else {
        addLog(`🔴 SL HIT ${trade.symbol}: -${(Math.abs(trade.pnlPercent) * 100).toFixed(2)}% (-${Math.abs(trade.pnl).toFixed(4)} SOL)`, 'error')
      }
      
      // Update learning service after state update
      if (trade.tradeId) {
        updateTradeOutcomeInLearning(
          trade.tradeId, 
          trade.isWin ? 'WIN' : 'LOSS', 
          0, // exitPrice not needed for learning
          trade.pnlPercent
        )
      }
    }
  }, [addLog, updateTradeOutcomeInLearning])  // Only stable dependencies

  // Start trading
  const startTrading = useCallback(() => {
    if (isRunning) return
    
    setIsRunning(true)
    addLog('🤖 AI Paper Trading started - Real tokens from DexScreener', 'success')
    addLog('📊 Rule-based + AI hybrid analysis (rate limit protected)', 'info')
    addLog(`📈 Volatility: ${tradingParamsRef.current.priceVolatility}%, Force close after 30s`, 'info')

    // AI trading loop - 30% chance to analyze each interval
    tradingIntervalRef.current = setInterval(() => {
      if (Math.random() < 0.3) { // 30% chance to analyze
        openPositionWithAI()
      }
    }, tradingParamsRef.current.tradeIntervalSec * 1000)

    // Price update loop - every 2 seconds
    priceUpdateIntervalRef.current = setInterval(() => {
      updatePrices()
    }, 2000)

  }, [isRunning, openPositionWithAI, updatePrices, addLog])

  // Stop trading
  const stopTrading = useCallback(() => {
    setIsRunning(false)
    if (tradingIntervalRef.current) {
      clearInterval(tradingIntervalRef.current)
      tradingIntervalRef.current = null
    }
    if (priceUpdateIntervalRef.current) {
      clearInterval(priceUpdateIntervalRef.current)
      priceUpdateIntervalRef.current = null
    }
    addLog('⏸️ AI Paper Trading paused', 'info')
    
    // Fetch latest readiness
    fetchReadiness()
  }, [addLog, fetchReadiness])

  // Reset
  const resetTrading = useCallback(() => {
    stopTrading()
    initPaperTrading()
  }, [stopTrading, initPaperTrading])

  // Cleanup
  useEffect(() => {
    return () => {
      if (tradingIntervalRef.current) clearInterval(tradingIntervalRef.current)
      if (priceUpdateIntervalRef.current) clearInterval(priceUpdateIntervalRef.current)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchReadiness()
  }, [fetchReadiness])

  // Calculate grade
  const getGrade = useCallback(() => {
    if (portfolio.totalTrades < 3) return { grade: '-', color: 'bg-gray-500', score: 0 }
    
    const winRate = portfolio.winRate
    const aiWinRate = portfolio.aiWinRate
    const drawdown = portfolio.maxDrawdown
    const returnPct = portfolio.totalPnLPercent

    let score = 0

    // Win rate (25 points)
    if (winRate >= 0.65) score += 25
    else if (winRate >= 0.55) score += 20
    else if (winRate >= 0.50) score += 15
    else if (winRate >= 0.45) score += 10

    // AI win rate (25 points) - extra weight for AI performance
    if (aiWinRate >= 0.65) score += 25
    else if (aiWinRate >= 0.55) score += 20
    else if (aiWinRate >= 0.50) score += 15
    else if (aiWinRate >= 0.45) score += 10

    // Drawdown (25 points)
    if (drawdown <= 5) score += 25
    else if (drawdown <= 10) score += 20
    else if (drawdown <= 15) score += 15
    else if (drawdown <= 20) score += 10

    // Return (25 points)
    if (returnPct >= 10) score += 25
    else if (returnPct >= 5) score += 20
    else if (returnPct >= 0) score += 15
    else if (returnPct >= -5) score += 10

    if (score >= 80) return { grade: 'A', color: 'bg-green-500', score }
    if (score >= 60) return { grade: 'B', color: 'bg-blue-500', score }
    if (score >= 40) return { grade: 'C', color: 'bg-yellow-500', score }
    if (score >= 20) return { grade: 'D', color: 'bg-orange-500', score }
    return { grade: 'F', color: 'bg-red-500', score }
  }, [portfolio])

  const gradeInfo = getGrade()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900 text-white p-4 md:p-8">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/10 to-pink-500/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <Brain className="w-8 h-8" /> AI Paper Trading
              </h1>
              <p className="text-sm text-gray-500 mt-1">Real tokens • AI-powered decisions • Learning enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${
              aiAnalyzing ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 animate-pulse' :
              isRunning ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
              'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }`}>
              {aiAnalyzing ? '🧠 AI Thinking...' : isRunning ? 'Running' : 'Stopped'}
            </Badge>
            <Badge className={`${gradeInfo.color} text-white`}>
              Grade: {gradeInfo.grade} ({gradeInfo.score}/100)
            </Badge>
          </div>
        </div>

        {/* Learning Status Banner */}
        <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium">AI Learning System Active</div>
                  <div className="text-sm text-gray-400">
                    All trades are recorded and analyzed to improve AI decisions
                  </div>
                </div>
              </div>
              <Link href="/unified-trading">
                <Button variant="outline" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  View Learning Insights
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* AI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-purple-300 text-sm">
                <Brain className="w-4 h-4" /> AI Trades
              </div>
              <div className="text-2xl font-bold mt-1">{portfolio.aiTrades}</div>
              <div className="text-xs text-purple-400">AI decisions executed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border-cyan-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-cyan-300 text-sm">
                <Target className="w-4 h-4" /> AI Win Rate
              </div>
              <div className="text-2xl font-bold mt-1">{(portfolio.aiWinRate * 100).toFixed(1)}%</div>
              <Progress value={portfolio.aiWinRate * 100} className="mt-2 h-2" />
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border-emerald-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-emerald-300 text-sm">
                <TrendingUp className="w-4 h-4" /> Total P&L
              </div>
              <div className={`text-2xl font-bold mt-1 ${portfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolio.totalPnL >= 0 ? '+' : ''}{portfolio.totalPnL.toFixed(4)} SOL
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-300 text-sm">
                <Shield className="w-4 h-4" /> Max Drawdown
              </div>
              <div className="text-2xl font-bold mt-1 text-red-400">{portfolio.maxDrawdown.toFixed(2)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Control Panel */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Balance:</label>
                <Input
                  type="number"
                  value={initBalance}
                  onChange={(e) => setInitBalance(e.target.value)}
                  className="w-24 bg-gray-900 border-gray-600 h-9"
                  disabled={isRunning}
                />
                <span className="text-sm text-gray-400">SOL</span>
              </div>
              
              <div className="flex gap-2">
                {!isRunning ? (
                  <Button onClick={startTrading} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 gap-2">
                    <Play className="w-4 h-4" /> Start AI Trading
                  </Button>
                ) : (
                  <Button onClick={stopTrading} variant="destructive" className="gap-2">
                    <Pause className="w-4 h-4" /> Pause
                  </Button>
                )}
                <Button onClick={resetTrading} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Reset
                </Button>
                <Button 
                  onClick={() => setShowParams(!showParams)} 
                  variant="outline" 
                  className="gap-2"
                >
                  <Shield className="w-4 h-4" /> Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Panel */}
        {showParams && (
          <Card className="bg-gray-800/50 border-gray-700 border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                ⚙️ AI Trading Settings
              </CardTitle>
              <CardDescription>
                Configure AI behavior and risk management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Stop Loss (%)</label>
                  <Input
                    type="number"
                    value={tradingParams.stopLossPercent}
                    onChange={(e) => setTradingParams({...tradingParams, stopLossPercent: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Take Profit (%)</label>
                  <Input
                    type="number"
                    value={tradingParams.takeProfitPercent}
                    onChange={(e) => setTradingParams({...tradingParams, takeProfitPercent: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Position Size (%)</label>
                  <Input
                    type="number"
                    value={tradingParams.positionSizePercent}
                    onChange={(e) => setTradingParams({...tradingParams, positionSizePercent: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Max Positions</label>
                  <Input
                    type="number"
                    value={tradingParams.maxPositions}
                    onChange={(e) => setTradingParams({...tradingParams, maxPositions: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Trade Interval (sec)</label>
                  <Input
                    type="number"
                    value={tradingParams.tradeIntervalSec}
                    onChange={(e) => setTradingParams({...tradingParams, tradeIntervalSec: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Min AI Confidence (%)</label>
                  <Input
                    type="number"
                    value={tradingParams.minAiConfidence}
                    onChange={(e) => setTradingParams({...tradingParams, minAiConfidence: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Price Volatility (%)</label>
                  <Input
                    type="number"
                    value={tradingParams.priceVolatility}
                    onChange={(e) => setTradingParams({...tradingParams, priceVolatility: Number(e.target.value)})}
                    className="bg-gray-900 border-gray-600 mt-1"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">Higher = faster SL/TP hits</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg">
                <p className="text-xs text-yellow-400">
                  💡 <strong>Tip:</strong> Increase Volatility to 10-15% for faster position closes during paper trading testing.
                  Lower Stop Loss % = tighter stops (more losses but closer to real trading).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 border border-gray-700">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="positions">Positions ({portfolio.openPositions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Open Positions */}
            {portfolio.openPositions.length > 0 && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle>Active Positions ({portfolio.openPositions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.openPositions.map(pos => {
                      // Format amount for display
                      const formatAmount = (amt: number) => {
                        if (amt >= 1000000) return (amt / 1000000).toFixed(2) + 'M'
                        if (amt >= 1000) return (amt / 1000).toFixed(2) + 'K'
                        if (amt >= 1) return amt.toFixed(2)
                        return amt.toFixed(4)
                      }
                      
                      return (
                      <div key={pos.id} className="p-3 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{pos.symbol}</span>
                            <Badge className="ml-2 bg-purple-500/20 text-purple-300 text-xs">
                              AI: {pos.aiConfidence}%
                            </Badge>
                          </div>
                          <div className={pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(4)} SOL
                            <span className="text-xs">({pos.pnlPercent >= 0 ? '+' : ''}{(pos.pnlPercent * 100).toFixed(2)}%)</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Entry: ${pos.entryPrice.toFixed(8)} | SL: {pos.stopLoss.toFixed(8)} | TP: {pos.takeProfit.toFixed(8)}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-cyan-400">
                            📦 {formatAmount(pos.amount)} tokens | Size: {pos.valueSOL.toFixed(3)} SOL
                          </div>
                          <div className="text-xs text-gray-400">
                            Current: ${pos.currentPrice.toFixed(8)}
                          </div>
                        </div>
                        <div className="text-xs text-purple-400 mt-1">
                          💡 {pos.aiReasoning}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Log */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5" /> AI Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-gray-500 text-sm">Click "Start AI Trading" to begin...</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={`text-sm py-1 px-2 rounded ${
                        log.type === 'success' ? 'text-green-400 bg-green-500/10' :
                        log.type === 'error' ? 'text-red-400 bg-red-500/10' :
                        log.type === 'ai' ? 'text-purple-400 bg-purple-500/10' :
                        log.type === 'learning' ? 'text-blue-400 bg-blue-500/10' :
                        'text-gray-300 bg-gray-500/10'
                      }`}>
                        <span className="text-gray-500 text-xs mr-2">
                          {new Date(log.time).toLocaleTimeString()}
                        </span>
                        {log.message}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="space-y-4 mt-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>Closed Trades ({portfolio.closedPositions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {portfolio.closedPositions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No closed trades yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {portfolio.closedPositions.slice(-20).reverse().map((pos: any) => (
                      <div key={pos.id} className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                        <div>
                          <span className="font-medium">{pos.symbol}</span>
                          <Badge className={`ml-2 text-xs ${pos.exitReason === 'TAKE_PROFIT' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {pos.exitReason}
                          </Badge>
                          <div className="text-xs text-purple-400">AI Confidence: {pos.aiConfidence}%</div>
                        </div>
                        <div className={`font-medium ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(4)} SOL
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Strategy Readiness */}
        {strategyReadiness && (
          <Card className={`bg-gray-800/50 border-gray-700 ${
            strategyReadiness.isReadyForReal ? 'border-l-4 border-l-green-500' : ''
          }`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    strategyReadiness.isReadyForReal ? 'bg-green-500/20' : 'bg-gray-500/20'
                  }`}>
                    <span className="text-xl font-bold">{strategyReadiness.grade}</span>
                  </div>
                  <div>
                    <div className="font-medium">Strategy Readiness</div>
                    <div className="text-sm text-gray-400">
                      {strategyReadiness.isReadyForReal 
                        ? 'Ready for real trading!' 
                        : `Grade ${strategyReadiness.grade} - Need A or B for real trading`}
                    </div>
                  </div>
                </div>
                <Link href="/unified-trading">
                  <Button variant="outline" className="gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Apply to Real Trading
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer */}
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-400">AI Paper Trading with Learning</p>
                <p className="text-gray-400 mt-1">
                  This uses real token prices from DexScreener and AI analysis for trading decisions.
                  All trades are recorded to the learning service to improve future AI decisions.
                  Get Grade A or B before applying to real trading.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
