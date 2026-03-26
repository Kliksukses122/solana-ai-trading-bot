'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradingActive, setTradingActive] = useState(false);

  const treasuryWallet = 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE';

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/jupiter?action=balance');
      const data = await response.json();
      if (data.balance !== undefined) {
        setBalance(data.balance);
        setError(null);
      } else {
        setError('Failed to fetch balance');
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Solana AI Trading Bot
          </h1>
          <p className="text-gray-400 mt-2">6 AI Agents • Real Trading Mode</p>
        </div>

        {/* Treasury Wallet Info */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-purple-500/30">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-green-400">✓</span> Treasury Wallet Connected
          </h2>
          <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-400 mb-1">Wallet Address</p>
            <p className="font-mono text-sm text-purple-300 break-all">{treasuryWallet}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Balance</p>
              {loading ? (
                <p className="text-2xl font-bold">Loading...</p>
              ) : error ? (
                <p className="text-2xl font-bold text-red-400">{error}</p>
              ) : (
                <p className="text-2xl font-bold text-green-400">{balance.toFixed(4)} SOL</p>
              )}
            </div>
            <button
              onClick={fetchBalance}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Trading Status */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-purple-500/30">
          <h2 className="text-xl font-semibold mb-4">Trading Status</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-3 h-3 rounded-full ${tradingActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={tradingActive ? 'text-green-400' : 'text-red-400'}>
              {tradingActive ? 'Trading Active' : 'Trading Paused'}
            </span>
          </div>
          <button
            onClick={() => setTradingActive(!tradingActive)}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              tradingActive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {tradingActive ? 'Stop Trading' : 'Start Trading'}
          </button>
        </div>

        {/* AI Agents */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-purple-500/30">
          <h2 className="text-xl font-semibold mb-4">AI Agents</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'Technical Analyst', status: 'active', color: 'blue' },
              { name: 'Sentiment Analyst', status: 'active', color: 'purple' },
              { name: 'Liquidity Analyst', status: 'active', color: 'cyan' },
              { name: 'Risk Manager', status: 'active', color: 'yellow' },
              { name: 'Portfolio Manager', status: 'active', color: 'green' },
              { name: 'Execution Engine', status: 'active', color: 'pink' },
            ].map((agent) => (
              <div
                key={agent.name}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full bg-${agent.color}-500`}></div>
                  <span className="text-sm font-medium">{agent.name}</span>
                </div>
                <span className="text-xs text-green-400 uppercase">{agent.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/real-trading"
            className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 text-center hover:opacity-90 transition"
          >
            <p className="font-semibold text-lg">Real Trading</p>
            <p className="text-sm opacity-80">Execute live trades</p>
          </a>
          <a
            href="/dashboard"
            className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-center hover:opacity-90 transition"
          >
            <p className="font-semibold text-lg">Dashboard</p>
            <p className="text-sm opacity-80">View analytics</p>
          </a>
          <a
            href="/api/status"
            className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-6 text-center hover:opacity-90 transition"
          >
            <p className="font-semibold text-lg">API Status</p>
            <p className="text-sm opacity-80">System health</p>
          </a>
        </div>
      </div>
    </main>
  );
}
