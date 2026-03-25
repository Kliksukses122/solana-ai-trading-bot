/**
 * Solana AI Trading Bot - Main Entry Point
 * 
 * Multi-Strategy with Auto-Learning
 * Strategies: SNIPER | WHALE | MOMENTUM | COMBO
 */

import managerAgent from './agents/managerAgent.js';
import logger from './utils/logger.js';
import config from './config/config.js';

class TradingBot {
  constructor() {
    this.name = 'TradingBot';
    this.manager = managerAgent;
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      logger.info('🤖 ========================================');
      logger.info('🤖  Solana AI Trading Bot v2.0');
      logger.info('🤖  Multi-Strategy with Auto-Learning');
      logger.info('🤖 ========================================');
      logger.info('');

      // Initialize
      await this.manager.initialize();

      // Start trading
      this.manager.start();

      // Handle shutdown
      this.setupShutdownHandlers();

      logger.info('✅ Bot started successfully');
      logger.info('');

      return this.manager;
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  stop() {
    logger.info('Stopping bot...');
    this.manager.stop();
  }

  /**
   * Setup shutdown handlers
   */
  setupShutdownHandlers() {
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      logger.info('\nReceived SIGINT, shutting down...');
      this.stop();
      process.exit(0);
    });

    // Handle kill command
    process.on('SIGTERM', () => {
      logger.info('\nReceived SIGTERM, shutting down...');
      this.stop();
      process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection:', reason);
    });
  }

  /**
   * Get bot status
   */
  getStatus() {
    return this.manager.getStatus();
  }

  /**
   * Get bot summary for API
   */
  getSummary() {
    return this.manager.getSummary();
  }
}

// Export singleton
const tradingBot = new TradingBot();
export { TradingBot, tradingBot };
export default tradingBot;

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  tradingBot.start().catch(console.error);
}
