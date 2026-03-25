/**
 * State Bridge Service - Shared State Management
 * Provides a bridge between the bot and the API service
 * Both services read/write to the same state file for real-time updates
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

const STATE_FILE = path.join(process.cwd(), 'data', 'bot-state.json');
const STATE_UPDATE_INTERVAL = 1000; // 1 second for near real-time updates

class StateBridge {
  constructor() {
    this.state = this.getInitialState();
    this.updateInterval = null;
    this.lastWriteTime = 0;
    this.pendingUpdate = false;
  }

  getInitialState() {
    return {
      // Bot status
      status: 'stopped',
      mockMode: config.bot.mockMode,
      startTime: null,
      lastUpdate: Date.now(),
      
      // Wallet info - use config address if available
      wallet: {
        address: config.wallet.address || null,
        balance: 0,
        balanceUsd: 0,
      },
      
      // Agent states
      agents: {
        scout: {
          name: 'ScoutAgent',
          isRunning: false,
          monitoredTokens: 0,
          whaleWallets: 0,
          recentOpportunities: 0,
        },
        analyst: {
          name: 'AnalystAgent',
          cacheSize: 0,
          historySize: 0,
          minConfidence: config.scoring.minConfidenceScore,
          mlEnabled: config.ml.enabled,
        },
        risk: {
          name: 'RiskAgent',
          emergencyStop: false,
          activePositions: 0,
          dailyPnL: 0,
          dailyTrades: 0,
        },
        trader: {
          name: 'TraderAgent',
          mockMode: config.bot.mockMode,
          pendingTransactions: 0,
          completedTrades: 0,
        },
        memory: {
          name: 'MemoryAgent',
          totalTrades: 0,
          performanceMetrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            winRate: 0,
            profitFactor: 0,
            maxDrawdown: 0,
          },
        },
      },
      
      // Performance metrics
      performance: {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        avgHoldingTime: 0,
      },
      
      // Recent trades (last 100)
      recentTrades: [],
      
      // Current opportunities
      opportunities: [],
      
      // Active positions
      positions: [],
      
      // Event log (last 50 events)
      eventLog: [],
    };
  }

  /**
   * Initialize the state bridge
   */
  async initialize() {
    // Ensure data directory exists
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing state if available
    await this.loadState();
    
    logger.info('StateBridge initialized', { stateFile: STATE_FILE });
    return this;
  }

  /**
   * Load state from file
   */
  async loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        this.state = { ...this.getInitialState(), ...data };
        logger.debug('State loaded from file');
      }
    } catch (error) {
      logger.warn('Failed to load state, using defaults', { error: error.message });
    }
  }

  /**
   * Save state to file
   */
  saveState() {
    try {
      this.state.lastUpdate = Date.now();
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
      this.lastWriteTime = Date.now();
      this.pendingUpdate = false;
    } catch (error) {
      logger.error('Failed to save state', { error: error.message });
    }
  }

  /**
   * Request a state save (debounced)
   */
  requestSave() {
    const now = Date.now();
    if (now - this.lastWriteTime >= STATE_UPDATE_INTERVAL) {
      this.saveState();
    } else if (!this.pendingUpdate) {
      this.pendingUpdate = true;
      setTimeout(() => {
        if (this.pendingUpdate) {
          this.saveState();
        }
      }, STATE_UPDATE_INTERVAL - (now - this.lastWriteTime));
    }
  }

  /**
   * Update bot status
   */
  updateStatus(status) {
    this.state.status = status;
    if (status === 'running' && !this.state.startTime) {
      this.state.startTime = Date.now();
    } else if (status === 'stopped') {
      this.state.startTime = null;
    }
    this.requestSave();
  }

  /**
   * Update wallet info
   */
  updateWallet(address, balance, balanceUsd = 0) {
    this.state.wallet = {
      address,
      balance,
      balanceUsd,
    };
    this.requestSave();
  }

  /**
   * Update agent status
   */
  updateAgent(agentName, agentState) {
    if (this.state.agents[agentName]) {
      this.state.agents[agentName] = {
        ...this.state.agents[agentName],
        ...agentState,
      };
      this.requestSave();
    }
  }

  /**
   * Update all agents at once
   */
  updateAllAgents(agentsStatus) {
    for (const [name, status] of Object.entries(agentsStatus)) {
      if (this.state.agents[name]) {
        this.state.agents[name] = {
          ...this.state.agents[name],
          ...status,
        };
      }
    }
    this.requestSave();
  }

  /**
   * Update performance metrics
   */
  updatePerformance(metrics) {
    this.state.performance = {
      ...this.state.performance,
      ...metrics,
    };
    this.requestSave();
  }

  /**
   * Add a trade to recent trades
   */
  addTrade(trade) {
    this.state.recentTrades.unshift(trade);
    if (this.state.recentTrades.length > 100) {
      this.state.recentTrades.pop();
    }
    this.requestSave();
  }

  /**
   * Update recent trades
   */
  updateTrades(trades) {
    this.state.recentTrades = trades.slice(0, 100);
    this.requestSave();
  }

  /**
   * Add an opportunity
   */
  addOpportunity(opportunity) {
    // Remove duplicates
    const existing = this.state.opportunities.findIndex(
      o => o.tokenMint === opportunity.tokenMint
    );
    if (existing >= 0) {
      this.state.opportunities[existing] = opportunity;
    } else {
      this.state.opportunities.unshift(opportunity);
      if (this.state.opportunities.length > 20) {
        this.state.opportunities.pop();
      }
    }
    this.requestSave();
  }

  /**
   * Update opportunities
   */
  updateOpportunities(opportunities) {
    this.state.opportunities = opportunities.slice(0, 20);
    this.requestSave();
  }

  /**
   * Add a position
   */
  addPosition(position) {
    const existing = this.state.positions.findIndex(
      p => p.tokenMint === position.tokenMint
    );
    if (existing >= 0) {
      this.state.positions[existing] = position;
    } else {
      this.state.positions.push(position);
    }
    this.requestSave();
  }

  /**
   * Remove a position
   */
  removePosition(tokenMint) {
    this.state.positions = this.state.positions.filter(
      p => p.tokenMint !== tokenMint
    );
    this.requestSave();
  }

  /**
   * Update positions
   */
  updatePositions(positions) {
    this.state.positions = positions;
    this.requestSave();
  }

  /**
   * Add an event to the log
   */
  addEvent(event) {
    this.state.eventLog.unshift({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });
    if (this.state.eventLog.length > 50) {
      this.state.eventLog.pop();
    }
    this.requestSave();
  }

  /**
   * Full state update (used by manager agent)
   */
  fullUpdate(data) {
    if (data.status) this.state.status = data.status;
    if (data.startTime !== undefined) this.state.startTime = data.startTime;
    if (data.wallet) this.state.wallet = { ...this.state.wallet, ...data.wallet };
    if (data.agents) this.updateAllAgents(data.agents);
    if (data.performance) this.state.performance = { ...this.state.performance, ...data.performance };
    if (data.recentTrades) this.state.recentTrades = data.recentTrades;
    if (data.opportunities) this.state.opportunities = data.opportunities;
    if (data.positions) this.state.positions = data.positions;
    
    this.state.lastUpdate = Date.now();
    this.requestSave();
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get state for API (lightweight version)
   */
  getApiState() {
    return {
      status: this.state.status,
      mockMode: this.state.mockMode,
      startTime: this.state.startTime,
      wallet: this.state.wallet,
      agents: this.state.agents,
      performance: this.state.performance,
      recentTrades: this.state.recentTrades.slice(0, 50),
      opportunities: this.state.opportunities,
      positions: this.state.positions,
    };
  }

  /**
   * Start periodic state saving
   */
  startPeriodicSave(intervalMs = 5000) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.updateInterval = setInterval(() => {
      this.saveState();
    }, intervalMs);
  }

  /**
   * Stop periodic saving
   */
  stopPeriodicSave() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    // Final save
    this.saveState();
  }
}

// Singleton instance
const stateBridge = new StateBridge();

export { StateBridge, stateBridge };
export default stateBridge;
