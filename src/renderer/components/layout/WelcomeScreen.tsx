import { useState } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { defaultTemplates } from '@shared/types/templates'
import { FolderOpen, Plus, Folder, Clock, User, Feather, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRandomQuote, getRandomQuoteExcluding, type WritingQuote } from '@/lib/quotes/writingQuotes'

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

export function WelcomeScreen() {
  const [showNewProject, setShowNewProject] = useState(false)
  const { openProject, recentProjects, openRecentProject } = useProjectStore()

  // Citation aléatoire avec possibilité de rafraîchir
  const [quote, setQuote] = useState<WritingQuote>(() => getRandomQuote())
  const [quoteKey, setQuoteKey] = useState(0) // Pour l'animation

  const refreshQuote = () => {
    setQuote(prev => getRandomQuoteExcluding(prev))
    setQuoteKey(k => k + 1)
  }

  if (showNewProject) {
    return <NewProjectForm onCancel={() => setShowNewProject(false)} />
  }

  // Format date for display
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Aujourd'hui"
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return `Il y a ${diffDays} jours`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/30 overflow-auto">
      {/* Title bar drag region */}
      <div className="fixed top-0 left-0 right-0 h-8 titlebar-drag-region z-10" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-12">

        {/* Logo et titre */}
        <header className="text-center mb-10 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Feather className="w-7 h-7 text-primary/70" strokeWidth={1.5} />
            <h1 className="text-3xl font-serif font-medium tracking-wide text-foreground">
              Palimpseste
            </h1>
          </div>
          <p className="text-sm text-muted-foreground tracking-wide">
            Traitement de texte pour écrivains
          </p>
        </header>

        {/* Citation inspirante */}
        <div
          key={quoteKey}
          className="max-w-xl mx-auto mb-12 text-center animate-fade-in-up"
        >
          <blockquote className="relative px-6">
            {/* Guillemet décoratif */}
            <span className="absolute -top-4 left-0 text-5xl text-primary/10 font-serif select-none leading-none">
              "
            </span>

            <p className="text-lg md:text-xl font-light leading-relaxed text-foreground/80 italic">
              {quote.text}
            </p>

            <footer className="mt-4 flex items-center justify-center gap-2">
              <cite className="not-italic text-primary/80 font-medium text-sm">
                — {quote.author}
              </cite>
              {quote.source && (
                <span className="text-muted-foreground text-xs">
                  ({quote.source})
                </span>
              )}
            </footer>
          </blockquote>

          {/* Bouton pour changer de citation */}
          <button
            onClick={refreshQuote}
            className="mt-4 p-2 rounded-full text-muted-foreground/50 hover:text-primary/70 hover:bg-primary/5 transition-all duration-300"
            title="Nouvelle citation"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Séparateur subtil */}
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-border to-transparent mb-10" />

        {/* Boutons d'action */}
        <div className="flex gap-4 mb-12">
          <WelcomeButton
            icon={<Plus size={22} strokeWidth={1.5} />}
            label="Nouveau projet"
            onClick={() => setShowNewProject(true)}
          />
          <WelcomeButton
            icon={<FolderOpen size={22} strokeWidth={1.5} />}
            label="Ouvrir un projet"
            onClick={openProject}
          />
        </div>

        {/* Projets récents */}
        {recentProjects.length > 0 && (
          <div className="w-full max-w-md animate-fade-in-delayed">
            <h2 className="text-xs font-medium text-muted-foreground/70 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Clock size={12} />
              Projets récents
            </h2>
            <div className="space-y-2">
              {recentProjects.map((project, index) => (
                <button
                  key={project.path}
                  onClick={() => openRecentProject(project.path)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground/90 group-hover:text-foreground truncate">
                        {project.name}
                      </div>
                      {project.author && (
                        <div className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <User size={10} />
                          {project.author}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/50 ml-4 flex-shrink-0">
                      {formatDate(project.lastOpened)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {recentProjects.length === 0 && (
          <div className="text-center animate-fade-in-delayed">
            <p className="text-xs text-muted-foreground/50">
              Vos projets récents apparaîtront ici
            </p>
          </div>
        )}
      </div>

      {/* Styles d'animation */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.7s ease-out forwards;
        }

        .animate-fade-in-delayed {
          opacity: 0;
          animation: fade-in 0.5s ease-out 0.3s forwards;
        }
      `}</style>
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
      className="flex flex-col items-center justify-center gap-3 w-36 h-28 rounded-xl border border-border/50 bg-card/30 hover:bg-card hover:border-primary/30 hover:shadow-md transition-all duration-300 group"
    >
      <div className="text-muted-foreground/60 group-hover:text-primary/70 transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">
        {label}
      </span>
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
      <h2 className="text-2xl font-serif font-medium mb-6 text-foreground/90">Nouveau projet</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/70">Titre du projet</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon roman"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-foreground/70">Auteur</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Votre nom"
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
        </div>

        {isElectron && (
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/70">Emplacement</label>
            <button
              onClick={handleChooseLocation}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background hover:bg-accent transition-colors flex items-center gap-2 text-left"
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
          <label className="block text-sm font-medium mb-2 text-foreground/70">Format de manuscrit</label>
          <div className="grid grid-cols-2 gap-2">
            {defaultTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all duration-200',
                  selectedTemplate === template.id
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-input hover:border-primary/30 hover:bg-accent/50'
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
          className="flex-1 px-4 py-2.5 rounded-lg border border-input hover:bg-accent transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Créer
        </button>
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-background rounded-xl shadow-2xl p-8 animate-fade-in-up">
          {content}
        </div>
        <style>{`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.25s ease-out forwards;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 overflow-auto">
      {/* Title bar drag region */}
      <div className="fixed top-0 left-0 right-0 h-8 titlebar-drag-region z-10" />

      {/* Content with proper spacing */}
      <div className="flex flex-col items-center px-8 pt-16 pb-8">
        {content}
      </div>
    </div>
  )
}
