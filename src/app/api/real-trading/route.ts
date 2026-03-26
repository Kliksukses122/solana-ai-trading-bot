'use client';

import { useState, useEffect, useCallback } from 'react';

interface BotState {
  isRunning: boolean;
  lastAnalysis: string | null;
  lastTrade: string | null;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  logs: string[];
  balance: number;
}

export default function RealTradingPage() {
  const [botState, setBotState] = useState<BotState>({
    isRunning: false,
    lastAnalysis: null,
    lastTrade: null,
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    logs: [],
    balance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [intervalMs, setIntervalMs] = useState(300000);

  const treasuryWallet = 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE';

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/bot?action=status');
      const data = await response.json();
      setBotState(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const startBot = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/bot?action=start&interval=${intervalMs}`);
      const data = await response.json();
      if (data.success) {
        setBotState(data.state);
      }
    } catch (err) {
      console.error('Error starting bot:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopBot = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bot?action=stop');
      const data = await response.json();
      if (data.success) {
        setBotState(data.state);
      }
    } catch (err) {
      console.error('Error stopping bot:', err);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bot?action=analyze');
      const data = await response.json();
      if (data.success) {
        setBotState(data.state);
      }
    } catch (err) {
      console.error('Error running analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-400">🤖 AI Trading Bot</h1>
            <p className="text-gray-400">6 AI Agents • Auto Trading • Real SOL</p>
          </div>
          <a href="/" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
            ← Back to Home
          </a>
        </div>

        {/* Warning Banner */}
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 mb-6">
          <p className="text-red-300">
            ⚠️ REAL TRADING MODE: This bot will execute actual trades with your SOL. 
            Ensure you understand the risks before starting.
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
            <p className="text-sm text-gray-400">Balance</p>
            <p className="text-2xl font-bold text-green-400">{botState.balance.toFixed(4)} SOL</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
            <p className="text-sm text-gray-400">Status</p>
            <p className={`text-2xl font-bold ${botState.isRunning ? 'text-green-400' : 'text-red-400'}`}>
              {botState.isRunning ? '🟢 RUNNING' : '🔴 STOPPED'}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
            <p className="text-sm text-gray-400">Total Trades</p>
            <p className="text-2xl font-bold text-blue-400">{botState.totalTrades}</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
            <p className="text-sm text-gray-400">Success Rate</p>
            <p className="text-2xl font-bold text-purple-400">
              {botState.totalTrades > 0 
                ? ((botState.successfulTrades / botState.totalTrades) * 100).toFixed(0) 
                : 0}%
            </p>
          </div>
        </div>

        {/* Bot Controls */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-green-500/30">
          <h2 className="text-xl font-semibold mb-4">Bot Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Analysis Interval</label>
              <select
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                disabled={botState.isRunning}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2"
              >
                <option value={60000}>1 Minute</option>
                <option value={300000}>5 Minutes</option>
                <option value={600000}>10 Minutes</option>
                <option value={1800000}>30 Minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Treasury Wallet</label>
              <p className="font-mono text-sm text-purple-300 break-all bg-gray-900 rounded-lg px-4 py-2">
                {treasuryWallet}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {!botState.isRunning ? (
              <button
                onClick={startBot}
                disabled={loading}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold transition flex items-center gap-2"
              >
                🚀 Start Bot
              </button>
            ) : (
              <button
                onClick={stopBot}
                disabled={loading}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-semibold transition flex items-center gap-2"
              >
                🛑 Stop Bot
              </button>
            )}
            <button
              onClick={runAnalysis}
              disabled={loading || botState.isRunning}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold transition"
            >
              🔍 Run Analysis Now
            </button>
            <button
              onClick={fetchStatus}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* AI Agents */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-green-500/30">
          <h2 className="text-xl font-semibold mb-4">🤖 AI Agents</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Technical Analyst', emoji: '📊', desc: 'Price & trend analysis' },
              { name: 'Sentiment Analyst', emoji: '💭', desc: 'Market sentiment' },
              { name: 'Liquidity Analyst', emoji: '💧', desc: 'Liquidity assessment' },
              { name: 'Risk Manager', emoji: '🛡️', desc: 'Risk evaluation' },
              { name: 'Portfolio Manager', emoji: '💼', desc: 'Strategy optimization' },
              { name: 'Execution Engine', emoji: '⚡', desc: 'Final decision' },
            ].map((agent) => (
              <div
                key={agent.name}
                className={`bg-gray-900/50 rounded-lg p-3 border ${
                  botState.isRunning ? 'border-green-500/50' : 'border-gray-700'
                }`}
              >
                <div className="text-2xl mb-2">{agent.emoji}</div>
                <p className="text-sm font-medium">{agent.name}</p>
                <p className="text-xs text-gray-500">{agent.desc}</p>
                <div className={`mt-2 text-xs ${botState.isRunning ? 'text-green-400' : 'text-gray-500'}`}>
                  {botState.isRunning ? '● Active' : '○ Inactive'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-green-500/30">
          <h2 className="text-xl font-semibold mb-4">📋 Activity Log</h2>
          <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-y-auto font-mono text-xs">
            {botState.logs.length === 0 ? (
              <p className="text-gray-500">No activity yet. Start the bot to begin trading.</p>
            ) : (
              botState.logs.map((log, i) => (
                <p key={i} className="text-gray-300 mb-1 whitespace-pre-wrap">{log}</p>
              ))
            )}
          </div>
        </div>

        {/* Trade History */}
        {botState.lastTrade && (
          <div className="mt-6 bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
            <p className="text-sm text-gray-400">Last Trade</p>
            <p className="text-green-400">{new Date(botState.lastTrade).toLocaleString()}</p>
          </div>
        )}
      </div>
    </main>
  );
}
