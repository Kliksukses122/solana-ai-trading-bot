'use client';

import { useState, useEffect, useCallback } from 'react';

export default function RealTradingPage() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [trading, setTrading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [tradeAmount, setTradeAmount] = useState('0.01');
  const [selectedToken, setSelectedToken] = useState('USDC');

  const treasuryWallet = 'FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE';

  const tokens = [
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
    { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
    { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  ];

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const response = await fetch('/api/jupiter?action=balance');
      const data = await response.json();
      if (data.balance !== undefined) {
        setBalance(data.balance);
        addLog(`Balance updated: ${data.balance.toFixed(4)} SOL`);
      }
    } catch (err) {
      addLog('Error fetching balance');
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  const executeTrade = useCallback(async (action: 'buy' | 'sell') => {
    if (!trading) return;
    
    addLog(`Preparing ${action.toUpperCase()} order for ${selectedToken}...`);
    
    try {
      const token = tokens.find(t => t.symbol === selectedToken);
      if (!token) {
        addLog('Token not found');
        return;
      }

      const amount = parseFloat(tradeAmount) * 1000000000; // Convert to lamports

      const response = await fetch('/api/jupiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          inputMint: action === 'buy' ? 'So11111111111111111111111111111111111111112' : token.mint,
          outputMint: action === 'buy' ? token.mint : 'So11111111111111111111111111111111111111112',
          amount,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        addLog(`✓ ${action.toUpperCase()} successful: ${data.signature?.slice(0, 20)}...`);
        await fetchBalance();
      } else {
        addLog(`✗ ${action.toUpperCase()} failed: ${data.error}`);
      }
    } catch (err) {
      addLog(`Error executing trade: ${err}`);
    }
  }, [trading, selectedToken, tradeAmount, addLog, fetchBalance]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    if (!trading) return;

    const interval = setInterval(() => {
      fetchBalance();
    }, 60000);

    return () => clearInterval(interval);
  }, [trading, fetchBalance]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-400">Real Trading Mode</h1>
            <p className="text-gray-400">Live trading with treasury wallet</p>
          </div>
          <a href="/" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
            Back to Home
          </a>
        </div>

        {/* Warning Banner */}
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 mb-6">
          <p className="text-red-300">
            ⚠️ WARNING: This is REAL trading mode with actual SOL. Trades are irreversible.
          </p>
        </div>

        {/* Balance Card */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Treasury Wallet Balance</p>
              <p className="text-3xl font-bold text-green-400">
                {loading ? 'Loading...' : `${balance.toFixed(4)} SOL`}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-mono">{treasuryWallet}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchBalance}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Refresh
              </button>
              <button
                onClick={() => setTrading(!trading)}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  trading ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {trading ? 'Stop' : 'Start'} Trading
              </button>
            </div>
          </div>
        </div>

        {/* Trading Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trade Settings */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-green-500/30">
            <h2 className="text-xl font-semibold mb-4">Trade Settings</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Trade Amount (SOL)</label>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                step="0.001"
                min="0.001"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Target Token</label>
              <select
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              >
                {tokens.map(t => (
                  <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => executeTrade('buy')}
                disabled={!trading || loading}
                className="py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg font-semibold transition"
              >
                BUY {selectedToken}
              </button>
              <button
                onClick={() => executeTrade('sell')}
                disabled={!trading || loading}
                className="py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg font-semibold transition"
              >
                SELL {selectedToken}
              </button>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-green-500/30">
            <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
            <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-gray-500">No activity yet...</p>
              ) : (
                logs.map((log, i) => (
                  <p key={i} className="text-gray-300 mb-1">{log}</p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${trading ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className={trading ? 'text-green-400' : 'text-red-400'}>
            {trading ? 'Trading Bot Active' : 'Trading Bot Inactive'}
          </span>
        </div>
      </div>
    </main>
  );
}
