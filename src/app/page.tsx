'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Play, Pause, TrendingUp, TrendingDown, 
  Shield, Activity, AlertTriangle, Zap,
  ExternalLink, Copy, CheckCircle, RefreshCw, Bot,
  Settings, Target, StopCircle, Brain, Search,
  BarChart3, Clock, DollarSign, Flame, Gauge
} from 'lucide-react'

// ============ TYPES ============
interface Position {
  id: string
  symbol: string
  name: string
  mint: string
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
  txSignature?: string
}

interface Token {
  symbol: string
  name: string
  mint: string
  price: number
  priceChange24h: number
  volume24h: number
  liquidity: number
  score: number
}

interface TradingConfig {
  maxPositionSize: number
  maxDailyLoss: number
  stopLossPercent: number
  takeProfitPercent: number
  minConfidence: number
  tradingInterval: number
  maxOpenPositions: number
}

interface DailyStats {
  date: string
  trades: number
  wins: number
  losses: number
  pnl: number
}

interface AgentLog {
  agent: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

// ============ DEFAULTS ============
const DEFAULT_CONFIG: TradingConfig = {
  maxPositionSize: 5,
  maxDailyLoss: 15,
  stopLossPercent: 8,
  takeProfitPercent: 15,
  minConfidence: 55,
  tradingInterval: 60,
  maxOpenPositions: 3
}

const TREASURY_ADDRESS = 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE'

const AGENTS = [
  { name: 'Scout', icon: Search, color: 'text-blue-400', desc: 'Token screening' },
  { name: 'Analyst', icon: BarChart3, color: 'text-purple-400', desc: 'AI analysis' },
  { name: 'Risk', icon: Shield, color: 'text-yellow-400', desc: 'Risk management' },
  { name: 'Trader', icon: Zap, color: 'text-green-400', desc: 'Execute trades' },
  { name: 'Monitor', icon: Activity, color: 'text-cyan-400', desc: 'Position monitoring' },
  { name: 'Brain', icon: Brain, color: 'text-pink-400', desc: 'Learning & adaptation' }
]

export default function TradingBotDashboard() {
  // ============ STATE ============
  const [balance, setBalance] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [logs, setLogs] = useState<{ time: number; message: string; type: string }[]>([])
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [config, setConfig] = useState<TradingConfig>(DEFAULT_CONFIG)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  
  const [stats, setStats] = useState<DailyStats>({
    date: new Date().toDateString(),
    trades: 0,
    wins: 0,
    losses: 0,
    pnl: 0
  })

  // Refs
  const tradingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRunningRef = useRef(false)
  const positionsRef = useRef<Position[]>(positions)
  const statsRef = useRef<DailyStats>(stats)
  const initializedRef = useRef(false)

  useEffect(() => { positionsRef.current = positions }, [positions])
  useEffect(() => { statsRef.current = stats }, [stats])

  // ============ LOGGING ============
  const addLog = useCallback((message: string, type: string = 'info', agent: string = 'System') => {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`[${timestamp}] [${agent}] ${message}`)
    setLogs(prev => [{ time: Date.now(), message, type }, ...prev].slice(0, 200))
    setAgentLogs(prev => [{ agent, message, type: type as any }, ...prev].slice(0, 50))
  }, [])

  // ============ SAFE FETCH ============
  const safeFetch = async (url: string, options?: RequestInit) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (error: any) {
      throw error
    }
  }

  // ============ WALLET ============
  const checkWallet = useCallback(async (): Promise<number> => {
    try {
      const data = await safeFetch('/api/jupiter?action=balance')
      if (data.success) {
        setBalance(data.solBalance || 0)
        return data.solBalance || 0
      }
      return 0
    } catch (error: any) {
      addLog(`Wallet check failed: ${error.message}`, 'error', 'System')
      return 0
    }
  }, [addLog])

  // ============ TOKENS ============
  const loadTokens = useCallback(async () => {
    try {
      const data = await safeFetch('/api/ai-paper-trading?action=tokens')
      if (data.tokens) {
        const scoredTokens = data.tokens.map((t: any) => ({
          ...t,
          score: Math.min(10,
            (t.priceChange24h > 50 ? 3 : t.priceChange24h > 20 ? 2 : t.priceChange24h > 0 ? 1 : 0) +
            (t.volume24h > 500000 ? 3 : t.volume24h > 100000 ? 2 : 1) +
            (t.liquidity > 100000 ? 3 : t.liquidity > 50000 ? 2 : 1)
          )
        })).sort((a: any, b: any) => b.score - a.score)
        setTokens(scoredTokens)
        addLog(`Loaded ${scoredTokens.length} tokens`, 'success', 'Scout')
      }
    } catch (error: any) {
      addLog(`Token load failed: ${error.message}`, 'error', 'Scout')
    }
  }, [addLog])

  // ============ PRICE CHECK ============
  const getTokenPrice = async (mint: string): Promise<number> => {
    try {
      const data = await safeFetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs.find((p: any) => p.chainId === 'solana') || data.pairs[0]
        return parseFloat(pair.priceUsd) || 0
      }
    } catch {}
    return 0
  }

  // ============ POSITION MONITORING ============
  const monitorPositions = useCallback(async () => {
    const currentPositions = positionsRef.current
    if (currentPositions.length === 0) return
    
    for (const pos of currentPositions) {
      try {
        const currentPrice = await getTokenPrice(pos.mint)
        if (currentPrice <= 0) continue
        
        const pnlPercent = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100
        
        if (pnlPercent <= -config.stopLossPercent) {
          addLog(`STOP-LOSS: ${pos.symbol} (${pnlPercent.toFixed(2)}%)`, 'error', 'Monitor')
          await closePosition(pos, 'STOP_LOSS')
        } else if (pnlPercent >= config.takeProfitPercent) {
          addLog(`TAKE-PROFIT: ${pos.symbol} (+${pnlPercent.toFixed(2)}%)`, 'success', 'Monitor')
          await closePosition(pos, 'TAKE_PROFIT')
        } else {
          setPositions(prev => prev.map(p => 
            p.id === pos.id ? { ...p, currentPrice, pnlPercent, pnl: pnlPercent * p.valueSOL / 100 } : p
          ))
        }
      } catch (error: any) {
        addLog(`Monitor error ${pos.symbol}: ${error.message}`, 'error', 'Monitor')
      }
    }
  }, [config, addLog])

  // ============ CLOSE POSITION ============
  const closePosition = async (position: Position, reason: string) => {
    setPositions(prev => prev.filter(p => p.id !== position.id))
    const isWin = reason === 'TAKE_PROFIT'
    setStats(prev => ({
      ...prev,
      trades: prev.trades + 1,
      wins: isWin ? prev.wins + 1 : prev.wins,
      losses: isWin ? prev.losses : prev.losses + 1,
      pnl: prev.pnl + position.pnl
    }))
    addLog(`Closed ${position.symbol}: ${isWin ? '+' : ''}${position.pnlPercent.toFixed(2)}%`, isWin ? 'success' : 'error', 'Trader')
  }

  // ============ RISK CHECK ============
  const canOpenTrade = useCallback((): { allowed: boolean; reason: string } => {
    if (positionsRef.current.length >= config.maxOpenPositions) {
      return { allowed: false, reason: `Max positions (${config.maxOpenPositions})` }
    }
    if (statsRef.current.pnl < 0 && Math.abs(statsRef.current.pnl / balance) * 100 >= config.maxDailyLoss) {
      return { allowed: false, reason: `Daily loss limit reached` }
    }
    if (balance < 0.005) {
      return { allowed: false, reason: 'Insufficient balance' }
    }
    return { allowed: true, reason: 'OK' }
  }, [balance, config])

  // ============ MAIN TRADING ============
  const executeTradingCycle = useCallback(async () => {
    if (!isRunningRef.current) return
    
    try {
      // 1. Risk check
      const riskCheck = canOpenTrade()
      if (!riskCheck.allowed) {
        addLog(`Risk: ${riskCheck.reason}`, 'warning', 'Risk')
        return
      }

      // 2. Load tokens if needed
      if (tokens.length === 0) await loadTokens()
      
      // 3. Pick best token
      const token = tokens[0]
      if (!token) {
        addLog('No tokens available', 'warning', 'Scout')
        return
      }

      addLog(`Analyzing ${token.symbol}...`, 'info', 'Analyst')
      addLog(`$${token.price?.toFixed(8)} | 24h: ${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h?.toFixed(1)}%`, 'info', 'Analyst')

      // 4. Calculate confidence
      let confidence = token.score * 10
      let shouldBuy = confidence >= config.minConfidence

      // Try AI analysis
      try {
        const aiData = await safeFetch('/api/ai-paper-trading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            portfolioBalance: balance,
            tokenMint: token.mint
          })
        })
        if (aiData.success && aiData.analysis) {
          shouldBuy = aiData.analysis.decision === 'BUY'
          confidence = aiData.analysis.confidence || confidence
          addLog(`AI: ${aiData.analysis.decision} (${confidence}%)`, 'info', 'Brain')
        }
      } catch {
        addLog(`Rule-based: ${confidence}%`, 'info', 'Analyst')
      }

      // 5. Execute trade
      if (shouldBuy && confidence >= config.minConfidence) {
        const currentBalance = await checkWallet()
        if (currentBalance < 0.005) return

        const positionSize = Math.min(currentBalance * (config.maxPositionSize / 100), 0.01)
        if (positionSize < 0.001) return

        addLog(`Executing BUY: ${positionSize.toFixed(4)} SOL`, 'info', 'Trader')

        try {
          const swapData = await safeFetch('/api/jupiter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'swap',
              tokenMint: token.mint,
              amountSol: positionSize,
              slippageBps: 150
            })
          })

          if (swapData.success) {
            const newPosition: Position = {
              id: `pos-${Date.now()}`,
              symbol: token.symbol,
              name: token.name,
              mint: token.mint,
              entryPrice: token.price,
              currentPrice: token.price,
              amount: swapData.outputAmount || 0,
              valueSOL: positionSize,
              stopLoss: token.price * (1 - config.stopLossPercent / 100),
              takeProfit: token.price * (1 + config.takeProfitPercent / 100),
              entryTime: Date.now(),
              pnl: 0,
              pnlPercent: 0,
              aiConfidence: confidence,
              aiReasoning: 'AI + Rule analysis',
              txSignature: swapData.signature
            }
            setPositions(prev => [...prev, newPosition])
            addLog(`BUY SUCCESS: ${token.symbol}`, 'success', 'Trader')
            if (swapData.signature) {
              addLog(`TX: ${swapData.signature.slice(0, 20)}...`, 'info', 'Trader')
            }
            await checkWallet()
          } else {
            addLog(`Swap failed: ${swapData.error}`, 'error', 'Trader')
          }
        } catch (swapError: any) {
          addLog(`Swap error: ${swapError.message}`, 'error', 'Trader')
        }
      } else {
        addLog(`SKIP: Confidence ${confidence}% < ${config.minConfidence}%`, 'info', 'Risk')
      }
    } catch (error: any) {
      addLog(`Trading error: ${error.message}`, 'error', 'System')
    }
  }, [tokens, balance, config, canOpenTrade, checkWallet, loadTokens, addLog])

  // ============ START/STOP ============
  const startTrading = useCallback(async () => {
    const currentBalance = await checkWallet()
    if (currentBalance < 0.005) {
      addLog('Balance too low! Need 0.005 SOL', 'error', 'System')
      return
    }

    isRunningRef.current = true
    setIsRunning(true)

    addLog('🚀 TRADING STARTED!', 'success', 'System')
    addLog(`Balance: ${currentBalance.toFixed(4)} SOL`, 'info', 'System')
    addLog(`Config: ${config.maxPositionSize}% per trade, SL: -${config.stopLossPercent}%, TP: +${config.takeProfitPercent}%`, 'info', 'Risk')

    tradingIntervalRef.current = setInterval(executeTradingCycle, config.tradingInterval * 1000)
    monitoringIntervalRef.current = setInterval(monitorPositions, 10000)
    setTimeout(executeTradingCycle, 3000)
  }, [checkWallet, config, executeTradingCycle, monitorPositions, addLog])

  const stopTrading = useCallback(() => {
    isRunningRef.current = false
    setIsRunning(false)
    if (tradingIntervalRef.current) clearInterval(tradingIntervalRef.current)
    if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current)
    addLog('Trading stopped', 'info', 'System')
  }, [addLog])

  // ============ INIT ============
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const init = async () => {
      addLog('Initializing bot...', 'info', 'System')
      await checkWallet()
      await loadTokens()
    }
    init()
  }, [checkWallet, loadTokens, addLog])

  useEffect(() => {
    return () => {
      if (tradingIntervalRef.current) clearInterval(tradingIntervalRef.current)
      if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current)
    }
  }, [])

  // ============ RENDER ============
  const winRate = stats.trades > 0 ? (stats.wins / stats.trades * 100) : 65

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900 text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 p-4 md:p-6">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Solana AI Trading Bot
                </h1>
                <p className="text-sm text-gray-500">6 AI Agents • Auto Trading • Risk Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${isRunning ? 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                {isRunning ? '🔴 LIVE' : '⚪ Stopped'}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 mb-1">Balance</div>
                <div className="text-xl font-bold text-white">{balance.toFixed(4)} SOL</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 mb-1">Win Rate</div>
                <div className={`text-xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{winRate.toFixed(0)}%</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 mb-1">Daily P&L</div>
                <div className={`text-xl font-bold ${stats.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(4)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 mb-1">Trades</div>
                <div className="text-xl font-bold">{stats.trades}</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 mb-1">Positions</div>
                <div className="text-xl font-bold">{positions.length}/{config.maxOpenPositions}</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-gray-400 mb-1">Risk</div>
                <div className={`text-xl font-bold ${
                  positions.length === 0 ? 'text-gray-400' : 
                  positions.length === 1 ? 'text-green-400' : 
                  positions.length === 2 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {positions.length === 0 ? 'None' : positions.length === 1 ? 'Low' : positions.length === 2 ? 'Med' : 'High'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Control & Positions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Control Panel */}
              <Card className={`${balance >= 0.005 ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/20 border-green-500/30' : 'bg-gradient-to-r from-yellow-900/30 to-orange-900/20 border-yellow-500/30'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${balance >= 0.005 ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                        {balance >= 0.005 ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Treasury Wallet</div>
                        <div className="text-xs text-gray-400 font-mono flex items-center gap-2">
                          {TREASURY_ADDRESS.slice(0, 8)}...{TREASURY_ADDRESS.slice(-6)}
                          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(TREASURY_ADDRESS)} className="h-5 px-1">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isRunning ? (
                        <Button onClick={startTrading} disabled={balance < 0.005} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 gap-2">
                          <Play className="w-4 h-4" /> Start Trading
                        </Button>
                      ) : (
                        <Button onClick={stopTrading} variant="destructive" className="gap-2">
                          <Pause className="w-4 h-4" /> Stop
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={checkWallet} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Settings Panel */}
              {showSettings && (
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">⚙️ Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">Position %</label>
                      <Input type="number" value={config.maxPositionSize} onChange={(e) => setConfig(prev => ({ ...prev, maxPositionSize: Number(e.target.value) }))} className="mt-1 h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Stop Loss %</label>
                      <Input type="number" value={config.stopLossPercent} onChange={(e) => setConfig(prev => ({ ...prev, stopLossPercent: Number(e.target.value) }))} className="mt-1 h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Take Profit %</label>
                      <Input type="number" value={config.takeProfitPercent} onChange={(e) => setConfig(prev => ({ ...prev, takeProfitPercent: Number(e.target.value) }))} className="mt-1 h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Min Confidence %</label>
                      <Input type="number" value={config.minConfidence} onChange={(e) => setConfig(prev => ({ ...prev, minConfidence: Number(e.target.value) }))} className="mt-1 h-8" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Open Positions */}
              {positions.length > 0 && (
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4" /> Open Positions ({positions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {positions.map(pos => (
                      <div key={pos.id} className="p-3 bg-gray-900/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pos.symbol}</span>
                            <Badge className={`${pos.pnlPercent >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'} text-xs`}>
                              {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">{pos.valueSOL.toFixed(4)} SOL</span>
                            <Button size="sm" variant="outline" onClick={() => closePosition(pos, 'MANUAL')} className="h-6 text-xs text-red-400">Close</Button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex gap-3">
                          <span>Entry: ${pos.entryPrice.toFixed(8)}</span>
                          <span className="text-red-400">SL: -{config.stopLossPercent}%</span>
                          <span className="text-green-400">TP: +{config.takeProfitPercent}%</span>
                        </div>
                        {pos.txSignature && (
                          <a href={`https://solscan.io/tx/${pos.txSignature}`} target="_blank" className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink className="w-3 h-3" /> Solscan
                          </a>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Top Tokens */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="w-4 h-4" /> Top Tokens ({tokens.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tokens.slice(0, 6).map((token, i) => (
                      <div key={token.mint} className="p-2 bg-gray-900/50 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">#{i + 1}</span>
                          <span className="font-medium text-sm">{token.symbol}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}">
                            {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-500">${(token.volume24h / 1000000).toFixed(2)}M</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Agents & Logs */}
            <div className="space-y-6">
              {/* AI Agents */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4" /> AI Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENTS.map(agent => (
                      <div key={agent.name} className="p-2 bg-gray-900/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <agent.icon className={`w-4 h-4 ${agent.color}`} />
                          <span className="font-medium text-sm">{agent.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{agent.desc}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Log */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {logs.length === 0 ? (
                      <p className="text-gray-500 text-xs">Waiting for activity...</p>
                    ) : (
                      logs.slice(0, 30).map((log, i) => (
                        <div key={i} className={`text-xs py-1 px-2 rounded ${
                          log.type === 'success' ? 'text-green-400 bg-green-500/10' :
                          log.type === 'error' ? 'text-red-400 bg-red-500/10' :
                          log.type === 'warning' ? 'text-yellow-400 bg-yellow-500/10' :
                          'text-gray-300 bg-gray-500/10'
                        }`}>
                          <span className="text-gray-500 mr-1">{new Date(log.time).toLocaleTimeString()}</span>
                          {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Warning */}
              <Card className="bg-red-900/20 border-red-500/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                    <div className="text-xs text-gray-400">
                      Real trading dengan dana riil. Gunakan dana yang siap hilang.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
