'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Zap,
  BookOpen,
  DollarSign,
  BarChart3,
  Activity,
  RefreshCw
} from 'lucide-react'

interface LearningInsights {
  bestTokens: { symbol: string; winRate: number; avgProfit: number }[]
  worstTokens: { symbol: string; winRate: number; avgLoss: number }[]
  bestStrategies: { name: string; winRate: number; avgProfit: number }[]
  bestScoreRange: [number, number]
  optimalHoldDuration: number
  winRateTrend: number
  recentPerformance: number
  learnedRules: string[]
}

interface StrategyReadiness {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  isReadyForReal: boolean
  winRate: number
  profitFactor: number
  maxDrawdown: number
  totalTrades: number
  recommendations: string[]
}

interface UnifiedStatus {
  learning: {
    totalTrades: number
    wins: number
    losses: number
    winRate: number
    totalProfit: number
  }
  insights: {
    bestTokens: string[]
    avoidTokens: string[]
    learnedRules: string[]
    isReadyForReal: boolean
    strategyGrade: string
  }
  readiness: StrategyReadiness
}

export default function UnifiedTradingPage() {
  const [status, setStatus] = useState<UnifiedStatus | null>(null)
  const [learningInsights, setLearningInsights] = useState<LearningInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferResult, setTransferResult] = useState<any>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch unified status
      const statusRes = await fetch('/api/unified-trading?action=status')
      const statusData = await statusRes.json()
      if (statusData.success) {
        setStatus(statusData)
      }

      // Fetch learning insights
      const insightsRes = await fetch('/api/unified-trading?action=learning-insights')
      const insightsData = await insightsRes.json()
      if (insightsData.success) {
        setLearningInsights(insightsData.insights)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleTransferToReal = async () => {
    setTransferLoading(true)
    try {
      const res = await fetch('/api/unified-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer-to-real' })
      })
      const data = await res.json()
      setTransferResult(data)
    } catch (error) {
      console.error('Transfer error:', error)
    } finally {
      setTransferLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500'
      case 'B': return 'bg-blue-500'
      case 'C': return 'bg-yellow-500'
      case 'D': return 'bg-orange-500'
      case 'F': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getWinRateColor = (rate: number) => {
    if (rate >= 0.65) return 'text-green-500'
    if (rate >= 0.50) return 'text-yellow-500'
    return 'text-red-500'
  }

  if (loading && !status) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading unified trading data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-purple-500" />
            Unified AI Trading System
          </h1>
          <p className="text-muted-foreground mt-1">
            Paper Trading → Learning → Real Trading Integration
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Flow Diagram */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {/* Paper Trading */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                <BookOpen className="w-8 h-8 text-purple-400" />
              </div>
              <span className="font-medium">Paper Trading</span>
              <span className="text-xs text-muted-foreground">Simulation</span>
            </div>

            <ArrowRight className="w-8 h-8 text-muted-foreground" />

            {/* Learning */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                <Brain className="w-8 h-8 text-blue-400" />
              </div>
              <span className="font-medium">AI Learning</span>
              <span className="text-xs text-muted-foreground">Pattern Recognition</span>
            </div>

            <ArrowRight className="w-8 h-8 text-muted-foreground" />

            {/* Real Trading */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                status?.readiness?.isReadyForReal 
                  ? 'bg-green-500/20' 
                  : 'bg-gray-500/20'
              }`}>
                <DollarSign className={`w-8 h-8 ${
                  status?.readiness?.isReadyForReal 
                    ? 'text-green-400' 
                    : 'text-gray-400'
                }`} />
              </div>
              <span className="font-medium">Real Trading</span>
              <span className="text-xs text-muted-foreground">
                {status?.readiness?.isReadyForReal ? 'Ready!' : 'Locked'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Strategy Progress</span>
              <span>Grade: {status?.readiness?.grade || 'F'}</span>
            </div>
            <Progress 
              value={
                status?.readiness?.grade === 'A' ? 100 :
                status?.readiness?.grade === 'B' ? 80 :
                status?.readiness?.grade === 'C' ? 60 :
                status?.readiness?.grade === 'D' ? 40 : 20
              } 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Learning Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Learning Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{status?.learning?.totalTrades || 0}</div>
                <div className="text-xs text-muted-foreground">Total Trades</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className={`text-2xl font-bold ${getWinRateColor(status?.learning?.winRate || 0)}`}>
                  {((status?.learning?.winRate || 0) * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-500">{status?.learning?.wins || 0}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-red-500">{status?.learning?.losses || 0}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Strategy Readiness</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Win Rate Target</span>
                  <span className={status?.readiness?.winRate && status.readiness.winRate >= 0.55 ? 'text-green-500' : 'text-yellow-500'}>
                    {((status?.readiness?.winRate || 0) * 100).toFixed(1)}% / 55%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Profit Factor</span>
                  <span className={status?.readiness?.profitFactor && status.readiness.profitFactor >= 1.5 ? 'text-green-500' : 'text-yellow-500'}>
                    {(status?.readiness?.profitFactor || 0).toFixed(2)} / 1.5
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Trades Required</span>
                  <span className={status?.readiness?.totalTrades && status.readiness.totalTrades >= 20 ? 'text-green-500' : 'text-yellow-500'}>
                    {status?.readiness?.totalTrades || 0} / 20
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Middle Column - AI Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              AI Learning Insights
            </CardTitle>
            <CardDescription>Patterns learned from paper trading</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {learningInsights?.learnedRules && learningInsights.learnedRules.length > 0 ? (
              <div className="space-y-2">
                {learningInsights.learnedRules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                    <Zap className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{rule}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Complete more paper trades to generate insights</p>
              </div>
            )}

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Best Performing Tokens</h4>
              {learningInsights?.bestTokens && learningInsights.bestTokens.length > 0 ? (
                <div className="space-y-2">
                  {learningInsights.bestTokens.slice(0, 3).map((token, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{token.symbol}</span>
                      </div>
                      <span className="text-green-500">{(token.winRate * 100).toFixed(0)}% WR</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Tokens to Avoid</h4>
              {learningInsights?.worstTokens && learningInsights.worstTokens.length > 0 ? (
                <div className="space-y-2">
                  {learningInsights.worstTokens.slice(0, 3).map((token, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>{token.symbol}</span>
                      </div>
                      <span className="text-red-500">{(token.winRate * 100).toFixed(0)}% WR</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No blacklisted tokens</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Real Trading Transfer */}
        <Card className={status?.readiness?.isReadyForReal ? 'border-green-500' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Real Trading Status
            </CardTitle>
            <CardDescription>
              {status?.readiness?.isReadyForReal 
                ? 'Strategy approved for real trading!' 
                : 'Complete paper trading to unlock'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 rounded-lg ${
              status?.readiness?.isReadyForReal 
                ? 'bg-green-500/10 border border-green-500' 
                : 'bg-muted'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getGradeColor(status?.readiness?.grade || 'F')}`}>
                  <span className="text-xl font-bold text-white">{status?.readiness?.grade || 'F'}</span>
                </div>
                <div>
                  <div className="font-medium">Strategy Grade</div>
                  <div className="text-sm text-muted-foreground">
                    {status?.readiness?.isReadyForReal ? 'Ready for Real Trading' : 'Needs Improvement'}
                  </div>
                </div>
              </div>

              {status?.readiness?.recommendations && status.readiness.recommendations.length > 0 && (
                <div className="space-y-1">
                  {status.readiness.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transfer Button */}
            <Button
              className="w-full"
              size="lg"
              disabled={!status?.readiness?.isReadyForReal || transferLoading}
              onClick={handleTransferToReal}
            >
              {transferLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : status?.readiness?.isReadyForReal ? (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Apply to Real Trading
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Grade Must Be A or B
                </>
              )}
            </Button>

            {/* Transfer Result */}
            {transferResult && (
              <div className={`p-4 rounded-lg ${transferResult.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {transferResult.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">{transferResult.message}</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div>Win Rate: {(transferResult.strategy.winRate * 100).toFixed(1)}%</div>
                      <div>Profit Factor: {transferResult.strategy.profitFactor.toFixed(2)}</div>
                      <div>Best Tokens: {transferResult.strategy.bestTokens.join(', ')}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600">
                    <div className="font-medium">{transferResult.error}</div>
                    <ul className="text-sm mt-1">
                      {transferResult.requirements?.map((req: string, i: number) => (
                        <li key={i}>• {req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="how-it-works">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="how-it-works">How It Works</TabsTrigger>
          <TabsTrigger value="requirements">Grade Requirements</TabsTrigger>
          <TabsTrigger value="safety">Safety Features</TabsTrigger>
        </TabsList>

        <TabsContent value="how-it-works" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">1</div>
                    <h3 className="font-semibold">Paper Trading</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Test your AI trading strategy without real money. Every trade is recorded and analyzed 
                    to learn patterns and identify what works best.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">2</div>
                    <h3 className="font-semibold">AI Learning</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI analyzes all paper trades to identify: best performing tokens, optimal entry conditions, 
                    winning patterns, and tokens to avoid.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">3</div>
                    <h3 className="font-semibold">Real Trading</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Only strategies with Grade A or B can be applied to real trading. 
                    This ensures you only trade with proven, tested strategies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-5 gap-4">
                {['A', 'B', 'C', 'D', 'F'].map(grade => {
                  const requirements: Record<string, { winRate: number; profitFactor: number; maxDrawdown: number }> = {
                    A: { winRate: 65, profitFactor: 2.0, maxDrawdown: 10 },
                    B: { winRate: 55, profitFactor: 1.5, maxDrawdown: 20 },
                    C: { winRate: 45, profitFactor: 1.2, maxDrawdown: 30 },
                    D: { winRate: 35, profitFactor: 0.8, maxDrawdown: 50 },
                    F: { winRate: 0, profitFactor: 0, maxDrawdown: 100 }
                  }
                  const req = requirements[grade]
                  const isCurrentGrade = status?.readiness?.grade === grade
                  
                  return (
                    <div 
                      key={grade} 
                      className={`p-4 rounded-lg border-2 ${isCurrentGrade ? 'border-primary' : 'border-muted'}`}
                    >
                      <div className={`text-center mb-3 ${getGradeColor(grade)} text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto`}>
                        <span className="font-bold">{grade}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div>Win Rate: ≥{req.winRate}%</div>
                        <div>Profit Factor: ≥{req.profitFactor}</div>
                        <div>Max DD: ≤{req.maxDrawdown}%</div>
                      </div>
                      {grade === 'A' || grade === 'B' ? (
                        <Badge className="w-full mt-2 justify-center bg-green-500">Real Trading OK</Badge>
                      ) : (
                        <Badge className="w-full mt-2 justify-center bg-gray-500">Simulation Only</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Minimum 20 Trades Required</h4>
                      <p className="text-sm text-muted-foreground">
                        Strategy must be tested with at least 20 trades before being considered for real trading.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Token Blacklist System</h4>
                      <p className="text-sm text-muted-foreground">
                        Tokens with win rate below 30% after 3+ trades are automatically blacklisted.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Dynamic Position Sizing</h4>
                      <p className="text-sm text-muted-foreground">
                        Position size automatically adjusts based on token win rate and confidence level.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Performance Monitoring</h4>
                      <p className="text-sm text-muted-foreground">
                        Win rate trend tracked in real-time. Declining performance triggers warnings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Grade-Based Access</h4>
                      <p className="text-sm text-muted-foreground">
                        Only Grade A/B strategies can be transferred to real trading, ensuring quality.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Learning Applied to Real Trades</h4>
                      <p className="text-sm text-muted-foreground">
                        Real trading AI uses all learned insights to make better decisions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
