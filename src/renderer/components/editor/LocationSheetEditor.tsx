import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import type { LocationSheet } from '@shared/types/project'
import { MapPin, ArrowLeft, FileText, Map, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapPicker } from '../maps/MapPicker'

type TabId = 'text' | 'map' | 'details'

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

interface LocationSheetEditorProps {
  sheet: LocationSheet
}

export function LocationSheetEditor({ sheet }: LocationSheetEditorProps) {
  const { updateSheet, setActiveSheet } = useProjectStore()
  const { currentTemplate } = useEditorStore()
  const [activeTab, setActiveTab] = useState<TabId>('text')

  // Create editor for text content
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({
        placeholder: 'Decrivez ce lieu...'
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

  // Handle coordinate changes from MapPicker
  const handleCoordinatesChange = useCallback(
    (coords: { latitude: number; longitude: number }, zoom: number) => {
      updateSheet(sheet.id, {
        coordinates: coords,
        mapZoom: zoom,
        updatedAt: new Date().toISOString()
      })
    },
    [sheet.id, updateSheet]
  )

  // Handle details field changes
  const handleFieldChange = (field: keyof LocationSheet, value: string) => {
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
      id: 'map',
      label: 'Carte',
      icon: <Map size={16} />,
      active: activeTab === 'map',
      onClick: () => setActiveTab('map')
    },
    {
      id: 'details',
      label: 'Details',
      icon: <Info size={16} />,
      active: activeTab === 'details',
      onClick: () => setActiveTab('details')
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
          <MapPin size={20} />
          <span className="text-sm">Lieu</span>
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
          placeholder="Nom du lieu..."
        />

        {/* Coordinates indicator */}
        {sheet.coordinates && (
          <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded">
            <MapPin size={12} />
            <span>Geolocalisee</span>
          </div>
        )}
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

        {activeTab === 'map' && (
          <div className="max-w-4xl mx-auto bg-paper rounded-lg shadow-md p-6 h-[600px]">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Emplacement sur la carte
            </h3>
            <div className="h-[calc(100%-2rem)]">
              <MapPicker
                coordinates={sheet.coordinates}
                zoom={sheet.mapZoom}
                onChange={handleCoordinatesChange}
              />
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="max-w-3xl mx-auto bg-paper rounded-lg shadow-md p-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Importance dans l'histoire
              </label>
              <textarea
                value={sheet.significance || ''}
                onChange={(e) => handleFieldChange('significance', e.target.value)}
                className="w-full h-24 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Quelle est l'importance de ce lieu dans votre histoire ?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Details sensoriels
              </label>
              <textarea
                value={sheet.sensoryDetails || ''}
                onChange={(e) => handleFieldChange('sensoryDetails', e.target.value)}
                className="w-full h-24 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Odeurs, sons, textures, atmosphere..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Notes
              </label>
              <textarea
                value={sheet.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full h-24 p-3 text-sm border border-border rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Notes supplementaires..."
              />
            </div>

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
              {sheet.imageUrl && (
                <div className="mt-3">
                  <img
                    src={sheet.imageUrl}
                    alt={sheet.name}
                    className="max-h-48 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
