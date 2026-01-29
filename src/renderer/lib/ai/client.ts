import type { AIProvider } from '@shared/types/project'
import type { AIModel } from '@/stores/aiStore'
import { useAIStore } from '@/stores/aiStore'

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
 * Unified AI client that proxies requests through Electron main.
 * Keys never leave the main process.
 */
export class AIClient {
  private provider: AIProvider
  private ollamaConfig?: OllamaConfig

  constructor(provider: AIProvider, _apiKey: string, ollamaConfig?: OllamaConfig) {
    this.provider = provider
    this.ollamaConfig = ollamaConfig
    void _apiKey
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    if (!window?.electronAPI?.aiChat) {
      throw new Error('Fonctionnalites IA disponibles uniquement dans Electron')
    }

    if (this.provider === 'ollama' && !this.ollamaConfig) {
      throw new Error('Configuration Ollama requise')
    }

    return window.electronAPI.aiChat({
      provider: this.provider,
      model: options.model,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
      ollamaConfig: this.provider === 'ollama' ? this.ollamaConfig : undefined
    })
  }
}

/**
 * Create an AI client from explicit settings
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
 */
export function createAIClientFromStore(): AIClient {
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
