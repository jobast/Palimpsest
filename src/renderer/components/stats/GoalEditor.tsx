import { useState, useEffect } from 'react'
import { X, Target, Clock } from 'lucide-react'
import { useStatsStore } from '@/stores/statsStore'

interface GoalEditorProps {
  onClose: () => void
}

/**
 * GoalEditor Component
 *
 * Modal for editing all writing goals:
 * - Daily word count goal
 * - Daily time goal (optional)
 * - Project total word count goal
 */
export function GoalEditor({ onClose }: GoalEditorProps) {
  const { goals, updateGoal } = useStatsStore()

  const dailyGoal = goals.find(g => g.type === 'daily')
  const projectGoal = goals.find(g => g.type === 'project')

  // Daily goals
  const [dailyWords, setDailyWords] = useState<string>(
    dailyGoal?.target && dailyGoal.target > 0 ? dailyGoal.target.toString() : ''
  )
  const [dailyTimeHours, setDailyTimeHours] = useState<string>(
    dailyGoal?.timeTarget && dailyGoal.timeTarget > 0 ? Math.floor(dailyGoal.timeTarget / 60).toString() : ''
  )
  const [dailyTimeMinutes, setDailyTimeMinutes] = useState<string>(
    dailyGoal?.timeTarget && dailyGoal.timeTarget > 0 ? (dailyGoal.timeTarget % 60).toString() : ''
  )

  // Project goal
  const [projectWords, setProjectWords] = useState<string>(
    projectGoal?.target && projectGoal.target > 0 ? projectGoal.target.toString() : ''
  )

  const handleSave = () => {
    // Update daily goal
    const dailyWordsNum = parseInt(dailyWords) || 0
    const timeHours = parseInt(dailyTimeHours) || 0
    const timeMinutes = parseInt(dailyTimeMinutes) || 0
    const totalTimeMinutes = timeHours * 60 + timeMinutes

    if (dailyWordsNum > 0 || totalTimeMinutes > 0) {
      updateGoal('daily', dailyWordsNum, totalTimeMinutes > 0 ? totalTimeMinutes : undefined)
    }

    // Update project goal
    const projectWordsNum = parseInt(projectWords) || 0
    if (projectWordsNum > 0) {
      updateGoal('project', projectWordsNum)
    }

    onClose()
  }

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-card rounded-lg shadow-xl border border-border w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-medium flex items-center gap-2">
              <Target size={18} />
              Définir les objectifs
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Daily Goals Section */}
            <section>
              <h3 className="text-sm font-medium mb-3">Objectifs quotidiens</h3>

              {/* Daily word count */}
              <div className="mb-4">
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Nombre de mots par jour
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dailyWords}
                  onChange={(e) => setDailyWords(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>

              {/* Daily time goal */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Clock size={12} />
                  Temps d'écriture par jour (optionnel)
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={dailyTimeHours}
                      onChange={(e) => setDailyTimeHours(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">heures</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={dailyTimeMinutes}
                      onChange={(e) => setDailyTimeMinutes(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">minutes</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Project Goal Section */}
            <section>
              <h3 className="text-sm font-medium mb-3">Objectif du projet</h3>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Nombre total de mots
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={projectWords}
                  onChange={(e) => setProjectWords(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
