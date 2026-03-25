# Solana AI Trading Bot

A production-ready multi-agent AI trading bot for Solana with Jupiter Aggregator integration, featuring real-time market analysis, machine learning predictions, and a modern dashboard UI.

## Features

- **Multi-Agent Architecture**: 6 specialized agents working together
  - **Scout Agent**: Real-time token scanning, whale tracking, opportunity detection
  - **Analyst Agent**: Technical analysis (RSI, MACD, Bollinger Bands), ML predictions
  - **Risk Agent**: Position sizing, stop-loss, take-profit, risk limits
  - **Trader Agent**: Jupiter swap integration, transaction execution
  - **Memory Agent**: Trade history, performance tracking
  - **Manager Agent**: Orchestration, cooldown management

- **Technical Analysis**: RSI, MACD, EMA crossovers, Bollinger Bands, momentum
- **ML Predictions**: Ensemble model with neural network, momentum, and mean reversion
- **Whale Tracking**: Monitor large wallet activities
- **Jupiter Integration**: Full swap flow with slippage control
- **Real-time Dashboard**: Modern UI with live updates via WebSocket
- **Paper Trading**: Mock mode for safe testing

## Quick Start

### Prerequisites

- Node.js 18+
- Bun (recommended) or npm
- Solana wallet with private key (for live trading)

### Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# IMPORTANT: Set MOCK_MODE=true for testing
```

### Running the Bot

```bash
# Start the trading bot
bun run bot

# Start with auto-reload (development)
bun run bot:dev

# Start the API service (for dashboard)
bun run api

# Start the dashboard
bun run dev
```

## Project Structure

```
src/
├── bot.js                 # Main entry point
├── config/
│   └── config.js          # Configuration management
├── core/
│   └── eventBus.js        # Event-driven communication
├── agents/
│   ├── scoutAgent.js      # Token discovery
│   ├── analystAgent.js    # Technical analysis
│   ├── riskAgent.js       # Risk management
│   ├── traderAgent.js     # Trade execution
│   ├── managerAgent.js    # Orchestration
│   └── memoryAgent.js     # State & history
├── services/
│   ├── dataService.js     # Market data fetching
│   ├── indicatorService.js # Technical indicators
│   ├── jupiterService.js  # Jupiter swap API
│   ├── walletService.js   # Wallet management
│   └── mlService.js       # ML predictions
└── utils/
    └── logger.js          # Logging system
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Solana wallet private key (base58) | Required for live mode |
| `RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `TRADE_SIZE_SOL` | Default trade size in SOL | `0.01` |
| `MAX_RISK_PERCENT` | Max risk per trade (%) | `2` |
| `STOP_LOSS_PERCENT` | Stop loss percentage | `5` |
| `TAKE_PROFIT_PERCENT` | Take profit percentage | `10` |
| `SLIPPAGE_BPS` | Slippage in basis points | `50` |
| `COOLDOWN_SECONDS` | Cooldown between trades | `60` |
| `MOCK_MODE` | Paper trading mode | `true` |

## API Endpoints

The bot exposes a WebSocket API on port 3030 for dashboard communication:

### Events

- `state` - Full bot state
- `get-status` - Request current status
- `get-trades` - Request trade history
- `get-performance` - Request performance metrics
- `manual-trade` - Execute manual trade
- `start-bot` / `stop-bot` - Control bot state
- `add-token` - Add token to monitor

## Dashboard

The dashboard provides real-time monitoring and control:

- **Overview**: Performance metrics, portfolio chart, opportunities
- **Trades**: Complete trade history
- **Positions**: Active position management
- **Agents**: Agent status and metrics

Access at `http://localhost:3000`

## Security

- Never commit `.env` file or private keys
- Use `MOCK_MODE=true` for testing
- Set appropriate risk limits
- Monitor the bot regularly
- Use dedicated trading wallet

## Risk Management

The bot implements multiple risk controls:

- Maximum risk per trade (1-2%)
- Daily loss limit
- Maximum drawdown protection
- Emergency stop functionality
- Position size limits
- Token blacklist/whitelist

## Technical Indicators

Supported indicators:

- **RSI**: Relative Strength Index (14-period)
- **MACD**: Moving Average Convergence Divergence
- **EMA**: Exponential Moving Averages (9/21 crossover)
- **Bollinger Bands**: Volatility bands
- **Volume Analysis**: Volume spikes and trends
- **Support/Resistance**: Key price levels

## ML Predictions

The ML service uses an ensemble approach:

1. **Neural Network**: Simple feed-forward network
2. **Momentum**: Price momentum analysis
3. **Mean Reversion**: Statistical mean reversion

Predictions are weighted and combined for final signals.

## Jupiter Integration

Full integration with Jupiter Aggregator v6:

1. Quote fetching with slippage control
2. Transaction building
3. Transaction signing
4. Transaction sending and confirmation

## License

MIT License - Use at your own risk

## Disclaimer

This software is provided for educational purposes only. Cryptocurrency trading carries significant risk. The authors are not responsible for any financial losses. Always test thoroughly in mock mode before live trading.
