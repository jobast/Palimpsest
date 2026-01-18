import { useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { defaultTemplates } from '@shared/types/templates'
import { MiniTimer, MiniCircularProgress, CompactStreak } from '@/components/stats'
import { useStatsStore } from '@/stores/statsStore'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  PanelLeft,
  PanelRight,
  Maximize2,
  Save,
  Settings,
  ChevronDown,
  FileText,
  Asterisk
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toolbar() {
  const { editor } = useEditorStore()
  const { toggleSidebar, sidebarOpen, toggleFocusMode, statsSidebarOpen, toggleStatsSidebar, openSettings } = useUIStore()
  const { saveProject, isDirty } = useProjectStore()

  if (!editor) {
    return (
      <div className="h-10 border-b border-border bg-card flex items-center px-2">
        <ToolbarButton icon={<PanelLeft size={16} />} onClick={toggleSidebar} active={sidebarOpen} title="Sidebar" />
      </div>
    )
  }

  return (
    <div className="h-10 border-b border-border bg-card flex items-center px-2 gap-1 titlebar-no-drag min-w-0">
      {/* Layout controls */}
      <ToolbarButton icon={<PanelLeft size={16} />} onClick={toggleSidebar} active={sidebarOpen} title="Manuscrit" />
      <ToolbarButton icon={<PanelRight size={16} />} onClick={toggleStatsSidebar} active={statsSidebarOpen} title="Statistiques" />
      <ToolbarButton icon={<Maximize2 size={16} />} onClick={toggleFocusMode} title="Mode focus" />

      <ToolbarSeparator />

      {/* Save */}
      <ToolbarButton
        icon={<Save size={16} />}
        onClick={saveProject}
        title="Enregistrer (⌘S)"
        className={isDirty ? 'text-primary' : ''}
      />

      <ToolbarSeparator />

      {/* History */}
      <ToolbarButton
        icon={<Undo size={16} />}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Annuler"
      />
      <ToolbarButton
        icon={<Redo size={16} />}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Refaire"
      />

      <ToolbarSeparator />

      {/* Text formatting */}
      <ToolbarButton
        icon={<Bold size={16} />}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Gras (⌘B)"
      />
      <ToolbarButton
        icon={<Italic size={16} />}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italique (⌘I)"
      />
      <ToolbarButton
        icon={<Underline size={16} />}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Souligné (⌘U)"
      />
      <ToolbarButton
        icon={<Strikethrough size={16} />}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Barré"
      />

      <ToolbarSeparator />

      {/* Alignment */}
      <ToolbarButton
        icon={<AlignLeft size={16} />}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Aligner à gauche"
      />
      <ToolbarButton
        icon={<AlignCenter size={16} />}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Centrer"
      />
      <ToolbarButton
        icon={<AlignRight size={16} />}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Aligner à droite"
      />
      <ToolbarButton
        icon={<AlignJustify size={16} />}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        title="Justifier"
      />

      <ToolbarSeparator />

      {/* Lists and blocks */}
      <ToolbarButton
        icon={<List size={16} />}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Liste à puces"
      />
      <ToolbarButton
        icon={<ListOrdered size={16} />}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Liste numérotée"
      />
      <ToolbarButton
        icon={<Quote size={16} />}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Citation"
      />

      {/* Dialogue dash button */}
      <ToolbarButton
        icon={<span className="text-sm font-bold">—</span>}
        onClick={() => editor.chain().focus().insertDialogueDash().run()}
        title="Tiret dialogue (⌘⇧D)"
      />

      <ToolbarSeparator />

      {/* Scene separators */}
      <ToolbarButton
        icon={<Minus size={16} />}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Séparateur de scène"
      />
      <ToolbarButton
        icon={<Asterisk size={16} />}
        onClick={() => editor.chain().focus().insertSceneBreak().run()}
        title="Pause de scène (⌘⇧8)"
      />

      {/* Spacer - can shrink to fit */}
      <div className="flex-1 min-w-0" />

      {/* Stats indicators */}
      <MiniTimer />
      <ToolbarSeparator />
      <StatsIndicators />
      <ToolbarSeparator />

      {/* Template selector */}
      <TemplateSelector />

      <ToolbarSeparator />

      <ToolbarButton icon={<Settings size={16} />} onClick={openSettings} title="Paramètres" />
    </div>
  )
}

function ToolbarButton({
  icon,
  onClick,
  active,
  disabled,
  title,
  className
}: {
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon}
    </button>
  )
}

function ToolbarSeparator() {
  return <div className="w-px h-5 bg-border mx-1" />
}

function TemplateSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const { currentTemplate, setTemplate } = useEditorStore()

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors"
      >
        <FileText size={14} />
        <span className="max-w-24 truncate">{currentTemplate.name}</span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-48">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
              Format de page
            </div>
            {defaultTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setTemplate(template.id)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
                  currentTemplate.id === template.id && 'bg-accent text-primary'
                )}
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground">{template.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatsIndicators() {
  const { getProgress, streak } = useStatsStore()
  const dailyProgress = getProgress('daily')
  const percentage = dailyProgress.target > 0
    ? (dailyProgress.current / dailyProgress.target) * 100
    : 0

  return (
    <div className="flex items-center gap-2">
      <MiniCircularProgress percentage={percentage} size={18} />
      <span className="text-xs text-muted-foreground tabular-nums">
        {Math.round(percentage)}%
      </span>
      <CompactStreak streak={streak.current} />
    </div>
  )
}
