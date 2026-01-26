import type { AIProvider } from '@shared/types/project'
import type { AIModel } from '@/stores/aiStore'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequestOptions {
  model: AIModel
  messages: AIMessage[]
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface AIResponse {
  content: string
  tokensUsed: {
    input: number
    output: number
  }
  model: string
}

export interface AIError {
  code: string
  message: string
}

export interface OllamaConfig {
  endpoint: string
  model: string
}

/**
 * Unified AI client that works with Claude, OpenAI, and Ollama
 */
export class AIClient {
  private provider: AIProvider
  private apiKey: string
  private ollamaConfig?: OllamaConfig

  constructor(provider: AIProvider, apiKey: string, ollamaConfig?: OllamaConfig) {
    this.provider = provider
    this.apiKey = apiKey
    this.ollamaConfig = ollamaConfig
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    if (this.provider === 'claude') {
      return this.chatClaude(options)
    } else if (this.provider === 'openai') {
      return this.chatOpenAI(options)
    } else {
      return this.chatOllama(options)
    }
  }

  private async chatClaude(options: AIRequestOptions): Promise<AIResponse> {
    const { model, messages, maxTokens = 4096, temperature = 0.7, systemPrompt } = options

    // Separate system message from other messages
    const systemMessage = systemPrompt || messages.find(m => m.role === 'system')?.content
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMessage,
        messages: chatMessages
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(error.error?.message || `Claude API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      content: data.content[0]?.text || '',
      tokensUsed: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0
      },
      model: data.model
    }
  }

  private async chatOpenAI(options: AIRequestOptions): Promise<AIResponse> {
    const { model, messages, maxTokens = 4096, temperature = 0.7, systemPrompt } = options

    // Add system prompt as first message if provided
    const allMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages.filter(m => m.role !== 'system')]
      : messages

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: allMessages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsed: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0
      },
      model: data.model
    }
  }

  private async chatOllama(options: AIRequestOptions): Promise<AIResponse> {
    if (!this.ollamaConfig) {
      throw new Error('Ollama configuration required')
    }

    const { messages, maxTokens = 4096, temperature = 0.7, systemPrompt } = options
    const { endpoint, model } = this.ollamaConfig

    // Format messages for Ollama (OpenAI-compatible format)
    const allMessages = systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }, ...messages.filter(m => m.role !== 'system')]
      : messages

    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: allMessages.map(m => ({
          role: m.role,
          content: m.content
        })),
        options: {
          temperature,
          num_predict: maxTokens
        },
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(error.error || `Ollama API error: ${response.status}`)
    }

    const data = await response.json()

    // Ollama doesn't provide token counts in non-streaming mode reliably
    // Estimate based on ~4 chars per token
    const inputText = allMessages.map(m => m.content).join(' ')
    const outputText = data.message?.content || ''
    const estimatedInputTokens = Math.ceil(inputText.length / 4)
    const estimatedOutputTokens = Math.ceil(outputText.length / 4)

    return {
      content: outputText,
      tokensUsed: {
        input: data.prompt_eval_count || estimatedInputTokens,
        output: data.eval_count || estimatedOutputTokens
      },
      model
    }
  }
}

/**
 * Create an AI client from the current store settings
 */
export function createAIClient(
  provider: AIProvider,
  apiKey: string,
  ollamaConfig?: OllamaConfig
): AIClient {
  return new AIClient(provider, apiKey, ollamaConfig)
}

/**
 * Create an AI client using the current aiStore settings
 * This handles Ollama configuration automatically
 */
export function createAIClientFromStore(): AIClient {
  // Import dynamically to avoid circular deps
  const { useAIStore } = require('@/stores/aiStore')
  const store = useAIStore.getState()

  const ollamaConfig: OllamaConfig | undefined = store.selectedProvider === 'ollama'
    ? { endpoint: store.ollamaEndpoint, model: store.ollamaModel }
    : undefined

  return new AIClient(
    store.selectedProvider,
    store.getActiveApiKey(),
    ollamaConfig
  )
}
