import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIProvider } from '@shared/types/project'

export type AIModel =
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'ollama-local'

export interface ModelInfo {
  id: AIModel
  name: string
  provider: AIProvider
  inputCost: number  // per 1M tokens (0 for local)
  outputCost: number // per 1M tokens (0 for local)
  contextWindow?: number // in tokens
}

export const AI_MODELS: ModelInfo[] = [
  // Claude models
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude', inputCost: 3, outputCost: 15, contextWindow: 200000 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude', inputCost: 3, outputCost: 15, contextWindow: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'claude', inputCost: 0.8, outputCost: 4, contextWindow: 200000 },
  // OpenAI models
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', inputCost: 2.5, outputCost: 10, contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', inputCost: 0.15, outputCost: 0.6, contextWindow: 128000 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', inputCost: 10, outputCost: 30, contextWindow: 128000 },
  // Local models via Ollama
  { id: 'ollama-local', name: 'Ollama (Local)', provider: 'ollama', inputCost: 0, outputCost: 0, contextWindow: 32000 }
]

// Token usage tracking for session
interface SessionUsage {
  inputTokens: number
  outputTokens: number
  totalCost: number  // in USD
  requestCount: number
}

interface AIState {
  // API Keys (stored securely)
  claudeApiKey: string
  openaiApiKey: string
  ollamaEndpoint: string  // URL for Ollama API (default: http://localhost:11434)
  ollamaModel: string     // Selected Ollama model name

  // Selected provider and model
  selectedProvider: AIProvider
  selectedModel: AIModel

  // UI preferences
  advancedMode: boolean

  // Request state
  isLoading: boolean
  lastError: string | null

  // Session usage tracking
  sessionUsage: SessionUsage

  // Actions
  setClaudeApiKey: (key: string) => void
  setOpenaiApiKey: (key: string) => void
  setOllamaEndpoint: (endpoint: string) => void
  setOllamaModel: (model: string) => void
  setSelectedProvider: (provider: AIProvider) => void
  setSelectedModel: (model: AIModel) => void
  setAdvancedMode: (enabled: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Usage tracking
  addUsage: (inputTokens: number, outputTokens: number) => void
  resetSessionUsage: () => void

  // Helpers
  hasValidApiKey: () => boolean
  getActiveApiKey: () => string
  getModelInfo: () => ModelInfo | undefined
  estimateCost: (inputTokens: number, outputTokens: number) => number
  formatCost: (cost: number) => string
}

const initialSessionUsage: SessionUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalCost: 0,
  requestCount: 0
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // Initial state
      claudeApiKey: '',
      openaiApiKey: '',
      ollamaEndpoint: 'http://localhost:11434',
      ollamaModel: 'qwen2.5:72b',
      selectedProvider: 'claude',
      selectedModel: 'claude-sonnet-4-20250514',
      advancedMode: false,
      isLoading: false,
      lastError: null,
      sessionUsage: initialSessionUsage,

      // Setters
      setClaudeApiKey: (key) => set({ claudeApiKey: key }),
      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      setOllamaEndpoint: (endpoint) => set({ ollamaEndpoint: endpoint }),
      setOllamaModel: (model) => set({ ollamaModel: model }),

      setSelectedProvider: (provider) => {
        // Auto-select a default model for the provider
        let defaultModel: AIModel
        if (provider === 'claude') {
          defaultModel = 'claude-sonnet-4-20250514'
        } else if (provider === 'openai') {
          defaultModel = 'gpt-4o'
        } else {
          defaultModel = 'ollama-local'
        }
        set({ selectedProvider: provider, selectedModel: defaultModel })
      },

      setSelectedModel: (model) => {
        // Auto-update provider based on model
        const modelInfo = AI_MODELS.find(m => m.id === model)
        if (modelInfo) {
          set({ selectedModel: model, selectedProvider: modelInfo.provider })
        }
      },

      setAdvancedMode: (enabled) => set({ advancedMode: enabled }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ lastError: error }),

      // Usage tracking
      addUsage: (inputTokens, outputTokens) => {
        const { sessionUsage, getModelInfo } = get()
        const modelInfo = getModelInfo()
        const cost = modelInfo
          ? (inputTokens * modelInfo.inputCost + outputTokens * modelInfo.outputCost) / 1_000_000
          : 0

        set({
          sessionUsage: {
            inputTokens: sessionUsage.inputTokens + inputTokens,
            outputTokens: sessionUsage.outputTokens + outputTokens,
            totalCost: sessionUsage.totalCost + cost,
            requestCount: sessionUsage.requestCount + 1
          }
        })
      },

      resetSessionUsage: () => set({ sessionUsage: initialSessionUsage }),

      // Helpers
      hasValidApiKey: () => {
        const { selectedProvider, claudeApiKey, openaiApiKey, ollamaEndpoint } = get()
        if (selectedProvider === 'claude') {
          return claudeApiKey.startsWith('sk-ant-')
        } else if (selectedProvider === 'openai') {
          return openaiApiKey.startsWith('sk-')
        } else {
          // Ollama just needs a valid endpoint
          return ollamaEndpoint.length > 0
        }
      },

      getActiveApiKey: () => {
        const { selectedProvider, claudeApiKey, openaiApiKey } = get()
        return selectedProvider === 'claude' ? claudeApiKey : openaiApiKey
      },

      getModelInfo: () => {
        const { selectedModel } = get()
        return AI_MODELS.find(m => m.id === selectedModel)
      },

      estimateCost: (inputTokens, outputTokens) => {
        const modelInfo = get().getModelInfo()
        if (!modelInfo) return 0
        return (inputTokens * modelInfo.inputCost + outputTokens * modelInfo.outputCost) / 1_000_000
      },

      formatCost: (cost) => {
        if (cost === 0) return 'Gratuit'
        if (cost < 0.01) return `< $0.01`
        return `$${cost.toFixed(2)}`
      }
    }),
    {
      name: 'palimpseste-ai-settings',
      partialize: (state) => ({
        claudeApiKey: state.claudeApiKey,
        openaiApiKey: state.openaiApiKey,
        ollamaEndpoint: state.ollamaEndpoint,
        ollamaModel: state.ollamaModel,
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
        advancedMode: state.advancedMode
      })
    }
  )
)
