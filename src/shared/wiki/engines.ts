export type EngineId = 'api' | 'claude' | 'codex' | 'gemini'

export interface CliEngine { id: Exclude<EngineId, 'api'>; label: string; bin: string; args: string[] }

/** CLI engines that use the user's subscription (prompt is fed via STDIN, never as an arg). */
export const CLI_ENGINES: CliEngine[] = [
  { id: 'claude', label: 'Claude (abonnement)', bin: 'claude', args: ['-p'] },
  { id: 'codex', label: 'ChatGPT / Codex (abonnement)', bin: 'codex', args: ['exec'] },
  { id: 'gemini', label: 'Gemini (abonnement)', bin: 'gemini', args: ['-p'] }
]

export function isCliEngine(id: string): boolean {
  return CLI_ENGINES.some(e => e.id === id)
}

/** Base spawn command for a CLI engine (no prompt - prompt is written to stdin). */
export function engineCommand(id: string): { bin: string; args: string[] } | null {
  const e = CLI_ENGINES.find(x => x.id === id)
  return e ? { bin: e.bin, args: [...e.args] } : null
}
