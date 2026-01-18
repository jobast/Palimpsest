import { useUIStore } from '@/stores/uiStore'
import { X, Sun, Moon, Monitor, Save } from 'lucide-react'
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

  if (!settingsOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeSettings}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Paramètres</h2>
          <button
            onClick={closeSettings}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
                label="Système"
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
              <button
                onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors',
                  autoSaveEnabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Les paramètres sont sauvegardés automatiquement
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
