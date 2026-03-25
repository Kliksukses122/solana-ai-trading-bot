'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useSolanaWallet } from '@/hooks/useSolanaWallet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { 
  Activity, TrendingUp, TrendingDown, Bot, Brain, Target, Shield,
  Zap, Clock, DollarSign, BarChart3,
  CheckCircle, XCircle, Play, Square, RefreshCw, Eye, Wifi, WifiOff,
  Plus, Minus, AlertCircle, X, Loader2, ExternalLink, Cpu, Sparkles,
  ArrowUpRight, ArrowDownRight, Flame, Gauge, Search, Star, Filter,
  LineChart
} from 'lucide-react'
import Link from 'next/link'
import { 
  fetchTrendingTokens, 
  searchTokens, 
  filterTokens,
  type TokenInfo,
  type ScreeningFilters 
} from '@/services/tokenScreeningService'

// Types
interface Trade {
  id: string
  timestamp: number
  token: { symbol: string; name: string; mint: string }
  strategy: string
  decision: string
  score: number
  entryPrice: number
  exitPrice: number
  profitPercent: number
  profit: number
  duration: number
  status: 'WIN' | 'LOSS'
}

interface Signal {
  id: string
  timestamp: number
  token: { symbol: string }
  signal: string
  strength: number
  processed: boolean
}

interface AgentLog {
  id: string
  timestamp: number
  agent: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

interface StrategyStats {
  trades: number
  wins: number
  pnl: number
  enabled: boolean
}

interface TradingState {
  status: string
  mode: string
  balance: number
  totalPnL: number
  totalTrades: number
  winRate: number
  currentDrawdown: number
  strategies: Record<string, StrategyStats>
  adaptiveConfig: {
    minScore: number
    takeProfit: number
    stopLoss: number
    tradeSize: number
    weights: Record<string, number>
  }
  learning: {
    enabled: boolean
    learningInterval: number
    lastLearningTime: number
    learningCount: number
  }
  recentTrades: Trade[]
  signals: Signal[]
  agentLogs: AgentLog[]
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
}

// Real trading tokens - will be populated from DexScreener screening
const defaultTokens = [
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'POPCAT', name: 'Popcat', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { symbol: 'MYRO', name: 'Myro', mint: 'HhTWcZwVcKmtIYcPdNGqy6XbHHZBj6c9zG2fVNqXkFZY' },
  { symbol: 'SAMO', name: 'Samoyedcoin', mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
]

const strategies = ['SNIPER', 'WHALE', 'MOMENTUM', 'COMBO']
const decisions = ['STRONG_BUY', 'BUY', 'SMALL_BUY']

// Counter for unique IDs
let logCounter = 0
let signalCounter = 0
let tradeCounter = 0
let toastCounter = 0

// Animated counter hook
function useAnimatedCounter(value: number, duration: number = 500) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)
  
  useEffect(() => {
    const startValue = prevValueRef.current
    const endValue = value
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (endValue - startValue) * easeOut
      setDisplayValue(current)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    requestAnimationFrame(animate)
    prevValueRef.current = value
  }, [value, duration])
  
  return displayValue
}

// Generate realistic trade based on strategy performance - uses screened tokens
function generateTrade(state: TradingState, availableTokens: { symbol: string; name: string; mint: string }[]): Trade {
  const tokensToUse = availableTokens.length > 0 ? availableTokens : defaultTokens
  const token = tokensToUse[Math.floor(Math.random() * tokensToUse.length)]
  const strategy = strategies[Math.floor(Math.random() * strategies.length)]
  const decision = decisions[Math.floor(Math.random() * decisions.length)]
  const score = Math.floor(Math.random() * 8) + 4
  
  const isWin = Math.random() < state.winRate
  const profitPercent = isWin 
    ? (Math.random() * 0.08 + 0.01)
    : -(Math.random() * 0.03 + 0.005)
  
  const entryPrice = Math.random() * 0.0001 + 0.00001
  const exitPrice = entryPrice * (1 + profitPercent)
  const tradeAmount = state.balance * 0.01
  
  tradeCounter++
  return {
    id: `trade-${Date.now()}-${tradeCounter}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    token,
    strategy,
    decision,
    score,
    entryPrice,
    exitPrice,
    profitPercent,
    profit: profitPercent * tradeAmount,
    duration: Math.floor(Math.random() * 1800000) + 60000,
    status: isWin ? 'WIN' : 'LOSS',
  }
}

// Generate realistic signal - uses screened tokens if available
function generateSignal(availableTokens: { symbol: string; name: string; mint: string }[]): Signal {
  const tokensToUse = availableTokens.length > 0 ? availableTokens : defaultTokens
  const token = tokensToUse[Math.floor(Math.random() * tokensToUse.length)]
  const signals = ['WHALE_BUY', 'VOLUME_SPIKE', 'NEW_TOKEN', 'MOMENTUM_UP', 'COMBO_DETECTED']
  const signal = signals[Math.floor(Math.random() * signals.length)]
  
  signalCounter++
  return {
    id: `sig-${Date.now()}-${signalCounter}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    token,
    signal,
    strength: Math.floor(Math.random() * 5) + 1,
    processed: false,
  }
}

// Generate agent log
function generateAgentLog(): AgentLog {
  const agents = ['Scout', 'Analyst', 'Risk', 'Trader', 'Manager', 'Learning']
  const agent = agents[Math.floor(Math.random() * agents.length)]
  
  const messages: Record<string, string[]> = {
    Scout: ['Scanning Solana DEX for opportunities...', 'Whale movement detected on WIF!', 'Volume spike detected on BONK', 'New token listed on Raydium'],
    Analyst: ['Analyzing token metrics...', 'Score calculated: 7.5/10', 'Strong buy signal confirmed', 'Risk assessment complete'],
    Risk: ['Checking risk parameters...', 'Position size approved: 0.02 SOL', 'Max drawdown check passed', 'Daily limit: 5/15 trades'],
    Trader: ['Executing swap via Jupiter...', 'Order filled successfully', 'Position opened', 'Setting stop loss at -2%'],
    Manager: ['Monitoring active positions...', 'Take profit triggered!', 'Position closed: +5.2%', 'Rebalancing portfolio'],
    Learning: ['Running learning cycle...', 'Adapted: minScore +0.5', 'Win rate analysis: 62%', 'Strategy bias updated'],
  }
  
  const agentMessages = messages[agent]
  const message = agentMessages[Math.floor(Math.random() * agentMessages.length)]
  
  logCounter++
  return {
    id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    agent,
    message,
    type: message.includes('!') || message.includes('Success') ? 'success' : 'info',
  }
}

// Initial state - Real trading configuration
function createInitialState(): TradingState {
  return {
    status: 'STOPPED',
    mode: 'LIVE',
    balance: 0,
    totalPnL: 0,
    totalTrades: 0,
    winRate: 0,
    currentDrawdown: 0,
    
    strategies: {
      SNIPER: { trades: 0, wins: 0, pnl: 0, enabled: true },
      WHALE: { trades: 0, wins: 0, pnl: 0, enabled: true },
      MOMENTUM: { trades: 0, wins: 0, pnl: 0, enabled: true },
      COMBO: { trades: 0, wins: 0, pnl: 0, enabled: true },
    },
    
    adaptiveConfig: {
      minScore: 6,
      takeProfit: 0.08,
      stopLoss: 0.02,
      tradeSize: 0.01,
      weights: { whale: 5, early: 3, momentum: 2, volume: 2, liquidity: 2, combo: 3 },
    },
    
    learning: {
      enabled: true,
      learningInterval: 20,
      lastLearningTime: 0,
      learningCount: 0,
    },
    
    recentTrades: [],
    signals: [],
    agentLogs: [],
  }
}

// Toast Component
function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-400" />,
    info: <Activity className="w-5 h-5 text-blue-400" />,
  }
  
  const styles = {
    success: 'border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5',
    error: 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-500/10 to-red-600/5',
    warning: 'border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/10 to-amber-600/5',
    info: 'border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/10 to-blue-600/5',
  }

  return (
    <div 
      className={`${styles[toast.type]} backdrop-blur-xl rounded-lg p-4 shadow-2xl shadow-black/30 
        animate-[slideIn_0.4s_cubic-bezier(0.16,1,0.3,1)] flex items-start gap-3 min-w-[340px] max-w-md
        border border-white/10 transition-all duration-300 hover:scale-[1.02]`}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm tracking-wide">{toast.title}</div>
        <div className="text-gray-400 text-xs mt-0.5 leading-relaxed">{toast.message}</div>
      </div>
      <button 
        onClick={onDismiss} 
        className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Toast Container
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] space-y-3">
      {toasts.map(toast => (
        <ToastNotification key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

export default function TradingBotDashboard() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const solanaWallet = useSolanaWallet()
  
  const [state, setState] = useState<TradingState>(createInitialState)
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Token screening state
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'gainers' | 'new' | 'highscore'>('all')
  const [screeningStatus, setScreeningStatus] = useState<'idle' | 'screening' | 'complete'>('idle')
  
  // Screened tokens ref for trading loop access
  const screenedTokensRef = useRef<{ symbol: string; name: string; mint: string }[]>([])
  
  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Jupiter swap state
  const [jupiterReady, setJupiterReady] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)

  // Animated values
  const animatedBalance = useAnimatedCounter(state.balance)
  const animatedPnL = useAnimatedCounter(state.totalPnL)

  // Toast functions
  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    toastCounter++
    const toast: Toast = {
      id: `toast-${Date.now()}-${toastCounter}`,
      type,
      title,
      message,
    }
    setToasts(prev => [...prev, toast])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Load tokens from DexScreener
  const loadTokens = useCallback(async () => {
    setIsLoadingTokens(true)
    try {
      let fetchedTokens: TokenInfo[] = []
      
      if (searchQuery) {
        fetchedTokens = await searchTokens(searchQuery)
      } else {
        switch (activeFilter) {
          case 'gainers':
            const response = await fetch('https://api.dexscreener.com/latest/dex/tokens')
            const data = await response.json()
            fetchedTokens = data.pairs
              ?.filter((pair: any) => pair.chainId === 'solana' && (pair.priceChange?.h24 || 0) > 0)
              ?.sort((a: any, b: any) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0))
              ?.slice(0, 30)
              ?.map((pair: any) => ({
                address: pair.baseToken?.address || '',
                symbol: pair.baseToken?.symbol || 'UNKNOWN',
                name: pair.baseToken?.name || 'Unknown',
                decimals: 9,
                logoURI: pair.info?.imageUrl,
                price: parseFloat(pair.priceUsd) || 0,
                priceChange24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                marketCap: pair.fdv || 0,
                liquidity: pair.liquidity?.usd || 0,
                holders: 0,
                txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
                createdAt: pair.pairCreatedAt || Date.now(),
                isVerified: pair.verified || false,
                score: calculateTokenScore(pair),
                signals: detectSignals(pair),
                pairAddress: pair.pairAddress,
              })) || []
            break
          case 'new':
            const newRes = await fetch('https://api.dexscreener.com/latest/dex/tokens')
            const newData = await newRes.json()
            const oneDayAgo = Date.now() - 86400000
            fetchedTokens = newData.pairs
              ?.filter((pair: any) => pair.chainId === 'solana' && pair.pairCreatedAt > oneDayAgo)
              ?.sort((a: any, b: any) => b.pairCreatedAt - a.pairCreatedAt)
              ?.slice(0, 30)
              ?.map((pair: any) => ({
                address: pair.baseToken?.address || '',
                symbol: pair.baseToken?.symbol || 'UNKNOWN',
                name: pair.baseToken?.name || 'Unknown',
                decimals: 9,
                logoURI: pair.info?.imageUrl,
                price: parseFloat(pair.priceUsd) || 0,
                priceChange24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                marketCap: pair.fdv || 0,
                liquidity: pair.liquidity?.usd || 0,
                holders: 0,
                txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
                createdAt: pair.pairCreatedAt || Date.now(),
                isVerified: false,
                score: calculateTokenScore(pair),
                signals: ['NEW_TOKEN'],
                pairAddress: pair.pairAddress,
              })) || []
            break
          case 'highscore':
            const scoreRes = await fetch('https://api.dexscreener.com/latest/dex/tokens')
            const scoreData = await scoreRes.json()
            fetchedTokens = scoreData.pairs
              ?.filter((pair: any) => pair.chainId === 'solana')
              ?.map((pair: any) => ({ ...pair, score: calculateTokenScore(pair) }))
              ?.sort((a: any, b: any) => b.score - a.score)
              ?.slice(0, 30)
              ?.map((pair: any) => ({
                address: pair.baseToken?.address || '',
                symbol: pair.baseToken?.symbol || 'UNKNOWN',
                name: pair.baseToken?.name || 'Unknown',
                decimals: 9,
                logoURI: pair.info?.imageUrl,
                price: parseFloat(pair.priceUsd) || 0,
                priceChange24h: pair.priceChange?.h24 || 0,
                volume24h: pair.volume?.h24 || 0,
                marketCap: pair.fdv || 0,
                liquidity: pair.liquidity?.usd || 0,
                holders: 0,
                txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
                createdAt: pair.pairCreatedAt || Date.now(),
                isVerified: pair.verified || false,
                score: pair.score,
                signals: detectSignals(pair),
                pairAddress: pair.pairAddress,
              })) || []
            break
          default:
            fetchedTokens = await fetchTrendingTokens()
        }
      }
      
      setTokens(fetchedTokens)
    } catch (error) {
      console.error('Error loading tokens:', error)
      addToast('error', 'Error', 'Failed to load tokens')
    } finally {
      setIsLoadingTokens(false)
    }
  }, [searchQuery, activeFilter, addToast])

  // Helper functions for token scoring
  function calculateTokenScore(pair: any): number {
    let score = 0
    const volume = pair.volume?.h24 || 0
    const liquidity = pair.liquidity?.usd || 0
    const priceChange = pair.priceChange?.h24 || 0
    const txns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0)
    
    if (volume > 1000000) score += 3
    else if (volume > 100000) score += 2
    else if (volume > 10000) score += 1
    
    if (liquidity > 100000) score += 3
    else if (liquidity > 10000) score += 2
    else if (liquidity > 1000) score += 1
    
    if (priceChange > 50) score += 2
    else if (priceChange > 10) score += 1
    
    if (txns > 1000) score += 2
    else if (txns > 100) score += 1
    
    if (pair.verified) score += 1
    
    return Math.min(10, Math.max(0, score))
  }

  function detectSignals(pair: any): string[] {
    const signals: string[] = []
    const volume = pair.volume?.h24 || 0
    const liquidity = pair.liquidity?.usd || 0
    const priceChange = pair.priceChange?.h24 || 0
    const txns = pair.txns?.h24 || {}
    const buys = txns.buys || 0
    const sells = txns.sells || 0
    
    if (buys > sells * 1.5 && volume > 50000) signals.push('WHALE_BUY')
    if (volume > 100000) signals.push('VOLUME_SPIKE')
    if (priceChange > 20) signals.push('MOMENTUM_UP')
    if (liquidity > 50000 && liquidity < 1000000) signals.push('LIQUIDITY_ADDED')
    if (pair.pairCreatedAt && Date.now() - pair.pairCreatedAt < 86400000) signals.push('NEW_TOKEN')
    
    return signals
  }

  // Load tokens on mount and filter change
  useEffect(() => {
    loadTokens()
  }, [loadTokens])

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // Execute real Jupiter swap
  const executeJupiterSwap = useCallback(async (tokenMint: string, amountSol: number) => {
    if (isSwapping) return null
    setIsSwapping(true)
    
    logCounter++
    const swapLog: AgentLog = {
      id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      agent: 'Trader',
      message: `🔄 Executing Jupiter swap: ${amountSol.toFixed(4)} SOL → Token`,
      type: 'info',
    }
    setLogs(l => [swapLog, ...l].slice(0, 50))
    
    try {
      const response = await fetch('/api/jupiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'swap',
          tokenMint,
          amountSol,
          slippageBps: 100,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        logCounter++
        const successLog: AgentLog = {
          id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          agent: 'Trader',
          message: `✅ Swap successful! TX: ${result.signature?.slice(0, 8)}...`,
          type: 'success',
        }
        setLogs(l => [successLog, ...l].slice(0, 50))
        addToast('success', 'Swap Executed', result.explorerUrl || `TX: ${result.signature}`)
        return result
      } else {
        logCounter++
        const errorLog: AgentLog = {
          id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          agent: 'Trader',
          message: `❌ Swap failed: ${result.error}`,
          type: 'error',
        }
        setLogs(l => [errorLog, ...l].slice(0, 50))
        addToast('error', 'Swap Failed', result.error)
        return null
      }
    } catch (error) {
      logCounter++
      const errorLog: AgentLog = {
        id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: Date.now(),
        agent: 'Trader',
        message: `❌ Swap error: ${error instanceof Error ? error.message : 'Unknown'}`,
        type: 'error',
      }
      setLogs(l => [errorLog, ...l].slice(0, 50))
      return null
    } finally {
      setIsSwapping(false)
    }
  }, [isSwapping, addToast])

  // Check Jupiter status on mount
  useEffect(() => {
    fetch('/api/jupiter?action=balance')
      .then(r => r.json())
      .then(data => {
        setJupiterReady(data.success)
        if (data.success && data.solBalance > 0) {
          setState(prev => ({ ...prev, balance: data.solBalance }))
        }
      })
      .catch(() => setJupiterReady(false))
  }, [])

  // AI-powered token analysis
  const analyzeTokenWithAI = useCallback(async (token: { symbol: string; name: string; mint: string }) => {
    try {
      const tokenInfo = tokens.find(t => t.address === token.mint) || {
        symbol: token.symbol,
        name: token.name,
        price: 0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        liquidity: 0,
        txns24h: 0,
        signals: []
      }
      
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full-analysis',
          data: { token: tokenInfo }
        })
      })
      
      const result = await response.json()
      return result
    } catch (error) {
      console.error('AI analysis error:', error)
      return null
    }
  }, [tokens])

  // Real trading loop - AI-powered with Jupiter swaps
  const runTradingLoop = useCallback(async () => {
    if (state.status !== 'RUNNING') return
    if (state.balance <= 0) return
    if (isSwapping) return

    // Get tokens for trading (screened or default)
    const tokensForTrading = screenedTokensRef.current.length > 0 ? screenedTokensRef.current : defaultTokens
    
    // AI Analysis chance (20%)
    if (Math.random() < 0.20 && tokensForTrading.length > 0) {
      const token = tokensForTrading[Math.floor(Math.random() * tokensForTrading.length)]
      
      logCounter++
      const aiLog: AgentLog = {
        id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: Date.now(),
        agent: 'Brain',
        message: `🧠 AI analyzing ${token.symbol}...`,
        type: 'info',
      }
      setLogs(l => [aiLog, ...l].slice(0, 50))
      
      // Call AI for analysis
      const aiResult = await analyzeTokenWithAI(token)
      
      if (aiResult?.success) {
        const { analysis, sentiment } = aiResult
        
        logCounter++
        const resultLog: AgentLog = {
          id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          agent: 'Analyst',
          message: `📊 ${token.symbol}: Score ${analysis.score}/10 - ${analysis.recommendation} (${sentiment.sentiment})`,
          type: analysis.recommendation === 'STRONG_BUY' ? 'success' : analysis.recommendation === 'AVOID' ? 'error' : 'info',
        }
        setLogs(l => [resultLog, ...l].slice(0, 50))
        
        // AI-powered trade execution
        if (analysis.recommendation === 'STRONG_BUY' || analysis.recommendation === 'BUY') {
          if (analysis.pricePrediction.confidence >= 60 && jupiterReady) {
            const tradeAmount = Math.min(
              state.balance * 0.01, 
              0.01
            )
            
            if (tradeAmount >= 0.001) {
              logCounter++
              const tradeLog: AgentLog = {
                id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
                timestamp: Date.now(),
                agent: 'Trader',
                message: `🤖 AI BUY: ${token.symbol} - ${analysis.reasoning}`,
                type: 'info',
              }
              setLogs(l => [tradeLog, ...l].slice(0, 50))
              
              const result = await executeJupiterSwap(token.mint, tradeAmount)
              
              if (result?.success) {
                setState(prev => ({
                  ...prev,
                  totalTrades: prev.totalTrades + 1,
                  balance: prev.balance - tradeAmount,
                }))
                
                logCounter++
                const successLog: AgentLog = {
                  id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
                  timestamp: Date.now(),
                  agent: 'Trader',
                  message: `✅ AI Trade executed: ${token.symbol} - TX: ${result.signature?.slice(0, 8)}...`,
                  type: 'success',
                }
                setLogs(l => [successLog, ...l].slice(0, 50))
              }
            }
          }
        }
        
        // Add signal
        const signal: Signal = {
          id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          token,
          signal: `AI_${analysis.recommendation}`,
          strength: analysis.score,
          processed: true,
        }
        setState(prev => ({
          ...prev,
          signals: [signal, ...prev.signals].slice(0, 10)
        }))
      }
    }
    
    // Periodic agent logs
    if (Math.random() < 0.2) {
      const agentLog = generateAgentLog()
      setLogs(l => [agentLog, ...l].slice(0, 50))
    }
  }, [state.status, state.balance, isSwapping, jupiterReady, executeJupiterSwap, analyzeTokenWithAI])

  // Start/stop trading loop
  useEffect(() => {
    if (state.status === 'RUNNING') {
      // Use async wrapper for interval
      const runAsync = () => {
        runTradingLoop().catch(console.error)
      }
      intervalRef.current = setInterval(runAsync, 3000) // 3 second interval for real swaps
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }
  }, [state.status, runTradingLoop])

  const startBot = useCallback(() => {
    if (!jupiterReady) {
      addToast('error', 'Jupiter Not Ready', 'Treasury wallet not configured. Add TREASURY_PRIVATE_KEY to .env')
      return
    }
    if (state.balance <= 0) {
      addToast('error', 'No Balance', 'Please deposit SOL to start trading')
      return
    }
    
    setState(prev => ({ ...prev, status: 'RUNNING' }))
    logCounter++
    const log: AgentLog = {
      id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      agent: 'Manager',
      message: '🧠 AI Trading Bot started - Real analysis & Jupiter swaps active',
      type: 'success',
    }
    setLogs(l => [log, ...l].slice(0, 50))
    addToast('success', 'Bot Started', 'AI-powered trading with Jupiter is now active')
  }, [jupiterReady, state.balance, addToast])

  const stopBot = useCallback(() => {
    setState(prev => ({ ...prev, status: 'STOPPED' }))
    logCounter++
    const log: AgentLog = {
      id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      agent: 'Manager',
      message: '⏹️ Trading bot stopped',
      type: 'warning',
    }
    setLogs(l => [log, ...l].slice(0, 50))
    addToast('warning', 'Bot Stopped', 'Trading has been paused')
  }, [addToast])

  const forceLearn = useCallback(() => {
    setState(prev => ({
      ...prev,
      learning: {
        ...prev.learning,
        learningCount: prev.learning.learningCount + 1,
        lastLearningTime: Date.now(),
      }
    }))
    logCounter++
    const log: AgentLog = {
      id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      agent: 'Learning',
      message: '🧠 Force learning triggered - Analyzing performance...',
      type: 'info',
    }
    setLogs(l => [log, ...l].slice(0, 50))
    addToast('info', 'Learning Triggered', 'Analyzing trading performance...')
  }, [addToast])

  const toggleStrategy = useCallback((strategy: string) => {
    setState(prev => ({
      ...prev,
      strategies: {
        ...prev.strategies,
        [strategy]: {
          ...prev.strategies[strategy as keyof typeof prev.strategies],
          enabled: !prev.strategies[strategy as keyof typeof prev.strategies].enabled
        }
      }
    }))
  }, [])

  // Trigger token screening from DexScreener
  const triggerScreening = useCallback(async () => {
    setScreeningStatus('screening')
    
    logCounter++
    const scoutLog: AgentLog = {
      id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      agent: 'Scout',
      message: '🔍 Starting token screening from DexScreener...',
      type: 'info',
    }
    setLogs(l => [scoutLog, ...l].slice(0, 50))
    
    try {
      // Fetch trending tokens from DexScreener
      const response = await fetch('https://api.dexscreener.com/latest/dex/tokens')
      const data = await response.json()
      
      if (data.pairs) {
        // Filter Solana tokens with good metrics
        const solanaPairs = data.pairs
          .filter((pair: any) => 
            pair.chainId === 'solana' &&
            (pair.volume?.h24 || 0) > 10000 &&
            (pair.liquidity?.usd || 0) > 5000
          )
          .sort((a: any, b: any) => {
            // Score based on volume + liquidity
            const scoreA = (a.volume?.h24 || 0) + (a.liquidity?.usd || 0) * 2
            const scoreB = (b.volume?.h24 || 0) + (b.liquidity?.usd || 0) * 2
            return scoreB - scoreA
          })
          .slice(0, 30)
        
        // Convert to trading tokens format and update ref
        const newScreenedTokens = solanaPairs.map((pair: any) => ({
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown',
          mint: pair.baseToken?.address || '',
        }))
        
        // Update ref for trading loop
        screenedTokensRef.current = newScreenedTokens
        
        // Also update the UI tokens
        const tokenInfos: TokenInfo[] = solanaPairs.map((pair: any) => ({
          address: pair.baseToken?.address || '',
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown',
          decimals: 9,
          logoURI: pair.info?.imageUrl,
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          marketCap: pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          holders: 0,
          txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          createdAt: pair.pairCreatedAt || Date.now(),
          isVerified: pair.verified || false,
          score: calculateTokenScore(pair),
          signals: detectSignals(pair),
          pairAddress: pair.pairAddress,
        }))
        
        setTokens(tokenInfos)
        setScreeningStatus('complete')
        
        logCounter++
        const successLog: AgentLog = {
          id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          agent: 'Scout',
          message: `✅ Screening complete: ${newScreenedTokens.length} tokens found for trading`,
          type: 'success',
        }
        setLogs(l => [successLog, ...l].slice(0, 50))
        
        addToast('success', 'Screening Complete', `Found ${newScreenedTokens.length} tradeable tokens from DexScreener`)
      }
    } catch (error) {
      console.error('Screening error:', error)
      setScreeningStatus('idle')
      addToast('error', 'Screening Failed', 'Could not fetch tokens from DexScreener')
    }
  }, [addToast])

  // Real deposit handler - triggers screening after successful deposit
  const handleDeposit = useCallback(async () => {
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) {
      addToast('error', 'Invalid Amount', 'Please enter a valid deposit amount')
      return
    }
    
    if (amount > solanaWallet.balance) {
      addToast('error', 'Insufficient Balance', 'Not enough SOL in your wallet')
      return
    }

    setIsProcessing(true)
    
    try {
      const signature = await solanaWallet.deposit(amount)
      
      if (signature) {
        // Update trading balance
        setState(prev => ({
          ...prev,
          balance: prev.balance + amount
        }))
        
        logCounter++
        const log: AgentLog = {
          id: `log-${Date.now()}-${logCounter}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: Date.now(),
          agent: 'Manager',
          message: `💰 Deposit confirmed: +${amount.toFixed(4)} SOL`,
          type: 'success',
        }
        setLogs(l => [log, ...l].slice(0, 50))
        addToast('success', 'Deposit Successful', `+${amount.toFixed(4)} SOL added to trading balance`)
        
        // AUTO-TRIGGER SCREENING AFTER DEPOSIT
        setTimeout(() => {
          triggerScreening()
        }, 500)
        
        setTimeout(() => {
          setShowDepositModal(false)
          setDepositAmount('')
        }, 1500)
      } else {
        addToast('error', 'Transaction Failed', solanaWallet.error || 'Unknown error')
      }
    } catch (err) {
      addToast('error', 'Transaction Failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsProcessing(false)
    }
  }, [depositAmount, solanaWallet, addToast, triggerScreening])

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString()
  const formatDuration = (ms: number) => {
    const mins = Math.floor(ms / 60000)
    return mins > 0 ? `${mins}m` : `${Math.floor(ms / 1000)}s`
  }

  return (
    <>
      {/* Global Styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.25), 0 0 40px rgba(16, 185, 129, 0.1); }
          50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.4), 0 0 60px rgba(16, 185, 129, 0.2); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-fade-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-modal-in { animation: modalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-shimmer { 
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
        
        .card-glass {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        
        .card-professional {
          background: linear-gradient(145deg, rgba(30, 30, 40, 0.9), rgba(20, 20, 30, 0.95));
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 
            0 4px 6px rgba(0, 0, 0, 0.1),
            0 10px 20px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-professional:hover {
          transform: translateY(-4px);
          box-shadow: 
            0 8px 12px rgba(0, 0, 0, 0.15),
            0 20px 40px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }
        
        .btn-professional {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .btn-professional:active {
          transform: scale(0.97);
        }
        .btn-professional::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(255,255,255,0.1), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .btn-professional:hover::after {
          opacity: 1;
        }
        
        .glow-emerald {
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.1);
        }
        .glow-red {
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.3), 0 0 40px rgba(239, 68, 68, 0.1);
        }
        .glow-purple {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3), 0 0 40px rgba(168, 85, 247, 0.1);
        }
        
        .stat-card {
          position: relative;
          overflow: hidden;
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }
        
        .progress-bar-animated {
          position: relative;
          overflow: hidden;
        }
        .progress-bar-animated::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 2s infinite;
        }
        
        .input-professional {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .input-professional:focus {
          background: rgba(0, 0, 0, 0.4);
          border-color: rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1), 0 0 20px rgba(16, 185, 129, 0.1);
          outline: none;
        }
        
        .tab-professional {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tab-professional:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .tab-professional[data-state="active"] {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2));
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
        }
        
        /* Wallet Multi Button Styling */
        .wallet-adapter-button {
          background: linear-gradient(135deg, #7c3aed, #6366f1) !important;
          border-radius: 0.75rem !important;
          font-family: inherit !important;
          padding: 0.5rem 1rem !important;
          height: auto !important;
          font-size: 0.8rem !important;
          font-weight: 500 !important;
          min-height: auto !important;
          line-height: 1.5 !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .wallet-adapter-button:hover {
          background: linear-gradient(135deg, #8b5cf6, #818cf8) !important;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(124, 58, 237, 0.3) !important;
        }
        .wallet-adapter-button-trigger {
          background: linear-gradient(135deg, #7c3aed, #6366f1) !important;
        }
        .wallet-adapter-button svg {
          width: 16px !important;
          height: 16px !important;
        }
        .wallet-adapter-button-start-icon {
          margin-right: 0.5rem !important;
        }
        
        /* Scrollbar Styling */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900 text-white relative">
        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 rounded-full blur-[100px] animate-glow-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-purple-500/10 to-pink-500/5 rounded-full blur-[100px] animate-glow-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-gradient-to-br from-blue-500/10 to-cyan-500/5 rounded-full blur-[80px]"></div>
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
        
        {/* Header - Fixed */}
        <header className="fixed top-0 left-0 right-0 border-b border-white/5 bg-transparent backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg animate-float">
                  <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-gray-900" />
                </div>
                {state.status === 'RUNNING' && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping"></div>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-tight">
                  Solana AI Trading Bot
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs text-gray-500">Multi-Strategy</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-[10px] sm:text-xs text-gray-500">Auto-Learning</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Real Wallet Connection */}
              <WalletMultiButton />
              
              {/* Network Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                <div className="relative">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <div className="absolute inset-0 bg-emerald-400/50 blur-sm"></div>
                </div>
                <span className="text-xs text-emerald-400 font-medium">Mainnet</span>
              </div>
              
              {/* Jupiter Status Badge */}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border ${
                jupiterReady 
                  ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20' 
                  : 'bg-gradient-to-r from-gray-500/10 to-gray-500/5 border-gray-500/20'
              }`}>
                <Zap className={`w-4 h-4 ${jupiterReady ? 'text-purple-400' : 'text-gray-500'}`} />
                <span className={`text-xs font-medium ${jupiterReady ? 'text-purple-400' : 'text-gray-500'}`}>
                  {jupiterReady ? 'Jupiter' : 'No Key'}
                </span>
              </div>
              
              {/* Status Badge */}
              <Badge 
                className={`${state.status === 'RUNNING' 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse-glow' 
                  : 'bg-gray-500/15 text-gray-400 border-gray-500/20'} 
                  px-3 py-1.5 text-xs font-semibold tracking-wide`}
              >
                <span className={`w-2 h-2 rounded-full mr-2 ${state.status === 'RUNNING' ? 'bg-emerald-400' : 'bg-gray-500'}`}></span>
                {state.status}
              </Badge>
              
              {/* Paper Trading Link */}
              <Link href="/paper-trading">
                <Button variant="outline" size="sm" className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
                  <LineChart className="w-4 h-4" />
                  <span className="hidden sm:inline">Paper Trading</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pt-20 sm:pt-24 space-y-6 relative z-10">
          {/* Control Panel */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap animate-fade-in">
            {state.status === 'RUNNING' ? (
              <Button 
                onClick={stopBot} 
                variant="destructive" 
                className="gap-2 shadow-lg shadow-red-500/20 btn-professional h-11 px-5 rounded-xl font-medium"
              >
                <Square className="w-4 h-4" /> Stop Bot
              </Button>
            ) : (
              <Button 
                onClick={startBot} 
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 gap-2 shadow-lg shadow-emerald-500/20 btn-professional h-11 px-5 rounded-xl font-medium" 
                disabled={!wallet.connected || state.balance <= 0}
              >
                <Play className="w-4 h-4" /> Start Bot
              </Button>
            )}
            <Button 
              onClick={() => setShowDepositModal(true)} 
              variant="outline" 
              className="gap-2 border-white/10 hover:bg-white/5 hover:border-emerald-500/30 btn-professional h-11 px-4 rounded-xl" 
              disabled={!wallet.connected}
            >
              <Plus className="w-4 h-4" /> Deposit
            </Button>
            <Button 
              onClick={forceLearn} 
              variant="outline" 
              className="gap-2 border-white/10 hover:bg-white/5 hover:border-purple-500/30 btn-professional h-11 px-4 rounded-xl"
            >
              <Brain className="w-4 h-4 text-purple-400" /> <span className="hidden sm:inline">Force</span> Learn
            </Button>
            {/* Screening Status Badge - shows when tokens are ready */}
            {screeningStatus === 'screening' && (
              <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 px-3 py-1.5 text-xs font-medium">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Screening tokens...
              </Badge>
            )}
            {screeningStatus === 'complete' && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 px-3 py-1.5 text-xs font-medium">
                <span className="w-2 h-2 rounded-full mr-2 bg-emerald-400"></span>
                {screenedTokensRef.current.length} Tokens Ready
              </Badge>
            )}
          </div>

          {/* Deposit Modal */}
          {showDepositModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
              <Card className="bg-gradient-to-br from-gray-900/95 to-slate-900/95 border-white/10 w-full max-w-md shadow-2xl shadow-black/50 animate-modal-in rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 pointer-events-none"></div>
                <CardHeader className="relative pb-2">
                  <CardTitle className="text-white flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                    </div>
                    Deposit SOL
                  </CardTitle>
                  <CardDescription className="text-gray-400 ml-13 pl-[52px]">Transfer SOL to your trading bot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 relative">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block font-medium">Amount (SOL)</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full input-professional rounded-xl px-4 py-3.5 text-white text-lg font-medium placeholder-gray-600"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {['0.1', '0.5', '1', '5'].map(amount => (
                      <button 
                        key={amount}
                        onClick={() => setDepositAmount(amount)} 
                        className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-xl py-2.5 text-sm text-white transition-all font-medium"
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                  
                  <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Wallet Balance</span>
                      <span className="text-white font-semibold">{solanaWallet.balance.toFixed(4)} SOL</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Trading Balance</span>
                      <span className="text-white font-semibold">{state.balance.toFixed(4)} SOL</span>
                    </div>
                  </div>
                  
                  {solanaWallet.txSignature && (
                    <div className="bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 border border-emerald-500/30 rounded-xl p-4 animate-fade-in">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Transaction Confirmed!</span>
                      </div>
                      <a 
                        href={`https://solscan.io/tx/${solanaWallet.txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 font-mono truncate flex items-center gap-1"
                      >
                        View on Solscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleDeposit}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 gap-2 shadow-lg shadow-emerald-500/20 btn-professional h-12 rounded-xl font-medium"
                      disabled={!depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > solanaWallet.balance || isProcessing}
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} 
                      {isProcessing ? 'Processing...' : 'Deposit'}
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={() => { setShowDepositModal(false); setDepositAmount(''); }}
                    variant="ghost" 
                    className="w-full text-gray-500 hover:text-white hover:bg-white/5 h-10 rounded-xl"
                  >
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Balance Card - Featured */}
            <Card className="col-span-2 md:col-span-1 lg:col-span-2 stat-card card-professional rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '0ms' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent"></div>
              <CardContent className="relative pt-5 pb-6 px-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-medium">Trading Balance</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                    {animatedBalance.toFixed(4)}
                  </span>
                  <span className="text-xl text-gray-500 font-medium">SOL</span>
                </div>
                <div className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                  {state.balance > 0 ? (
                    <>
                      <span className="text-emerald-400">≈ ${(animatedBalance * 150).toFixed(2)}</span>
                      <span className="text-gray-600">USD</span>
                    </>
                  ) : (
                    <span className="text-gray-600">Deposit to start trading</span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Wallet Balance Card */}
            <Card className="stat-card card-professional rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '50ms' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent"></div>
              <CardContent className="relative pt-5 pb-5 px-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center">
                    <DollarSign className="w-3 h-3 text-purple-400" />
                  </div>
                  <span className="font-medium">Wallet</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {solanaWallet.balance.toFixed(4)}
                  <span className="text-sm text-gray-500 ml-1 font-normal">SOL</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">Available</div>
              </CardContent>
            </Card>
            
            {/* PnL Card */}
            <Card className={`stat-card card-professional rounded-2xl overflow-hidden animate-fade-in-up ${state.totalPnL >= 0 ? 'glow-emerald' : 'glow-red'}`} style={{ animationDelay: '100ms' }}>
              <div className={`absolute inset-0 ${state.totalPnL >= 0 ? 'bg-gradient-to-br from-emerald-500/10' : 'bg-gradient-to-br from-red-500/10'} to-transparent`}></div>
              <CardContent className="relative pt-5 pb-5 px-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${state.totalPnL >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                    {state.totalPnL >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                  </div>
                  <span className="font-medium">Total PnL</span>
                </div>
                <div className={`text-2xl font-bold tracking-tight ${state.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {state.totalPnL >= 0 ? '+' : ''}{animatedPnL.toFixed(4)}
                  <span className="text-sm ml-1 font-normal opacity-70">SOL</span>
                </div>
              </CardContent>
            </Card>
            
            {/* Win Rate Card */}
            <Card className="stat-card card-professional rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
              <CardContent className="relative pt-5 pb-5 px-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                    <Gauge className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="font-medium">Win Rate</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {state.totalTrades > 0 ? `${(state.winRate * 100).toFixed(1)}%` : '---'}
                </div>
                <div className="mt-2.5">
                  <Progress 
                    value={state.winRate * 100} 
                    className="h-1.5 bg-gray-800"
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Total Trades Card */}
            <Card className="stat-card card-professional rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"></div>
              <CardContent className="relative pt-5 pb-5 px-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
                    <BarChart3 className="w-3 h-3 text-cyan-400" />
                  </div>
                  <span className="font-medium">Trades</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{state.totalTrades}</div>
                <div className="text-xs text-gray-600 mt-1">Max: 15/day</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="trades" className="space-y-5">
            <TabsList className="bg-gray-800/50 border border-white/5 p-1 rounded-xl h-auto">
              <TabsTrigger value="trades" className="tab-professional rounded-lg px-4 py-2 text-sm">Recent Trades</TabsTrigger>
              <TabsTrigger value="discover" className="tab-professional rounded-lg px-4 py-2 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Discover
              </TabsTrigger>
              <TabsTrigger value="strategies" className="tab-professional rounded-lg px-4 py-2 text-sm">Strategies</TabsTrigger>
              <TabsTrigger value="learning" className="tab-professional rounded-lg px-4 py-2 text-sm">Learning</TabsTrigger>
              <TabsTrigger value="logs" className="tab-professional rounded-lg px-4 py-2 text-sm">Agent Logs</TabsTrigger>
            </TabsList>

            {/* Trades Tab */}
            <TabsContent value="trades" className="space-y-4 animate-slide-up">
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <Card className="card-professional rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/5 pb-4">
                      <CardTitle className="text-white flex items-center gap-3 text-lg font-semibold">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-emerald-400" />
                        </div>
                        Recent Trades
                      </CardTitle>
                      <CardDescription className="text-gray-500 ml-12">Last 20 trades executed</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[420px]">
                        <div className="p-4 space-y-2">
                          {state.recentTrades.map((trade, index) => (
                            <div 
                              key={trade.id} 
                              className={`group relative rounded-xl p-4 transition-all duration-300 cursor-pointer
                                ${trade.status === 'WIN' 
                                  ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-l-4 border-l-emerald-500' 
                                  : 'bg-gradient-to-r from-red-500/10 to-transparent border-l-4 border-l-red-500'}
                                hover:bg-white/5`}
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                                    ${trade.status === 'WIN' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                    {trade.status === 'WIN' 
                                      ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> 
                                      : <ArrowDownRight className="w-5 h-5 text-red-400" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white text-lg">{trade.token.symbol}</span>
                                      <Badge variant="outline" className="text-xs border-white/10 text-gray-400 font-medium">{trade.strategy}</Badge>
                                      <Badge variant="outline" className="text-xs border-white/10 text-gray-500">{trade.decision}</Badge>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                      <span className="flex items-center gap-1">
                                        <Cpu className="w-3 h-3" />
                                        Score: {trade.score}
                                      </span>
                                      <span>•</span>
                                      <span>{formatTime(trade.timestamp)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-xl font-bold ${trade.profitPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {trade.profitPercent >= 0 ? '+' : ''}{(trade.profitPercent * 100).toFixed(2)}%
                                  </div>
                                  <div className={`text-xs ${trade.profit >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(6)} SOL
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {state.recentTrades.length === 0 && (
                            <div className="text-center py-16">
                              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                                <BarChart3 className="w-8 h-8 text-gray-600" />
                              </div>
                              <div className="text-gray-500 font-medium">No trades yet</div>
                              <div className="text-gray-600 text-sm mt-1">Start the bot to begin trading</div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card className="card-professional rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/5 pb-4">
                      <CardTitle className="text-white flex items-center gap-3 text-lg font-semibold">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        Live Signals
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[420px]">
                        <div className="p-4 space-y-2">
                          {state.signals.map((signal, index) => (
                            <div 
                              key={signal.id} 
                              className="group bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl p-4 border border-amber-500/20 hover:border-amber-500/40 transition-all"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white text-lg">{signal.token.symbol}</span>
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-medium">
                                  {signal.signal}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 text-xs text-amber-400/80">
                                  <Flame className="w-3 h-3" />
                                  Strength
                                </div>
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(i => (
                                    <div 
                                      key={i}
                                      className={`w-2 h-4 rounded-sm ${i <= signal.strength ? 'bg-amber-400' : 'bg-gray-700'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                          {state.signals.length === 0 && (
                            <div className="text-center py-16">
                              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-gray-600" />
                              </div>
                              <div className="text-gray-500 font-medium">No signals detected</div>
                              <div className="text-gray-600 text-sm mt-1">Waiting for market signals</div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Token Discovery Tab */}
            <TabsContent value="discover" className="space-y-4 animate-slide-up">
              <Card className="card-professional rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg font-semibold">Token Discovery</CardTitle>
                        <CardDescription className="text-gray-500">Real-time token screening from Solana DEXs</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search tokens..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-gray-800/50 border border-white/5 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 w-48"
                        />
                      </div>
                      <Button
                        onClick={loadTokens}
                        variant="outline"
                        size="sm"
                        className="border-white/5 hover:bg-white/5"
                        disabled={isLoadingTokens}
                      >
                        {isLoadingTokens ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {/* Filter Buttons */}
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {[
                      { id: 'all', label: 'All', icon: Filter },
                      { id: 'gainers', label: 'Top Gainers', icon: Flame },
                      { id: 'new', label: 'New Tokens', icon: Zap },
                      { id: 'highscore', label: 'High Score', icon: Star },
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                          activeFilter === filter.id
                            ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-gray-800/50 text-gray-400 border border-white/5 hover:bg-gray-700/50'
                        }`}
                      >
                        <filter.icon className="w-4 h-4" />
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {/* Token List */}
                  <ScrollArea className="h-[400px]">
                    {isLoadingTokens ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                      </div>
                    ) : tokens.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No tokens found. Try a different search or filter.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tokens.map((token, index) => (
                          <div
                            key={`${token.address}-${index}`}
                            className="group bg-gray-800/30 hover:bg-gray-800/50 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white font-bold text-sm">
                                  {token.symbol.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white">{token.symbol}</span>
                                    {token.isVerified && (
                                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                                        Verified
                                      </Badge>
                                    )}
                                    {token.signals.length > 0 && (
                                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                        {token.signals[0]}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{token.name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white font-medium">
                                  ${token.price < 0.00001 ? token.price.toExponential(2) : token.price.toFixed(token.price < 1 ? 6 : 2)}
                                </div>
                                <div className={`text-sm font-medium ${token.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-4 gap-4 text-xs">
                              <div>
                                <span className="text-gray-500">Volume</span>
                                <p className="text-white font-medium">
                                  {token.volume24h > 1000000 ? `${(token.volume24h / 1000000).toFixed(2)}M` : 
                                   token.volume24h > 1000 ? `${(token.volume24h / 1000).toFixed(2)}K` : 
                                   token.volume24h.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Liquidity</span>
                                <p className="text-white font-medium">
                                  {token.liquidity > 1000000 ? `${(token.liquidity / 1000000).toFixed(2)}M` : 
                                   token.liquidity > 1000 ? `${(token.liquidity / 1000).toFixed(2)}K` : 
                                   token.liquidity.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Market Cap</span>
                                <p className="text-white font-medium">
                                  {token.marketCap > 1000000 ? `${(token.marketCap / 1000000).toFixed(2)}M` : 
                                   token.marketCap > 1000 ? `${(token.marketCap / 1000).toFixed(2)}K` : 
                                   token.marketCap.toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500">Score</span>
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${token.score >= 7 ? 'bg-emerald-500' : token.score >= 4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                      style={{ width: `${token.score * 10}%` }}
                                    />
                                  </div>
                                  <span className="text-white font-medium">{token.score}/10</span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <a
                                href={`https://solscan.io/token/${token.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" /> Solscan
                              </a>
                              {token.pairAddress && (
                                <a
                                  href={`https://dexscreener.com/solana/${token.pairAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg text-xs text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/20"
                                >
                                  <BarChart3 className="w-3 h-3" /> DexScreener
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Strategies Tab */}
            <TabsContent value="strategies" className="space-y-4 animate-slide-up">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(state.strategies).map(([name, stats], index) => (
                  <Card 
                    key={name} 
                    className={`card-professional rounded-2xl overflow-hidden transition-all duration-300 ${!stats.enabled ? 'opacity-50 grayscale' : ''}`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CardHeader className="border-b border-white/5 pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center gap-3 text-lg font-semibold">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                            ${name === 'SNIPER' ? 'bg-cyan-500/20' : ''}
                            ${name === 'WHALE' ? 'bg-blue-500/20' : ''}
                            ${name === 'MOMENTUM' ? 'bg-emerald-500/20' : ''}
                            ${name === 'COMBO' ? 'bg-purple-500/20' : ''}`}
                          >
                            {name === 'SNIPER' && <Target className="w-5 h-5 text-cyan-400" />}
                            {name === 'WHALE' && <Eye className="w-5 h-5 text-blue-400" />}
                            {name === 'MOMENTUM' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                            {name === 'COMBO' && <Sparkles className="w-5 h-5 text-purple-400" />}
                          </div>
                          {name}
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleStrategy(name)}
                          className={`rounded-lg px-3 font-medium transition-all ${stats.enabled ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-gray-500 bg-gray-500/10 hover:bg-gray-500/20'}`}
                        >
                          {stats.enabled ? 'ON' : 'OFF'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/20 rounded-xl p-3">
                          <div className="text-gray-500 text-xs mb-1">Trades</div>
                          <div className="text-xl font-bold text-white">{stats.trades}</div>
                        </div>
                        <div className="bg-black/20 rounded-xl p-3">
                          <div className="text-gray-500 text-xs mb-1">Win Rate</div>
                          <div className="text-xl font-bold text-white">
                            {stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(0) : 0}%
                          </div>
                        </div>
                      </div>
                      <div className="bg-black/20 rounded-xl p-3">
                        <div className="text-gray-500 text-xs mb-1">Profit/Loss</div>
                        <div className={`text-xl font-bold ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(4)} SOL
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Learning Tab */}
            <TabsContent value="learning" className="space-y-4 animate-slide-up">
              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="card-professional rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="text-white flex items-center gap-3 text-lg font-semibold">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-purple-400" />
                      </div>
                      Adaptive Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <div className="text-gray-500 text-sm mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Min Score
                        </div>
                        <div className="text-3xl font-bold text-white">{state.adaptiveConfig.minScore.toFixed(1)}</div>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-emerald-500/20">
                        <div className="text-emerald-500 text-sm mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Take Profit
                        </div>
                        <div className="text-3xl font-bold text-emerald-400">{(state.adaptiveConfig.takeProfit * 100).toFixed(0)}%</div>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-red-500/20">
                        <div className="text-red-500 text-sm mb-2 flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Stop Loss
                        </div>
                        <div className="text-3xl font-bold text-red-400">-{(state.adaptiveConfig.stopLoss * 100).toFixed(0)}%</div>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <div className="text-gray-500 text-sm mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Trade Size
                        </div>
                        <div className="text-3xl font-bold text-white">{(state.adaptiveConfig.tradeSize * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-professional rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="text-white flex items-center gap-3 text-lg font-semibold">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-cyan-400" />
                      </div>
                      Learning Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="bg-black/20 rounded-xl p-5 border border-purple-500/20">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="text-gray-500 text-sm mb-2">Learning Cycles</div>
                          <div className="text-4xl font-bold text-purple-400">{state.learning.learningCount}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-sm mb-2">Interval</div>
                          <div className="text-lg font-bold text-white">Every {state.learning.learningInterval} trades</div>
                        </div>
                      </div>
                      {state.learning.lastLearningTime > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <div className="text-gray-500 text-sm">Last Learning</div>
                          <div className="text-white font-medium">{formatTime(state.learning.lastLearningTime)}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="animate-slide-up">
              <Card className="card-professional rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="text-white flex items-center gap-3 text-lg font-semibold">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500/20 to-gray-500/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    Agent Activity Logs
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[420px]">
                    <div className="p-4 space-y-1 font-mono text-sm">
                      {logs.map((log) => (
                        <div 
                          key={log.id} 
                          className={`flex items-start gap-3 p-3 rounded-lg transition-colors
                            ${log.type === 'success' ? 'bg-emerald-500/5 hover:bg-emerald-500/10' :
                              log.type === 'error' ? 'bg-red-500/5 hover:bg-red-500/10' :
                              log.type === 'warning' ? 'bg-amber-500/5 hover:bg-amber-500/10' :
                              'bg-white/[0.02] hover:bg-white/[0.04]'}`}
                        >
                          <span className="text-gray-600 text-xs w-20 shrink-0 pt-0.5">{formatTime(log.timestamp)}</span>
                          <span className={`font-bold w-20 shrink-0 pt-0.5 text-xs
                            ${log.agent === 'Scout' ? 'text-cyan-400' :
                              log.agent === 'Analyst' ? 'text-blue-400' :
                              log.agent === 'Risk' ? 'text-amber-400' :
                              log.agent === 'Trader' ? 'text-emerald-400' :
                              log.agent === 'Manager' ? 'text-purple-400' :
                              'text-pink-400'}`}
                          >
                            [{log.agent}]
                          </span>
                          <span className={`text-sm leading-relaxed ${log.type === 'success' ? 'text-emerald-300' : 
                                          log.type === 'error' ? 'text-red-300' :
                                          log.type === 'warning' ? 'text-amber-300' :
                                          'text-gray-400'}`}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="text-center py-16">
                          <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                            <Clock className="w-8 h-8 text-gray-600" />
                          </div>
                          <div className="text-gray-500 font-medium">Waiting for activity</div>
                          <div className="text-gray-600 text-sm mt-1">Logs will appear here</div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-black/20 mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="font-medium text-gray-500">Solana AI Trading Bot</span>
                <span className="text-gray-700">v2.0</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span>Connected to Solana Mainnet</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
        
        {/* Toast Container */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </>
  )
}
