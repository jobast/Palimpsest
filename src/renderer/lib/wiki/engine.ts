import { isCliEngine } from '@shared/wiki'
import { createAIClientFromStore } from '@/lib/ai/client'
import { useAIStore } from '@/stores/aiStore'
import { useUIStore } from '@/stores/uiStore'

/** Run the configured analysis engine. API -> ai:chat ; CLI -> main spawn. Returns text. */
export async function runEngine(system: string, user: string): Promise<string> {
  const engineId = useUIStore.getState().analysisEngine
  if (isCliEngine(engineId)) {
    const res = await window.electronAPI.runWikiEngine({ engineId, prompt: `${system}\n\n${user}` })
    if (!res.ok || !res.text) throw new Error(res.error || 'Echec du moteur CLI')
    return res.text
  }
  // API engine: use the configured provider/model.
  const client = createAIClientFromStore()
  const model = useAIStore.getState().selectedModel
  const res = await client.chat({ model, systemPrompt: system, messages: [{ role: 'user', content: user }] })
  return res.content
}

export async function detectEngines(): Promise<string[]> {
  const res = await window.electronAPI.detectWikiEngines()
  return res.available
}
