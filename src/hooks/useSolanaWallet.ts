'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js'

// Treasury wallet address (where deposits go)
const TREASURY_WALLET = new PublicKey('FfZsEWdFdAfUkPJ3Zq45PxeZQGXb9f68HHGFJs9rKuE')

export interface WalletState {
  connected: boolean
  connecting: boolean
  address: string | null
  balance: number
  error: string | null
}

export function useSolanaWallet() {
  const { connection } = useConnection()
  const wallet = useWallet()
  
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  // Fetch balance when wallet connects
  useEffect(() => {
    const fetchBalance = async () => {
      if (wallet.publicKey && connection) {
        try {
          const bal = await connection.getBalance(wallet.publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
        } catch (err) {
          console.error('Failed to fetch balance:', err)
        }
      }
    }
    
    fetchBalance()
    
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [wallet.publicKey, connection])

  // Deposit SOL to treasury
  const deposit = useCallback(async (amount: number) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected')
      return null
    }

    if (amount <= 0) {
      setError('Invalid amount')
      return null
    }

    setLoading(true)
    setError(null)
    setTxSignature(null)

    try {
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL)
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: TREASURY_WALLET,
          lamports,
        })
      )

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = wallet.publicKey

      // Sign and send transaction
      const signedTx = await wallet.signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTx.serialize())
      
      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      })

      setTxSignature(signature)
      
      // Refresh balance
      const newBal = await connection.getBalance(wallet.publicKey)
      setBalance(newBal / LAMPORTS_PER_SOL)
      
      setLoading(false)
      return signature
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed'
      setError(errorMessage)
      setLoading(false)
      return null
    }
  }, [wallet, connection])

  // Withdraw SOL (transfer from treasury to user - requires backend signing)
  // For security, withdrawals should be processed by a backend service
  const requestWithdraw = useCallback(async (amount: number) => {
    // In a real implementation, this would call your backend API
    // The backend would verify the user's balance and sign the transaction
    setError('Withdrawals require backend processing. Please contact support.')
    return null
  }, [])

  return {
    // Wallet state
    connected: wallet.connected,
    connecting: wallet.connecting,
    address: wallet.publicKey?.toBase58() || null,
    balance,
    
    // Wallet actions
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    select: wallet.select,
    
    // Transaction state
    loading,
    error,
    txSignature,
    
    // Transaction actions
    deposit,
    requestWithdraw,
    
    // Reset
    clearError: () => setError(null),
  }
}
