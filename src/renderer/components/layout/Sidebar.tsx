import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
import { getPageDimensions } from '@/lib/pagination'
import {
  FileText,
  Users,
  MapPin,
  GitBranch,
  StickyNote,
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  LayoutGrid
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ManuscriptItem } from '@shared/types/project'
import { useState } from 'react'

export function Sidebar() {
  const { sidebarPanel, setSidebarPanel } = useUIStore()

  return (
    <div className="h-full flex flex-col">
      {/* Panel tabs */}
      <div className="flex border-b border-border">
        <SidebarTab
          icon={<FileText size={16} />}
          label="Manuscrit"
          active={sidebarPanel === 'project'}
          onClick={() => setSidebarPanel('project')}
        />
        <SidebarTab
          icon={<LayoutGrid size={16} />}
          label="Pages"
          active={sidebarPanel === 'pages'}
          onClick={() => setSidebarPanel('pages')}
        />
        <SidebarTab
          icon={<Users size={16} />}
          label="Fiches"
          active={sidebarPanel === 'sheets'}
          onClick={() => setSidebarPanel('sheets')}
        />
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {sidebarPanel === 'project' && <ManuscriptPanel />}
        {sidebarPanel === 'pages' && <PageThumbnailsPanel />}
        {sidebarPanel === 'sheets' && <SheetsPanel />}
      </div>
    </div>
  )
}

function SidebarTab({
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
        'flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors',
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}

function ManuscriptPanel() {
  const { project, activeDocumentId, setActiveDocument, addManuscriptItem } = useProjectStore()

  if (!project) return null

  const handleAddChapter = () => {
    addManuscriptItem({
      id: crypto.randomUUID(),
      type: 'chapter',
      title: `Chapitre ${project.manuscript.items.length + 1}`,
      status: 'draft',
      wordCount: 0,
      children: []
    })
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Manuscrit
        </span>
        <button
          onClick={handleAddChapter}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Ajouter un chapitre"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-0.5">
        {project.manuscript.items.map((item) => (
          <ManuscriptTreeItem
            key={item.id}
            item={item}
            activeId={activeDocumentId}
            onSelect={setActiveDocument}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}

function ManuscriptTreeItem({
  item,
  activeId,
  onSelect,
  depth
}: {
  item: ManuscriptItem
  activeId: string | null
  onSelect: (id: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.children && item.children.length > 0

  const icon = item.type === 'folder' ? <Folder size={14} /> : <FileText size={14} />

  return (
    <div>
      <button
        onClick={() => onSelect(item.id)}
        className={cn(
          'w-full flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors',
          activeId === item.id
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-accent'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="p-0.5 hover:bg-accent rounded"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        {!hasChildren && <span className="w-4" />}
        {icon}
        <span className="truncate flex-1 text-left">{item.title}</span>
        <span className="text-xs text-muted-foreground">{item.wordCount}</span>
      </button>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <ManuscriptTreeItem
              key={child.id}
              item={child}
              activeId={activeId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SheetsPanel() {
  const { project, addSheet, activeSheetId, setActiveSheet } = useProjectStore()

  if (!project) return null

  const createSheet = (type: 'character' | 'location' | 'plot' | 'note') => {
    const now = new Date().toISOString()
    const baseSheet = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }

    let newSheet
    switch (type) {
      case 'character':
        newSheet = {
          ...baseSheet,
          type: 'character' as const,
          name: 'Nouveau personnage',
          role: 'secondary' as const,
          description: '',
        }
        break
      case 'location':
        newSheet = {
          ...baseSheet,
          type: 'location' as const,
          name: 'Nouveau lieu',
          description: '',
        }
        break
      case 'plot':
        newSheet = {
          ...baseSheet,
          type: 'plot' as const,
          name: 'Nouvelle intrigue',
          plotType: 'subplot' as const,
          description: '',
        }
        break
      case 'note':
        newSheet = {
          ...baseSheet,
          type: 'note' as const,
          name: 'Nouvelle note',
          content: '',
        }
        break
    }

    addSheet(newSheet)
    setActiveSheet(newSheet.id)
  }

  const sheetCategories = [
    {
      key: 'characters' as const,
      type: 'character' as const,
      label: 'Personnages',
      icon: <Users size={14} />,
      items: project.sheets.characters
    },
    {
      key: 'locations' as const,
      type: 'location' as const,
      label: 'Lieux',
      icon: <MapPin size={14} />,
      items: project.sheets.locations
    },
    {
      key: 'plots' as const,
      type: 'plot' as const,
      label: 'Intrigues',
      icon: <GitBranch size={14} />,
      items: project.sheets.plots
    },
    {
      key: 'notes' as const,
      type: 'note' as const,
      label: 'Notes',
      icon: <StickyNote size={14} />,
      items: project.sheets.notes
    }
  ]

  return (
    <div className="p-2 space-y-4">
      {sheetCategories.map((cat) => (
        <div key={cat.key}>
          <div className="flex items-center justify-between px-2 mb-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {cat.icon}
              <span>{cat.label}</span>
              <span className="text-[10px]">({cat.items.length})</span>
            </div>
            <button
              onClick={() => createSheet(cat.type)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title={`Ajouter ${cat.label.toLowerCase()}`}
            >
              <Plus size={14} />
            </button>
          </div>

          {cat.items.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-6 py-1 italic">
              Aucun {cat.label.toLowerCase()}
            </p>
          ) : (
            <div className="space-y-0.5">
              {cat.items.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => setActiveSheet(sheet.id)}
                  className={cn(
                    'w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded text-sm transition-colors text-left',
                    activeSheetId === sheet.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <FileText size={12} className="text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{sheet.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// StatsPanel is now imported from @/components/stats

/**
 * Page Thumbnails Panel
 * Shows miniature previews of pages for quick navigation with real text content
 */
function PageThumbnailsPanel() {
  const { pages, currentPage, totalPages } = usePaginationStore()
  const { editor, currentTemplate } = useEditorStore()

  // Get actual page dimensions from template (properly converted to pixels)
  const dims = getPageDimensions(currentTemplate)

  // Calculate thumbnail dimensions maintaining correct aspect ratio
  const maxThumbnailWidth = 176 // Sidebar width minus padding
  const aspectRatio = dims.height / dims.width
  const thumbnailWidth = maxThumbnailWidth
  const thumbnailHeight = thumbnailWidth * aspectRatio

  // Extract text content for a page range
  const getPageText = (startPos: number, endPos: number): string => {
    if (!editor) return ''
    try {
      const doc = editor.state.doc
      // Ensure positions are within bounds
      const safeStart = Math.max(0, startPos)
      const safeEnd = Math.min(doc.content.size, endPos)
      if (safeStart >= safeEnd) return ''
      return doc.textBetween(safeStart, safeEnd, '\n', ' ')
    } catch {
      return ''
    }
  }

  const scrollToPage = (pageNum: number) => {
    window.dispatchEvent(
      new CustomEvent('palimpseste:scrollToPage', { detail: { page: pageNum } })
    )
  }

  if (pages.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Aucune page à afficher
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pages ({totalPages})
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        {pages.map((pageInfo) => {
          const pageText = getPageText(pageInfo.startPos, pageInfo.endPos)

          return (
            <button
              key={pageInfo.pageNumber}
              onClick={() => scrollToPage(pageInfo.pageNumber)}
              className={cn(
                'rounded-lg border-2 transition-all overflow-hidden bg-paper',
                currentPage === pageInfo.pageNumber
                  ? 'border-primary shadow-md'
                  : 'border-border hover:border-muted-foreground/50'
              )}
              style={{
                width: `${thumbnailWidth}px`,
                height: `${thumbnailHeight}px`,
              }}
            >
              {/* Thumbnail content */}
              <div
                className="relative w-full h-full overflow-hidden"
              >
                {/* Scaled text content - padding proportional to page margins */}
                <div
                  className="absolute text-paper-foreground overflow-hidden"
                  style={{
                    top: `${(dims.marginTop / dims.height) * thumbnailHeight}px`,
                    left: `${(dims.marginLeft / dims.width) * thumbnailWidth}px`,
                    right: `${(dims.marginRight / dims.width) * thumbnailWidth}px`,
                    bottom: `${(dims.marginBottom / dims.height) * thumbnailHeight}px`,
                    fontSize: '3.5px',
                    lineHeight: 1.3,
                    fontFamily: currentTemplate.typography.fontFamily,
                    textAlign: 'justify',
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                  }}
                >
                  {pageText || (
                    <span className="text-muted-foreground/30 italic">Page vide</span>
                  )}
                </div>

                {/* Page number badge */}
                <div className="absolute bottom-1 right-1 bg-background/80 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {pageInfo.pageNumber}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
