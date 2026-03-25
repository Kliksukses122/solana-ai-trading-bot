/**
 * Unified AI Service
 * Supports OpenAI API for production deployment
 */

import OpenAI from 'openai'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!OPENAI_API_KEY) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY })
  }
  return openaiClient
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<{ content: string; success: boolean; error?: string }> {
  const client = getOpenAIClient()
  if (!client) return { content: '', success: false, error: 'No OpenAI API key' }
  
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 500,
    })
    return { content: completion.choices[0]?.message?.content || '', success: true }
  } catch (error: any) {
    return { content: '', success: false, error: error.message }
  }
}

export function parseJSONFromResponse<T>(response: string): T | null {
  try {
    const match = response.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as T
  } catch (e) {}
  return null
}

export function isAIAvailable(): boolean {
  return !!OPENAI_API_KEY
}
