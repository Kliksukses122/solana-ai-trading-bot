export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Bot] Starting Real Trading Bot...')
    console.log('[Bot] Wallet configured:', !!process.env.TREASURY_PRIVATE_KEY)
  }
}
