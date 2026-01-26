import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import type { CharacterSheet } from '@shared/types/project'
import { Users, ArrowLeft, FileText, User, Brain, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'text' | 'identity' | 'psychology' | 'image'

interface TabProps {
  id: TabId
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function Tab({ label, icon, active, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2',
        active
          ? 'text-primary border-primary'
          : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

const ROLE_OPTIONS = [
  { value: 'protagonist', label: 'Protagoniste' },
  { value: 'antagonist', label: 'Antagoniste' },
  { value: 'secondary', label: 'Secondaire' },
  { value: 'minor', label: 'Figurant' }
] as const

interface CharacterSheetEditorProps {
  sheet: CharacterSheet
}

export function CharacterSheetEditor({ sheet }: CharacterSheetEditorProps) {
  const { updateSheet, setActiveSheet } = useProjectStore()
  const { currentTemplate } = useEditorStore()
  const [activeTab, setActiveTab] = useState<TabId>('text')

  // Create editor for description
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({
        placeholder: 'Decrivez ce personnage...'
      })
    ],
    content: sheet.description || '',
    editorProps: {
      attributes: {
        class: 'sheet-editor prose prose-sm max-w-none focus:outline-none'
      }
    },
    onUpdate: ({ editor }) => {
      updateSheet(sheet.id, {
        description: editor.getHTML(),
        updatedAt: new Date().toISOString()
      })
    }
  })

  // Load content when sheet changes
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== sheet.description) {
      editor.commands.setContent(sheet.description || '')
    }
  }, [editor, sheet.id, sheet.description])

  // Handle field changes
  const handleFieldChange = (field: keyof CharacterSheet, value: string) => {
    updateSheet(sheet.id, {
      [field]: value,
      updatedAt: new Date().toISOString()
    })
  }

  const tabs: TabProps[] = [
    {
      id: 'text',
      label: 'Texte',
      icon: <FileText size={16} />,
      active: activeTab === 'text',
      onClick: () => setActiveTab('text')
    },
    {
      id: 'identity',
      label: 'Identite',
      icon: <User size={16} />,
      active: activeTab === 'identity',
      onClick: () => setActiveTab('identity')
    },
    {
      id: 'psychology',
      label: 'Psychologie',
      icon: <Brain size={16} />,
      active: activeTab === 'psychology',
      onClick: () => setActiveTab('psychology')
    },
    {
      id: 'image',
      label: 'Image',
      icon: <Image size={16} />,
      active: activeTab === 'image',
      onClick: () => setActiveTab('image')
    }
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setActiveSheet(null)}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Retour au manuscrit"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Users size={20} />
          <span className="text-sm">Personnage</span>
        </div>

        <input
          type="text"
          value={sheet.name}
          onChange={(e) =>
            updateSheet(sheet.id, {
              name: e.target.value,
              updatedAt: new Date().toISOString()
            })
          }
          className="flex-1 text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0"
          placeholder="Nom du personnage..."
        />

        {/* Role badge */}
        <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded">
          {ROLE_OPTIONS.find((r) => r.value === sheet.role)?.label || 'Secondaire'}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-background border-b border-border flex">
        {tabs.map((tab) => (
          <Tab key={tab.id} {...tab} />
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'text' && (
          <div
            className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8 min-h-[500px]"
            style={{
              fontFamily: currentTemplate.typography.fontFamily
            }}
          >
            <EditorContent editor={editor} />
          </div>
        )}

        {activeTab === 'identity' && (
          <div className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Role dans l'histoire
              </label>
              <select
                value={sheet.role}
                onChange={(e) => handleFieldChange('role', e.target.value)}
                className="w-full p-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Description physique
              </label>
              <textarea
                value={sheet.physicalDescription || ''}
                onChange={(e) => handleFieldChange('physicalDescription', e.target.value)}
                className="w-full h-32 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Age, apparence, signes distinctifs, style vestimentaire..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Histoire personnelle
              </label>
              <textarea
                value={sheet.backstory || ''}
                onChange={(e) => handleFieldChange('backstory', e.target.value)}
                className="w-full h-32 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Origines, evenements marquants, ce qui a forge le personnage..."
              />
            </div>
          </div>
        )}

        {activeTab === 'psychology' && (
          <div className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Objectifs et motivations
              </label>
              <textarea
                value={sheet.goals || ''}
                onChange={(e) => handleFieldChange('goals', e.target.value)}
                className="w-full h-32 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Que veut ce personnage ? Qu'est-ce qui le pousse a agir ?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Defauts et faiblesses
              </label>
              <textarea
                value={sheet.flaws || ''}
                onChange={(e) => handleFieldChange('flaws', e.target.value)}
                className="w-full h-32 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Peurs, vices, limites, ce qui pourrait causer sa perte..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Notes
              </label>
              <textarea
                value={sheet.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full h-32 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Autres notes, idees, details a developper..."
              />
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                URL de l'image
              </label>
              <input
                type="url"
                value={sheet.imageUrl || ''}
                onChange={(e) => handleFieldChange('imageUrl', e.target.value)}
                className="w-full p-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="https://..."
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Collez l'URL d'une image representant ce personnage
              </p>
            </div>

            {sheet.imageUrl ? (
              <div className="mt-4">
                <img
                  src={sheet.imageUrl}
                  alt={sheet.name}
                  className="max-w-full max-h-96 rounded-lg object-cover shadow-md"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                />
                <div className="hidden p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                  Impossible de charger l'image. Verifiez l'URL.
                </div>
              </div>
            ) : (
              <div className="mt-4 p-8 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground">
                <Image size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune image</p>
                <p className="text-xs mt-1">Ajoutez une URL ci-dessus pour visualiser l'image</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
