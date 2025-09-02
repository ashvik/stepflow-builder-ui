import React, { useState, useRef, useCallback } from 'react'
import { Node, Edge } from 'reactflow'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { 
  FolderGit2, 
  Copy, 
  Trash2, 
  Edit3, 
  GripVertical, 
  Plus, 
  Download,
  Upload,
  Star,
  Archive,
  Layers,
  Settings
} from 'lucide-react'

interface RequestInfo {
  edges: Edge[]
  rootId?: string
  description?: string
  tags?: string[]
  isTemplate?: boolean
  createdAt?: string
  lastModified?: string
}

interface RequestManagerProps {
  requestsMap: Record<string, RequestInfo>
  activeRequest: string
  visibleRequests: string[]
  enableOverlays: boolean
  reqColors: Record<string, string>
  allNodes: Node[]
  onRequestChange: (name: string) => void
  onRequestCreate: (name: string, description?: string) => void
  onRequestDelete: (name: string) => void
  onRequestRename: (oldName: string, newName: string) => void
  onRequestClone: (sourceName: string, newName: string) => void
  onOverlayToggle: (enabled: boolean) => void
  onVisibilityChange: (requests: string[]) => void
  onColorChange: (name: string, color: string) => void
  onClose: () => void
}

const RequestManager: React.FC<RequestManagerProps> = ({
  requestsMap,
  activeRequest,
  visibleRequests,
  enableOverlays,
  reqColors,
  allNodes,
  onRequestChange,
  onRequestCreate,
  onRequestDelete,
  onRequestRename,
  onRequestClone,
  onOverlayToggle,
  onVisibilityChange,
  onColorChange,
  onClose,
}) => {
  const [newRequestName, setNewRequestName] = useState('')
  const [newRequestDesc, setNewRequestDesc] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [draggedRequest, setDraggedRequest] = useState<string | null>(null)
  const [requestOrder, setRequestOrder] = useState<string[]>(Object.keys(requestsMap))
  const [showTemplates, setShowTemplates] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update request order when requestsMap changes
  React.useEffect(() => {
    const currentRequests = Object.keys(requestsMap)
    const newRequests = currentRequests.filter(r => !requestOrder.includes(r))
    setRequestOrder(prev => [...prev.filter(r => currentRequests.includes(r)), ...newRequests])
  }, [requestsMap])

  // Filter requests based on search term
  const filteredRequests = requestOrder.filter(name => {
    if (showTemplates && !requestsMap[name]?.isTemplate) return false
    if (!showTemplates && requestsMap[name]?.isTemplate) return false
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           requestsMap[name]?.description?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const handleDragStart = (e: React.DragEvent, requestName: string) => {
    setDraggedRequest(requestName)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, targetRequest: string) => {
    e.preventDefault()
    if (!draggedRequest || draggedRequest === targetRequest) return

    const dragIndex = requestOrder.indexOf(draggedRequest)
    const hoverIndex = requestOrder.indexOf(targetRequest)
    
    if (dragIndex !== hoverIndex) {
      const newOrder = [...requestOrder]
      newOrder.splice(dragIndex, 1)
      newOrder.splice(hoverIndex, 0, draggedRequest)
      setRequestOrder(newOrder)
    }
  }

  const handleDragEnd = () => {
    setDraggedRequest(null)
  }

  const handleCreateRequest = () => {
    const name = newRequestName.trim()
    if (!name) return
    
    onRequestCreate(name, newRequestDesc.trim() || undefined)
    setNewRequestName('')
    setNewRequestDesc('')
  }

  const handleCloneRequest = (sourceName: string) => {
    const newName = `${sourceName}_copy_${Date.now()}`
    onRequestClone(sourceName, newName)
  }

  const handleBulkDelete = () => {
    if (selectedRequests.length === 0) return
    if (!confirm(`Delete ${selectedRequests.length} requests?`)) return
    
    selectedRequests.forEach(name => {
      if (name !== activeRequest) {
        onRequestDelete(name)
      }
    })
    setSelectedRequests([])
  }

  const createTemplate = (requestName: string) => {
    // Mark request as template
    const request = requestsMap[requestName]
    if (request) {
      // This would need to be implemented in the parent component
      console.log('Creating template from:', requestName)
    }
  }

  const getRequestStats = (requestName: string) => {
    const request = requestsMap[requestName]
    if (!request) return { nodes: 0, edges: 0 }
    
    const nodeIds = new Set<string>()
    request.edges.forEach(e => {
      nodeIds.add(e.source)
      nodeIds.add(e.target)
    })
    
    return {
      nodes: nodeIds.size,
      edges: request.edges.length
    }
  }

  const exportRequests = (requestNames: string[]) => {
    const exportData = requestNames.reduce((acc, name) => {
      acc[name] = requestsMap[name]
      return acc
    }, {} as Record<string, RequestInfo>)
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stepflow-requests-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderGit2 className="w-5 h-5" />
            <h2 className="text-lg font-medium">Request Manager</h2>
            <span className="text-sm text-muted-foreground">
              {Object.keys(requestsMap).length} requests
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowTemplates(!showTemplates)}
              className={showTemplates ? 'bg-primary/10' : ''}
            >
              <Star className="w-4 h-4 mr-1" />
              {showTemplates ? 'Show All' : 'Templates'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r border-border flex flex-col">
            
            {/* Controls */}
            <div className="p-3 space-y-3 border-b border-border">
              
              {/* Search */}
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm"
              />

              {/* Overlay Controls */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enableOverlays}
                    onChange={(e) => onOverlayToggle(e.target.checked)}
                    className="rounded"
                  />
                  Enable overlays
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onVisibilityChange([])}
                  disabled={!enableOverlays}
                >
                  <Layers className="w-4 h-4" />
                </Button>
              </div>

              {/* Bulk Actions */}
              {selectedRequests.length > 0 && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportRequests(selectedRequests)}
                    className="flex-1"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={selectedRequests.includes(activeRequest)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Request List */}
            <div className="flex-1 overflow-auto">
              <div className="p-2 space-y-1">
                {filteredRequests.map((name) => {
                  const request = requestsMap[name]
                  const stats = getRequestStats(name)
                  const isActive = name === activeRequest
                  const isSelected = selectedRequests.includes(name)
                  const isVisible = visibleRequests.includes(name)
                  
                  return (
                    <div
                      key={name}
                      draggable
                      onDragStart={(e) => handleDragStart(e, name)}
                      onDragOver={(e) => handleDragOver(e, name)}
                      onDragEnd={handleDragEnd}
                      className={`group relative flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                        isActive 
                          ? 'border-primary bg-primary/5' 
                          : isSelected 
                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-border hover:border-border/60 hover:bg-accent/50'
                      }`}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          setSelectedRequests(prev => 
                            prev.includes(name) 
                              ? prev.filter(r => r !== name)
                              : [...prev, name]
                          )
                        } else {
                          onRequestChange(name)
                        }
                      }}
                    >
                      {/* Drag Handle */}
                      <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      
                      {/* Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-3 h-3"
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Color Indicator */}
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ background: reqColors[name] || '#94a3b8' }}
                      />

                      {/* Request Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {name}
                          </span>
                          {request?.isTemplate && (
                            <Star className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                          )}
                          {isActive && (
                            <span className="text-xs bg-primary text-primary-foreground px-1 rounded">
                              active
                            </span>
                          )}
                        </div>
                        
                        {request?.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {request.description}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground mt-1">
                          {stats.nodes} nodes • {stats.edges} edges
                        </div>
                      </div>

                      {/* Visibility Toggle */}
                      {enableOverlays && (
                        <button
                          className={`p-1 rounded ${isVisible ? 'text-primary' : 'text-muted-foreground'}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onVisibilityChange(
                              isVisible 
                                ? visibleRequests.filter(r => r !== name)
                                : [...visibleRequests, name]
                            )
                          }}
                          title={isVisible ? 'Hide from overlay' : 'Show in overlay'}
                        >
                          <Layers className="w-3 h-3" />
                        </button>
                      )}

                      {/* Actions Menu */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button
                          className="p-1 rounded hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCloneRequest(name)
                          }}
                          title="Clone request"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation()
                            const newName = prompt('Rename request:', name)
                            if (newName && newName !== name) {
                              onRequestRename(name, newName)
                            }
                          }}
                          title="Rename request"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {!isActive && (
                          <button
                            className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Delete request "${name}"?`)) {
                                onRequestDelete(name)
                              }
                            }}
                            title="Delete request"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {filteredRequests.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <FolderGit2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchTerm ? 'No matching requests' : 'No requests yet'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            
            {/* Create Request */}
            <div className="p-4 border-b border-border">
              <h3 className="font-medium mb-3">Create New Request</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Request name"
                  value={newRequestName}
                  onChange={(e) => setNewRequestName(e.target.value)}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newRequestDesc}
                  onChange={(e) => setNewRequestDesc(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateRequest}
                    disabled={!newRequestName.trim()}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create Request
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          try {
                            const imported = JSON.parse(event.target?.result as string)
                            // Handle import logic here
                            console.log('Imported requests:', imported)
                          } catch (error) {
                            console.error('Import failed:', error)
                          }
                        }
                        reader.readAsText(file)
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Request Details */}
            {activeRequest && requestsMap[activeRequest] && (
              <div className="flex-1 p-4">
                <h3 className="font-medium mb-3">Request Details: {activeRequest}</h3>
                <div className="space-y-4">
                  
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{getRequestStats(activeRequest).nodes}</div>
                      <div className="text-sm text-muted-foreground">Nodes</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{getRequestStats(activeRequest).edges}</div>
                      <div className="text-sm text-muted-foreground">Edges</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">
                        {requestsMap[activeRequest].rootId ? '1' : '0'}
                      </div>
                      <div className="text-sm text-muted-foreground">Root Steps</div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <textarea
                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Add a description for this request..."
                      value={requestsMap[activeRequest].description || ''}
                      onChange={(e) => {
                        // This would need to be implemented in parent
                        console.log('Update description:', e.target.value)
                      }}
                    />
                  </div>

                  {/* Color Picker */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Color</label>
                    <div className="flex gap-2">
                      {['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'].map(color => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded border-2 ${reqColors[activeRequest] === color ? 'border-black dark:border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => onColorChange(activeRequest, color)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleCloneRequest(activeRequest)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Clone Request
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => createTemplate(activeRequest)}
                    >
                      <Star className="w-4 h-4 mr-1" />
                      Save as Template
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportRequests([activeRequest])}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RequestManager