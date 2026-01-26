import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useAIStore, AI_MODELS } from '@/stores/aiStore'
import { X, Sun, Moon, Monitor, Save, Bot, Eye, EyeOff, CheckCircle, AlertCircle, Server } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SettingsModal() {
  const {
    settingsOpen,
    closeSettings,
    theme,
    setTheme,
    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveInterval,
    setAutoSaveInterval
  } = useUIStore()

  const [activeTab, setActiveTab] = useState<'general' | 'ai'>('general')

  if (!settingsOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeSettings}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Parametres</h2>
          <button
            onClick={closeSettings}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'general'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
              activeTab === 'ai'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Bot size={16} />
            Intelligence Artificielle
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-auto">
          {activeTab === 'general' && (
            <>
              {/* Theme section */}
              <div>
                <h3 className="text-sm font-medium mb-3">Apparence</h3>
                <div className="flex gap-2">
                  <ThemeButton
                    icon={<Sun size={18} />}
                    label="Clair"
                    active={theme === 'light'}
                    onClick={() => setTheme('light')}
                  />
                  <ThemeButton
                    icon={<Moon size={18} />}
                    label="Sombre"
                    active={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                  />
                  <ThemeButton
                    icon={<Monitor size={18} />}
                    label="Systeme"
                    active={theme === 'system'}
                    onClick={() => setTheme('system')}
                  />
                </div>
              </div>

              {/* Auto-save section */}
              <div>
                <h3 className="text-sm font-medium mb-3">Sauvegarde automatique</h3>

                {/* Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Save size={16} className="text-muted-foreground" />
                    <span className="text-sm">Activer la sauvegarde automatique</span>
                  </div>
                  <ToggleSwitch
                    enabled={autoSaveEnabled}
                    onChange={setAutoSaveEnabled}
                  />
                </div>

                {/* Interval selector */}
                {autoSaveEnabled && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Intervalle de sauvegarde
                    </label>
                    <div className="flex gap-2">
                      <IntervalButton
                        label="15s"
                        active={autoSaveInterval === 15}
                        onClick={() => setAutoSaveInterval(15)}
                      />
                      <IntervalButton
                        label="30s"
                        active={autoSaveInterval === 30}
                        onClick={() => setAutoSaveInterval(30)}
                      />
                      <IntervalButton
                        label="1min"
                        active={autoSaveInterval === 60}
                        onClick={() => setAutoSaveInterval(60)}
                      />
                      <IntervalButton
                        label="2min"
                        active={autoSaveInterval === 120}
                        onClick={() => setAutoSaveInterval(120)}
                      />
                      <IntervalButton
                        label="5min"
                        active={autoSaveInterval === 300}
                        onClick={() => setAutoSaveInterval(300)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'ai' && <AISettingsSection />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Les parametres sont sauvegardes automatiquement
          </p>
        </div>
      </div>
    </div>
  )
}

function ThemeButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function IntervalButton({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-2 px-3 rounded-lg border text-sm transition-colors',
        active
          ? 'border-primary bg-primary/5 text-primary font-medium'
          : 'border-border hover:border-primary/50 text-muted-foreground'
      )}
    >
      {label}
    </button>
  )
}

function ToggleSwitch({
  enabled,
  onChange
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-11 h-6 rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-muted'
      )}
    >
      <div
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

function AISettingsSection() {
  const {
    claudeApiKey,
    openaiApiKey,
    ollamaEndpoint,
    ollamaModel,
    selectedProvider,
    selectedModel,
    advancedMode,
    setClaudeApiKey,
    setOpenaiApiKey,
    setOllamaEndpoint,
    setOllamaModel,
    setSelectedModel,
    setAdvancedMode,
    hasValidApiKey
  } = useAIStore()

  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle')

  const claudeModels = AI_MODELS.filter(m => m.provider === 'claude')
  const openaiModels = AI_MODELS.filter(m => m.provider === 'openai')

  const isClaudeKeyValid = claudeApiKey.startsWith('sk-ant-')
  const isOpenaiKeyValid = openaiApiKey.startsWith('sk-')

  // Check Ollama connection
  const checkOllamaConnection = async () => {
    setOllamaStatus('checking')
    try {
      const response = await fetch(`${ollamaEndpoint}/api/tags`)
      if (response.ok) {
        setOllamaStatus('connected')
      } else {
        setOllamaStatus('error')
      }
    } catch {
      setOllamaStatus('error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>BYOK</strong> (Bring Your Own Key) : Entrez vos cles API pour utiliser les fonctionnalites IA.
          Vos cles sont stockees localement et ne sont jamais partagees.
        </p>
      </div>

      {/* Claude API Key */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Cle API Claude (Anthropic)</label>
          {claudeApiKey && (
            isClaudeKeyValid ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={12} />
                Valide
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={12} />
                Format invalide
              </span>
            )
          )}
        </div>
        <div className="relative">
          <input
            type={showClaudeKey ? 'text' : 'password'}
            value={claudeApiKey}
            onChange={(e) => setClaudeApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => setShowClaudeKey(!showClaudeKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showClaudeKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Obtenez votre cle sur{' '}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.anthropic.com
          </a>
        </p>
      </div>

      {/* OpenAI API Key */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Cle API OpenAI</label>
          {openaiApiKey && (
            isOpenaiKeyValid ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle size={12} />
                Valide
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={12} />
                Format invalide
              </span>
            )
          )}
        </div>
        <div className="relative">
          <input
            type={showOpenaiKey ? 'text' : 'password'}
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => setShowOpenaiKey(!showOpenaiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Obtenez votre cle sur{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            platform.openai.com
          </a>
        </p>
      </div>

      {/* Ollama (Local) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Server size={14} />
            Ollama (LLM local)
          </label>
          {ollamaStatus === 'connected' && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle size={12} />
              Connecte
            </span>
          )}
          {ollamaStatus === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={12} />
              Non disponible
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={ollamaEndpoint}
              onChange={(e) => setOllamaEndpoint(e.target.value)}
              placeholder="http://localhost:11434"
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={checkOllamaConnection}
              disabled={ollamaStatus === 'checking'}
              className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              {ollamaStatus === 'checking' ? 'Test...' : 'Tester'}
            </button>
          </div>
          <input
            type="text"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="qwen2.5:72b"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Installez Ollama depuis{' '}
          <a
            href="https://ollama.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            ollama.ai
          </a>
          {' '}- Modeles recommandes: qwen2.5:72b, mixtral:8x7b
        </p>
      </div>

      {/* Model selection */}
      <div>
        <label className="text-sm font-medium mb-2 block">Modele par defaut</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value as typeof selectedModel)}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <optgroup label="Claude (Anthropic)">
            {claudeModels.map(model => (
              <option key={model.id} value={model.id} disabled={!isClaudeKeyValid}>
                {model.name} (${model.inputCost}/$1M in, ${model.outputCost}/$1M out)
              </option>
            ))}
          </optgroup>
          <optgroup label="GPT (OpenAI)">
            {openaiModels.map(model => (
              <option key={model.id} value={model.id} disabled={!isOpenaiKeyValid}>
                {model.name} (${model.inputCost}/$1M in, ${model.outputCost}/$1M out)
              </option>
            ))}
          </optgroup>
          <optgroup label="Local (Ollama)">
            <option value="ollama-local" disabled={ollamaStatus !== 'connected'}>
              {ollamaModel} (Gratuit - local)
            </option>
          </optgroup>
        </select>
      </div>

      {/* Advanced mode toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Mode avance</span>
          <p className="text-xs text-muted-foreground">
            Voir et modifier les prompts avant envoi
          </p>
        </div>
        <ToggleSwitch enabled={advancedMode} onChange={setAdvancedMode} />
      </div>

      {/* Status */}
      {!hasValidApiKey() && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-xs text-destructive">
            {selectedProvider === 'ollama'
              ? 'Connectez-vous a Ollama pour utiliser les modeles locaux.'
              : `Entrez une cle API valide pour ${selectedProvider === 'claude' ? 'Claude' : 'OpenAI'} pour utiliser les fonctionnalites IA.`
            }
          </p>
        </div>
      )}
    </div>
  )
}

