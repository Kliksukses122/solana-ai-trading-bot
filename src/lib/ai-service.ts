const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; success: boolean; error?: string }> {
  if (!OPENAI_API_KEY) {
    return { content: '', success: false, error: 'OPENAI_API_KEY not configured' }
  }
  
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 500,
      })
    })
    
    if (!response.ok) return { content: '', success: false, error: `API error: ${response.status}` }
    
    const data = await response.json()
    return { content: data.choices?.[0]?.message?.content || '', success: true }
  } catch (error: any) {
    return { content: '', success: false, error: error.message }
  }
}

export function isAIAvailable(): boolean {
  return !!OPENAI_API_KEY
}

export function parseJSONFromResponse<T>(response: string): T | null {
  try {
    const match = response.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as T
  } catch {}
  return null
}

export const AIService = { createChatCompletion, isAIAvailable, parseJSONFromResponse }
export default AIService
