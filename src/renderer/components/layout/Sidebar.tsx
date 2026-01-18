import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEditorStore } from '@/stores/editorStore'
import { usePaginationStore } from '@/stores/paginationStore'
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
  const { project } = useProjectStore()
  if (!project) return null

  const sheetCategories = [
    { key: 'characters', label: 'Personnages', icon: <Users size={14} />, count: project.sheets.characters.length },
    { key: 'locations', label: 'Lieux', icon: <MapPin size={14} />, count: project.sheets.locations.length },
    { key: 'plots', label: 'Intrigues', icon: <GitBranch size={14} />, count: project.sheets.plots.length },
    { key: 'notes', label: 'Notes', icon: <StickyNote size={14} />, count: project.sheets.notes.length }
  ]

  return (
    <div className="p-2 space-y-4">
      {sheetCategories.map((cat) => (
        <div key={cat.key}>
          <div className="flex items-center justify-between px-2 mb-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {cat.icon}
              <span>{cat.label}</span>
            </div>
            <button
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title={`Ajouter ${cat.label.toLowerCase()}`}
            >
              <Plus size={14} />
            </button>
          </div>

          {cat.count === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-2">
              Aucun {cat.label.toLowerCase()}
            </p>
          ) : (
            <div className="space-y-0.5">
              {/* Sheet items would go here */}
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
 * Shows miniature previews of pages for quick navigation
 */
function PageThumbnailsPanel() {
  const { pages, currentPage, totalPages } = usePaginationStore()
  const { currentTemplate } = useEditorStore()

  // Calculate thumbnail dimensions (maintain aspect ratio)
  const sidebarWidth = 200 // Approximate sidebar content width
  const aspectRatio = parseFloat(currentTemplate.page.height.replace(/[^0-9.]/g, '')) /
                      parseFloat(currentTemplate.page.width.replace(/[^0-9.]/g, '')) || 1.5
  const thumbnailWidth = sidebarWidth - 24 // Account for padding
  const thumbnailHeight = thumbnailWidth * aspectRatio

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

      <div className="space-y-3">
        {pages.map((pageInfo) => (
          <button
            key={pageInfo.pageNumber}
            onClick={() => scrollToPage(pageInfo.pageNumber)}
            className={cn(
              'w-full rounded-lg border-2 transition-all overflow-hidden',
              currentPage === pageInfo.pageNumber
                ? 'border-primary shadow-md'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            {/* Thumbnail preview */}
            <div
              className="bg-paper relative"
              style={{
                width: '100%',
                height: `${thumbnailHeight}px`,
                padding: '8px'
              }}
            >
              {/* Simulated content lines */}
              <div className="space-y-1">
                {Array.from({ length: Math.min(12, Math.ceil(pageInfo.contentHeight / 20)) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-1 bg-muted-foreground/20 rounded"
                    style={{
                      width: i === 0 ? '60%' : i === 11 ? '40%' : '100%'
                    }}
                  />
                ))}
              </div>

              {/* Page number badge */}
              <div className="absolute bottom-1 right-1 bg-background/80 px-1.5 py-0.5 rounded text-[10px] font-medium">
                {pageInfo.pageNumber}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
