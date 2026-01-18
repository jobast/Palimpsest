import { useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { defaultTemplates } from '@shared/types/templates'
import { FolderOpen, Plus, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

export function WelcomeScreen() {
  const [showNewProject, setShowNewProject] = useState(false)
  const { openProject } = useProjectStore()

  if (showNewProject) {
    return <NewProjectForm onCancel={() => setShowNewProject(false)} />
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background">
      {/* Title bar drag region */}
      <div className="fixed top-0 left-0 right-0 h-8 titlebar-drag-region" />

      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold text-foreground mb-2">Palimpseste</h1>
        <p className="text-muted-foreground">Traitement de texte pour écrivains</p>
      </div>

      <div className="flex gap-4">
        <WelcomeButton
          icon={<Plus size={24} />}
          label="Nouveau projet"
          onClick={() => setShowNewProject(true)}
        />
        <WelcomeButton
          icon={<FolderOpen size={24} />}
          label="Ouvrir un projet"
          onClick={openProject}
        />
      </div>

      <div className="mt-16 text-center">
        <p className="text-xs text-muted-foreground">
          Projets récents apparaîtront ici
        </p>
      </div>
    </div>
  )
}

function WelcomeButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 w-40 h-32 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-colors"
    >
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

export function NewProjectForm({ onCancel, isModal = false }: { onCancel: () => void; isModal?: boolean }) {
  const { createNewProject } = useProjectStore()
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplates[0].id)
  const [projectLocation, setProjectLocation] = useState<string | null>(null)

  const handleChooseLocation = async () => {
    if (!isElectron) return
    const result = await window.electronAPI.saveProject()
    if (!result.canceled && result.filePath) {
      setProjectLocation(result.filePath)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    // Pass the location if we're in Electron and have one selected
    if (isElectron && projectLocation) {
      await createNewProject(name, author, selectedTemplate, projectLocation)
    } else {
      await createNewProject(name, author, selectedTemplate)
    }
  }

  // Get display path (shortened for long paths)
  const displayPath = projectLocation
    ? projectLocation.length > 40
      ? '...' + projectLocation.slice(-37)
      : projectLocation
    : null

  const canCreate = name.trim() && (isElectron ? projectLocation : true)

  const content = (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-serif font-bold mb-6">Nouveau projet</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Titre du projet</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon roman"
            className="w-full px-3 py-2 rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Auteur</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Votre nom"
            className="w-full px-3 py-2 rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {isElectron && (
          <div>
            <label className="block text-sm font-medium mb-1">Emplacement</label>
            <button
              onClick={handleChooseLocation}
              className="w-full px-3 py-2 rounded border border-input bg-background hover:bg-accent transition-colors flex items-center gap-2 text-left"
            >
              <Folder size={16} className="text-muted-foreground flex-shrink-0" />
              {projectLocation ? (
                <span className="text-sm truncate" title={projectLocation}>
                  {displayPath}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Choisir l'emplacement du projet...
                </span>
              )}
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Format de manuscrit</label>
          <div className="grid grid-cols-2 gap-2">
            {defaultTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={cn(
                  'p-3 rounded border text-left transition-colors',
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:border-primary/50'
                )}
              >
                <div className="text-sm font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground">{template.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded border border-input hover:bg-accent transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Créer
        </button>
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-xl shadow-2xl p-8">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background p-8">
      {/* Title bar drag region */}
      <div className="fixed top-0 left-0 right-0 h-8 titlebar-drag-region" />
      {content}
    </div>
  )
}
