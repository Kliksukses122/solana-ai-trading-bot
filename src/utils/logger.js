/**
 * Logger Utility - Centralized logging system
 */

class Logger {
  constructor() {
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SUCCESS: 4 };
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
    this.colors = {
      DEBUG: '\x1b[36m',
      INFO: '\x1b[34m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      SUCCESS: '\x1b[32m',
      RESET: '\x1b[0m',
    };
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || '';
    const reset = this.colors.RESET;
    
    let logMessage = `${color}[${timestamp}] [${level}]${reset} ${message}`;
    
    if (Object.keys(data).length > 0) {
      logMessage += ` ${JSON.stringify(data)}`;
    }
    
    return logMessage;
  }

  log(level, message, data = {}) {
    if (this.levels[level] >= this.levels[this.currentLevel]) {
      console.log(this.formatMessage(level, message, data));
    }
  }

  debug(message, data = {}) { this.log('DEBUG', message, data); }
  info(message, data = {}) { this.log('INFO', message, data); }
  warn(message, data = {}) { this.log('WARN', message, data); }
  error(message, data = {}) { this.log('ERROR', message, data); }
  success(message, data = {}) { this.log('SUCCESS', message, data); }

  agent(name, message, data = {}) {
    this.info(`🤖 [${name}] ${message}`, data);
  }

  performance(operation, duration, data = {}) {
    this.debug(`⏱️ [${operation}] ${duration}ms`, data);
  }
}

const logger = new Logger();
export default logger;
