import { useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { defaultTemplates } from '@shared/types/templates'
import { FolderOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function NewProjectForm({ onCancel }: { onCancel: () => void }) {
  const { createNewProject } = useProjectStore()
  const [name, setName] = useState('')
  const [author, setAuthor] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplates[0].id)

  const handleCreate = async () => {
    if (!name.trim()) return
    await createNewProject(name, author, selectedTemplate)
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background p-8">
      {/* Title bar drag region */}
      <div className="fixed top-0 left-0 right-0 h-8 titlebar-drag-region" />

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
            disabled={!name.trim()}
            className="flex-1 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}
