'use client'

import { FC, ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider as WalletAdapterProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

interface Props {
  children: ReactNode
}

export const WalletProvider: FC<Props> = ({ children }) => {
  // Use Helius RPC for mainnet (from .env)
  // Falls back to devnet if not configured
  const endpoint = useMemo(() => {
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT
    if (rpcEndpoint) {
      console.log('Using custom RPC endpoint')
      return rpcEndpoint
    }
    
    // Fallback to devnet
    console.log('Using devnet fallback')
    return clusterApiUrl('devnet')
  }, [])

  // Configure supported wallets
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], [])

  return (
    <ConnectionProvider 
      endpoint={endpoint} 
      config={{ 
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      }}
    >
      <WalletAdapterProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletAdapterProvider>
    </ConnectionProvider>
  )
}
