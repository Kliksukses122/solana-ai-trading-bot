/**
 * Wallet Service - Solana wallet management
 * Handles keypair creation, balance checking, and transaction signing
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

class WalletService {
  constructor() {
    this.connection = null;
    this.keypair = null;
    this.publicKey = null;
    this.mockMode = config.bot.mockMode;
  }

  async initialize() {
    logger.info('Initializing Wallet Service...');

    // Create connection
    this.connection = new Connection(config.solana.rpcUrl, {
      commitment: config.solana.commitment,
      maxRetries: config.solana.maxRetries,
    });

    // Load keypair
    if (config.wallet.privateKey) {
      try {
        const secretKey = bs58.decode(config.wallet.privateKey);
        this.keypair = Keypair.fromSecretKey(secretKey);
        this.publicKey = this.keypair.publicKey;
        logger.info('Wallet loaded', { address: this.publicKey.toBase58() });
      } catch (error) {
        logger.error('Failed to load keypair', { error: error.message });
        if (!this.mockMode) {
          throw error;
        }
      }
    } else if (this.mockMode) {
      // Generate random keypair for mock mode
      this.keypair = Keypair.generate();
      this.publicKey = this.keypair.publicKey;
      logger.warn('Using random keypair in mock mode', { address: this.publicKey.toBase58() });
    } else {
      throw new Error('No private key provided and not in mock mode');
    }

    return this;
  }

  // Get SOL balance
  async getBalance() {
    if (this.mockMode) {
      return 100 * LAMPORTS_PER_SOL; // 100 SOL in mock mode
    }

    try {
      const balance = await this.connection.getBalance(this.publicKey);
      return balance;
    } catch (error) {
      logger.error('Failed to get balance', { error: error.message });
      throw error;
    }
  }

  // Get SOL balance in SOL
  async getBalanceSol() {
    const balance = await this.getBalance();
    return balance / LAMPORTS_PER_SOL;
  }

  // Get token accounts
  async getTokenAccounts(tokenMint) {
    if (this.mockMode) {
      return [];
    }

    try {
      const { getTokenAccountsByOwner } = await import('@solana/spl-token');
      const accounts = await getTokenAccountsByOwner(
        this.connection,
        this.publicKey,
        new PublicKey(tokenMint)
      );
      return accounts.value;
    } catch (error) {
      logger.error('Failed to get token accounts', { error: error.message });
      return [];
    }
  }

  // Get token balance
  async getTokenBalance(tokenMint) {
    if (this.mockMode) {
      return 1000000; // Mock balance
    }

    const accounts = await this.getTokenAccounts(tokenMint);
    if (accounts.length === 0) {
      return 0;
    }

    const { AccountLayout } = await import('@solana/spl-token');
    const accountData = AccountLayout.decode(accounts[0].account.data);
    return Number(accountData.amount);
  }

  // Sign transaction
  async signTransaction(transaction) {
    if (!this.keypair) {
      throw new Error('Keypair not initialized');
    }

    try {
      if (transaction instanceof VersionedTransaction) {
        transaction.sign([this.keypair]);
      } else {
        transaction.partialSign(this.keypair);
      }
      return transaction;
    } catch (error) {
      logger.error('Failed to sign transaction', { error: error.message });
      throw error;
    }
  }

  // Sign multiple transactions
  async signAllTransactions(transactions) {
    const signedTransactions = [];
    for (const tx of transactions) {
      const signed = await this.signTransaction(tx);
      signedTransactions.push(signed);
    }
    return signedTransactions;
  }

  // Send transaction
  async sendTransaction(transaction) {
    if (this.mockMode) {
      const mockTxId = `mock_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      logger.info('Mock transaction sent', { txId: mockTxId });
      return mockTxId;
    }

    try {
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: config.solana.maxRetries,
        }
      );
      logger.info('Transaction sent', { signature });
      return signature;
    } catch (error) {
      logger.error('Failed to send transaction', { error: error.message });
      throw error;
    }
  }

  // Confirm transaction
  async confirmTransaction(signature, timeout = 60000) {
    if (this.mockMode) {
      return { confirmed: true, slot: Math.floor(Math.random() * 1000000) };
    }

    try {
      const result = await this.connection.confirmTransaction(
        signature,
        config.solana.commitment
      );
      return {
        confirmed: !result.value.err,
        slot: result.value.slot,
        err: result.value.err,
      };
    } catch (error) {
      logger.error('Failed to confirm transaction', { error: error.message });
      throw error;
    }
  }

  // Send and confirm transaction
  async sendAndConfirmTransaction(transaction) {
    const signature = await this.sendTransaction(transaction);
    const result = await this.confirmTransaction(signature);
    return { signature, ...result };
  }

  // Get recent blockhash
  async getRecentBlockhash() {
    try {
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash();
      return { blockhash, lastValidBlockHeight };
    } catch (error) {
      logger.error('Failed to get recent blockhash', { error: error.message });
      throw error;
    }
  }

  // Get account info
  async getAccountInfo(publicKey) {
    try {
      return await this.connection.getAccountInfo(
        new PublicKey(publicKey),
        config.solana.commitment
      );
    } catch (error) {
      logger.error('Failed to get account info', { error: error.message });
      throw error;
    }
  }

  // Get current slot
  async getSlot() {
    try {
      return await this.connection.getSlot();
    } catch (error) {
      logger.error('Failed to get slot', { error: error.message });
      return 0;
    }
  }

  // Validate address
  isValidAddress(address) {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Get wallet status
  getStatus() {
    return {
      address: this.publicKey?.toBase58() || null,
      mockMode: this.mockMode,
      initialized: !!this.keypair,
    };
  }
}

// Singleton instance
const walletService = new WalletService();

export { WalletService, walletService };
export default walletService;
