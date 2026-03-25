'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Portfolio {
  balance: number
  initialBalance: number
  totalPnL: number
  totalPnLPercent: number
  openPositions: any[]
  closedPositions: any[]
  totalTrades: number
  winCount: number
  lossCount: number
  winRate: number
  maxDrawdown: number
  sharpeRatio: number
  profitFactor: number
}

interface BacktestResult {
  metrics: {
    totalTrades: number
    winRate: number
    totalReturnPercent: number
    maxDrawdown: number
    sharpeRatio: number
    profitFactor: number
  }
  grade: string
  isProfitable: boolean
  readyForLive: boolean
  recommendation: string
}

export default function PaperTradingDashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [performanceGrade, setPerformanceGrade] = useState<{ grade: string; summary: string; recommendation: string } | null>(null)

  // Initialize paper trading
  const initPaperTrading = async (balance: number = 10) => {
    setLoading(true)
    try {
      const res = await fetch('/api/paper-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', params: { initialBalance: balance } })
      })
      const data = await res.json()
      if (data.success) {
        setPortfolio(data.portfolio)
      }
    } catch (error) {
      console.error('Init error:', error)
    }
    setLoading(false)
  }

  // Run quick backtest
  const runBacktest = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quick', params: { numTrades: 100, winRate: 0.55 } })
      })
      const data = await res.json()
      if (data.success) {
        setBacktestResult(data.result)
      }
    } catch (error) {
      console.error('Backtest error:', error)
    }
    setLoading(false)
  }

  // Fetch current portfolio
  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/paper-trading')
      const data = await res.json()
      if (data.success) {
        setPortfolio(data.portfolio)
        if (data.summary) {
          setPerformanceGrade(data.summary)
        }
      }
    } catch (error) {
      console.error('Fetch error:', error)
    }
  }

  // Fetch performance summary
  const fetchPerformanceSummary = async () => {
    try {
      const res = await fetch('/api/paper-trading?action=summary')
      const data = await res.json()
      if (data.success) {
        setPerformanceGrade({
          grade: data.grade,
          summary: data.summary,
          recommendation: data.recommendation
        })
      }
    } catch (error) {
      console.error('Summary error:', error)
    }
  }

  useEffect(() => {
    fetchPortfolio()
  }, [])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📊 Paper Trading & Backtesting</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => initPaperTrading(10)}>
            Reset (10 SOL)
          </Button>
          <Button onClick={runBacktest} disabled={loading}>
            {loading ? 'Running...' : 'Run Backtest'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="backtest">Backtest</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Performance Grade */}
          {performanceGrade && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Performance Grade
                  <Badge className={getGradeColor(performanceGrade.grade)}>
                    {performanceGrade.grade}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{performanceGrade.summary}</p>
                <p className="font-medium text-blue-400">{performanceGrade.recommendation}</p>
              </CardContent>
            </Card>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Balance</div>
                <div className="text-2xl font-bold">{portfolio?.balance?.toFixed(4) || '0'} SOL</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total P&L</div>
                <div className={`text-2xl font-bold ${(portfolio?.totalPnL || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(portfolio?.totalPnL || 0) >= 0 ? '+' : ''}{portfolio?.totalPnL?.toFixed(4) || '0'} SOL
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Win Rate</div>
                <div className="text-2xl font-bold">{((portfolio?.winRate || 0) * 100).toFixed(1)}%</div>
                <Progress value={(portfolio?.winRate || 0) * 100} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Max Drawdown</div>
                <div className="text-2xl font-bold text-red-500">{(portfolio?.maxDrawdown || 0).toFixed(2)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Trades</div>
                <div className="text-xl font-bold">{portfolio?.totalTrades || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">W/L Count</div>
                <div className="text-xl font-bold">
                  <span className="text-green-500">{portfolio?.winCount || 0}</span>
                  /
                  <span className="text-red-500">{portfolio?.lossCount || 0}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Profit Factor</div>
                <div className="text-xl font-bold">{portfolio?.profitFactor?.toFixed(2) || '0'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Open Positions */}
          {portfolio?.openPositions && portfolio.openPositions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Open Positions ({portfolio.openPositions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {portfolio.openPositions.map((pos: any) => (
                    <div key={pos.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{pos.symbol}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          @ {pos.entryPrice.toFixed(8)}
                        </span>
                      </div>
                      <div className={pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(4)} SOL
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="backtest" className="space-y-4">
          {backtestResult ? (
            <>
              {/* Backtest Grade */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Backtest Result
                    <Badge className={getGradeColor(backtestResult.grade)}>
                      {backtestResult.grade}
                    </Badge>
                    {backtestResult.isProfitable ? (
                      <Badge className="bg-green-500">Profitable</Badge>
                    ) : (
                      <Badge className="bg-red-500">Not Profitable</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-blue-400">{backtestResult.recommendation}</p>
                </CardContent>
              </Card>

              {/* Backtest Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Trades</div>
                    <div className="text-xl font-bold">{backtestResult.metrics.totalTrades}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Win Rate</div>
                    <div className="text-xl font-bold">{(backtestResult.metrics.winRate * 100).toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Return</div>
                    <div className={`text-xl font-bold ${backtestResult.metrics.totalReturnPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {backtestResult.metrics.totalReturnPercent >= 0 ? '+' : ''}{backtestResult.metrics.totalReturnPercent.toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Max Drawdown</div>
                    <div className="text-xl font-bold text-red-500">{backtestResult.metrics.maxDrawdown.toFixed(2)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                    <div className="text-xl font-bold">{backtestResult.metrics.sharpeRatio.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Profit Factor</div>
                    <div className="text-xl font-bold">{backtestResult.metrics.profitFactor.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Ready for Live? */}
              <Card className={backtestResult.readyForLive ? 'border-green-500' : 'border-red-500'}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    {backtestResult.readyForLive ? (
                      <>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="font-medium text-green-500">Ready for Live Trading</span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="font-medium text-red-500">Not Ready for Live Trading</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">Run a backtest to see results</p>
                <Button className="mt-4" onClick={runBacktest} disabled={loading}>
                  {loading ? 'Running...' : 'Run Quick Backtest'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
              <CardDescription>Recent closed positions</CardDescription>
            </CardHeader>
            <CardContent>
              {portfolio?.closedPositions && portfolio.closedPositions.length > 0 ? (
                <div className="space-y-2">
                  {portfolio.closedPositions.slice(-10).reverse().map((pos: any) => (
                    <div key={pos.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{pos.symbol}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {pos.exitReason}
                        </span>
                      </div>
                      <div className={pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(4)} SOL ({(pos.pnlPercent * 100).toFixed(2)}%)
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center">No closed positions yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
