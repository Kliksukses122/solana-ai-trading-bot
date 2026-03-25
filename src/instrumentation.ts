export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Server] Starting Solana AI Trading Bot...')
    console.log('[Server] OpenAI API configured:', !!process.env.OPENAI_API_KEY)
  }
}
