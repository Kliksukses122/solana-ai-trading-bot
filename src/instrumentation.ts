export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[INSTRUMENTATION] Server starting...')
    
    const { startBot } = await import('./lib/auto-trading-bot')
    
    setTimeout(() => {
      console.log('[INSTRUMENTATION] Starting auto-trading bot...')
      const started = startBot()
      console.log(started ? '[INSTRUMENTATION] ✅ Bot started!' : '[INSTRUMENTATION] ⚠️ Bot failed - check TREASURY_PRIVATE_KEY')
    }, 5000)
  }
}
