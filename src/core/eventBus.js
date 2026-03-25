/**
 * Event Bus - Central event-driven communication
 */

import EventEmitter from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.eventHistory = [];
  }

  emitEvent(eventName, data) {
    const event = {
      name: eventName,
      data,
      timestamp: Date.now(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    this.eventHistory.push(event);
    if (this.eventHistory.length > 1000) this.eventHistory.shift();
    this.emit(eventName, event);
    this.emit('*', event);
    return event;
  }

  subscribe(eventName, listener) {
    this.on(eventName, listener);
    return () => this.off(eventName, listener);
  }

  getHistory(eventName = null, limit = 100) {
    let history = eventName 
      ? this.eventHistory.filter(e => e.name === eventName)
      : this.eventHistory;
    return history.slice(-limit);
  }
}

const EventTypes = {
  // Scout Events
  SCOUT_OPPORTUNITY_FOUND: 'scout:opportunity_found',
  SCOUT_WHALE_ACTIVITY: 'scout:whale_activity',
  SCOUT_NEW_TOKEN: 'scout:new_token',
  SCOUT_PRICE_UPDATE: 'scout:price_update',
  SCOUT_VOLUME_SPIKE: 'scout:volume_spike',

  // Analyst Events
  ANALYST_ANALYSIS_COMPLETE: 'analyst:analysis_complete',
  ANALYST_SIGNAL_GENERATED: 'analyst:signal_generated',

  // Risk Events
  RISK_APPROVED: 'risk:approved',
  RISK_REJECTED: 'risk:rejected',
  RISK_EMERGENCY_STOP: 'risk:emergency_stop',
  RISK_WARNING: 'risk:warning',

  // Trader Events
  TRADER_SWAP_INITIATED: 'trader:swap_initiated',
  TRADER_SWAP_SUCCESS: 'trader:swap_success',
  TRADER_SWAP_FAILED: 'trader:swap_failed',
  TRADER_POSITION_OPENED: 'trader:position_opened',
  TRADER_POSITION_CLOSED: 'trader:position_closed',
  TRADER_STOP_LOSS_HIT: 'trader:stop_loss_hit',
  TRADER_TAKE_PROFIT_HIT: 'trader:take_profit_hit',

  // Manager Events
  MANAGER_TRADE_APPROVED: 'manager:trade_approved',
  MANAGER_TRADE_REJECTED: 'manager:trade_rejected',
  MANAGER_COOLDOWN_ACTIVE: 'manager:cooldown_active',
  MANAGER_LOOP_START: 'manager:loop_start',
  MANAGER_LOOP_END: 'manager:loop_end',

  // Learning Events
  LEARNING_CYCLE_COMPLETE: 'learning:cycle_complete',
  LEARNING_CONFIG_ADAPTED: 'learning:config_adapted',
  LEARNING_STRATEGY_SWITCHED: 'learning:strategy_switched',

  // Position Events
  POSITION_OPENED: 'position:opened',
  POSITION_CLOSED: 'position:closed',
  POSITION_UPDATED: 'position:updated',

  // System Events
  SYSTEM_START: 'system:start',
  SYSTEM_STOP: 'system:stop',
  SYSTEM_ERROR: 'system:error',
  SYSTEM_HEALTH_CHECK: 'system:health_check',
  
  // Legacy compatibility (aliases)
  SCOUT_NEW_TOKEN: 'scout:new_token',
  SCOUT_WHALE_ACTIVITY: 'scout:whale_activity',
  SCOUT_VOLUME_SPIKE: 'scout:volume_spike',
  SCOUT_PRICE_UPDATE: 'scout:price_update',
  ANALYST_SIGNAL_GENERATED: 'analyst:signal_generated',
  RISK_EMERGENCY_STOP: 'risk:emergency_stop',
  TRADER_POSITION_CLOSED: 'trader:position_closed',
  LEARNING_CONFIG_ADAPTED: 'learning:config_adapted',
};

const eventBus = new EventBus();
export { EventBus, EventTypes, eventBus };
export default eventBus;
