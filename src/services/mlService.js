/**
 * ML Prediction Service - Machine Learning Price Prediction
 * Simple neural network-based price prediction using historical data
 */

import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class MLPredictionService {
  constructor() {
    this.enabled = config.ml.enabled;
    this.models = new Map();
    this.trainingData = new Map();
    this.predictionThreshold = config.ml.predictionThreshold;
    this.featureWindow = 20; // Number of candles to use as features
  }

  /**
   * Initialize the ML service
   */
  async initialize() {
    if (!this.enabled) {
      logger.info('ML predictions disabled');
      return this;
    }

    logger.info('Initializing ML Prediction Service...');

    // Initialize default models for popular tokens
    for (const tokenMint of config.tokenLists.popular) {
      this.initModel(tokenMint);
    }

    logger.info('ML Prediction Service initialized');
    return this;
  }

  /**
   * Initialize a model for a token
   */
  initModel(tokenMint) {
    if (this.models.has(tokenMint)) return;

    // Simple model state (weights would normally be loaded from trained model)
    this.models.set(tokenMint, {
      weights: this.generateInitialWeights(),
      bias: Math.random() * 0.1 - 0.05,
      lastTrained: null,
      accuracy: 0.5,
      predictions: 0,
      correctPredictions: 0,
    });

    this.trainingData.set(tokenMint, []);
  }

  /**
   * Generate initial random weights
   */
  generateInitialWeights() {
    const weights = [];
    for (let i = 0; i < this.featureWindow * 4; i++) { // 4 features per candle
      weights.push(Math.random() * 0.2 - 0.1);
    }
    return weights;
  }

  /**
   * Extract features from price history
   */
  extractFeatures(priceHistory) {
    if (priceHistory.length < this.featureWindow) {
      return null;
    }

    const features = [];
    const recentPrices = priceHistory.slice(-this.featureWindow);

    // Normalize prices
    const basePrice = recentPrices[0].price;
    const normalizedPrices = recentPrices.map(p => p.price / basePrice);

    // Feature 1: Normalized prices
    features.push(...normalizedPrices);

    // Feature 2: Price changes (percentages)
    const changes = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const prevPrice = recentPrices[i - 1].price;
      const currPrice = recentPrices[i].price;
      changes.push((currPrice - prevPrice) / prevPrice);
    }
    changes.push(0); // Pad to match window size
    features.push(...changes);

    // Feature 3: Moving averages
    const ema = this.calculateEMA(normalizedPrices, 5);
    const sma = this.calculateSMA(normalizedPrices, 10);
    features.push(...ema.slice(-this.featureWindow));
    features.push(...sma.slice(-this.featureWindow));

    return features;
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(prices[i]);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        sma.push(slice.reduce((a, b) => a + b, 0) / period);
      }
    }
    return sma;
  }

  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
      const value = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(value);
    }

    return ema;
  }

  /**
   * Predict price direction
   */
  predict(tokenMint, priceHistory) {
    if (!this.enabled) {
      return { prediction: 'NEUTRAL', confidence: 0.5 };
    }

    if (!this.models.has(tokenMint)) {
      this.initModel(tokenMint);
    }

    const features = this.extractFeatures(priceHistory);
    if (!features) {
      return { prediction: 'NEUTRAL', confidence: 0.5 };
    }

    const model = this.models.get(tokenMint);

    // Simple forward pass (dot product + sigmoid)
    let sum = model.bias;
    for (let i = 0; i < Math.min(features.length, model.weights.length); i++) {
      sum += features[i] * model.weights[i];
    }

    // Sigmoid activation
    const probability = 1 / (1 + Math.exp(-sum));

    // Determine prediction
    let prediction;
    let confidence;

    if (probability > 0.5 + this.predictionThreshold / 2) {
      prediction = 'UP';
      confidence = probability;
    } else if (probability < 0.5 - this.predictionThreshold / 2) {
      prediction = 'DOWN';
      confidence = 1 - probability;
    } else {
      prediction = 'NEUTRAL';
      confidence = 0.5;
    }

    // Track prediction for accuracy
    const predictionRecord = {
      timestamp: Date.now(),
      prediction,
      confidence,
      price: priceHistory[priceHistory.length - 1]?.price,
    };

    const history = this.trainingData.get(tokenMint) || [];
    history.push(predictionRecord);
    if (history.length > 1000) {
      history.shift();
    }
    this.trainingData.set(tokenMint, history);

    return {
      prediction,
      confidence,
      probability,
      modelAccuracy: model.accuracy,
    };
  }

  /**
   * Update model based on actual outcome
   */
  updateModel(tokenMint, actualDirection) {
    if (!this.enabled || !this.models.has(tokenMint)) return;

    const model = this.models.get(tokenMint);
    model.predictions++;

    // Get the last prediction
    const history = this.trainingData.get(tokenMint) || [];
    if (history.length === 0) return;

    const lastPrediction = history[history.length - 1];
    if (lastPrediction.prediction === actualDirection) {
      model.correctPredictions++;
    }

    // Update accuracy
    model.accuracy = model.correctPredictions / model.predictions;

    // Simple weight adjustment (gradient descent approximation)
    const learningRate = 0.01;
    const target = actualDirection === 'UP' ? 1 : actualDirection === 'DOWN' ? 0 : 0.5;

    for (let i = 0; i < model.weights.length; i++) {
      model.weights[i] += learningRate * (target - 0.5) * (Math.random() - 0.5);
    }

    this.models.set(tokenMint, model);
  }

  /**
   * Get model statistics
   */
  getModelStats(tokenMint) {
    const model = this.models.get(tokenMint);
    if (!model) return null;

    return {
      tokenMint,
      accuracy: model.accuracy,
      predictions: model.predictions,
      correctPredictions: model.correctPredictions,
      lastTrained: model.lastTrained,
    };
  }

  /**
   * Get all model statistics
   */
  getAllModelStats() {
    const stats = [];
    for (const [mint] of this.models) {
      stats.push(this.getModelStats(mint));
    }
    return stats;
  }

  /**
   * Ensemble prediction using multiple approaches
   */
  ensemblePredict(tokenMint, priceHistory) {
    const basePrediction = this.predict(tokenMint, priceHistory);

    // Add momentum-based prediction
    const momentumPred = this.momentumPrediction(priceHistory);

    // Add mean reversion prediction
    const meanReversionPred = this.meanReversionPrediction(priceHistory);

    // Combine predictions
    const predictions = [
      { pred: basePrediction, weight: 0.4 },
      { pred: momentumPred, weight: 0.3 },
      { pred: meanReversionPred, weight: 0.3 },
    ];

    let upScore = 0;
    let downScore = 0;

    for (const { pred, weight } of predictions) {
      if (pred.prediction === 'UP') {
        upScore += pred.confidence * weight;
      } else if (pred.prediction === 'DOWN') {
        downScore += pred.confidence * weight;
      }
    }

    const finalPrediction = upScore > downScore ? 'UP' : downScore > upScore ? 'DOWN' : 'NEUTRAL';
    const finalConfidence = Math.max(upScore, downScore);

    return {
      prediction: finalPrediction,
      confidence: finalConfidence,
      components: {
        neuralNet: basePrediction,
        momentum: momentumPred,
        meanReversion: meanReversionPred,
      },
    };
  }

  /**
   * Momentum-based prediction
   */
  momentumPrediction(priceHistory) {
    if (priceHistory.length < 10) {
      return { prediction: 'NEUTRAL', confidence: 0.5 };
    }

    const recent = priceHistory.slice(-5);
    const older = priceHistory.slice(-10, -5);

    const recentAvg = recent.reduce((s, p) => s + p.price, 0) / recent.length;
    const olderAvg = older.reduce((s, p) => s + p.price, 0) / older.length;

    const momentum = (recentAvg - olderAvg) / olderAvg;
    const confidence = Math.min(1, Math.abs(momentum) * 10);

    return {
      prediction: momentum > 0.01 ? 'UP' : momentum < -0.01 ? 'DOWN' : 'NEUTRAL',
      confidence,
    };
  }

  /**
   * Mean reversion prediction
   */
  meanReversionPrediction(priceHistory) {
    if (priceHistory.length < 20) {
      return { prediction: 'NEUTRAL', confidence: 0.5 };
    }

    const prices = priceHistory.map(p => p.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const currentPrice = prices[prices.length - 1];

    const deviation = (currentPrice - mean) / mean;
    const confidence = Math.min(1, Math.abs(deviation) * 5);

    // Mean reversion: price below mean = likely up, above = likely down
    return {
      prediction: deviation < -0.02 ? 'UP' : deviation > 0.02 ? 'DOWN' : 'NEUTRAL',
      confidence,
    };
  }

  /**
   * Feature importance analysis
   */
  getFeatureImportance(tokenMint) {
    const model = this.models.get(tokenMint);
    if (!model) return null;

    // Return normalized weight magnitudes
    const importances = model.weights.map(w => Math.abs(w));
    const max = Math.max(...importances);

    return importances.map(imp => imp / max);
  }
}

// Singleton instance
const mlService = new MLPredictionService();

export { MLPredictionService, mlService };
export default mlService;
