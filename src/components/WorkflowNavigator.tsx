import React, { useState } from 'react'
import { Button } from './ui/button'
import { Eye, EyeOff, Play, Trash2, Edit3, Plus, FolderGit2 } from 'lucide-react'
import { cn } from '../lib/utils'

interface Workflow {
  name: string
  color: string
  isActive: boolean
  isVisible: boolean
  nodeCount: number
  edgeCount: number
}

interface WorkflowNavigatorProps {
  workflows: Workflow[]
  onSelectWorkflow: (name: string) => void
  onToggleVisibility: (name: string) => void
  onDeleteWorkflow: (name: string) => void
  onCreateWorkflow: () => void
  onRunWorkflow?: (name: string) => void
}

export function WorkflowNavigator({
  workflows,
  onSelectWorkflow,
  onToggleVisibility,
  onDeleteWorkflow,
  onCreateWorkflow,
  onRunWorkflow
}: WorkflowNavigatorProps) {
  const [showStats, setShowStats] = useState(false)

  return (
    <div className="bg-card border-r border-border w-80 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-medium">Workflows ({workflows.length})</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowStats(!showStats)}
            title="Toggle statistics"
          >
            <Edit3 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCreateWorkflow}
            title="Create new workflow"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-y-auto">
        {workflows.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <FolderGit2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No workflows created</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onCreateWorkflow}
            >
              <Plus className="w-3 h-3 mr-1" />
              Create Workflow
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {workflows.map((workflow) => (
              <div
                key={workflow.name}
                className={cn(
                  'group flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer',
                  workflow.isActive
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-accent/50'
                )}
                onClick={() => onSelectWorkflow(workflow.name)}
              >
                {/* Color indicator */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                  style={{ backgroundColor: workflow.color }}
                />

                {/* Workflow info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      'text-sm font-medium truncate',
                      workflow.isActive ? 'text-primary' : 'text-foreground'
                    )}>
                      {workflow.name}
                    </span>
                    {workflow.isActive && (
                      <span className="text-xs text-primary bg-primary/10 px-1 rounded">
                        Active
                      </span>
                    )}
                  </div>

                  {showStats && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{workflow.nodeCount} nodes</span>
                      <span>{workflow.edgeCount} edges</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleVisibility(workflow.name)
                    }}
                    title={workflow.isVisible ? 'Hide workflow' : 'Show workflow'}
                  >
                    {workflow.isVisible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3 opacity-50" />
                    )}
                  </Button>

                  {onRunWorkflow && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRunWorkflow(workflow.name)
                      }}
                      title="Run workflow"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )}

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete workflow "${workflow.name}"?`)) {
                        onDeleteWorkflow(workflow.name)
                      }
                    }}
                    title="Delete workflow"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {workflows.length > 0 && (
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Visible:</span>
              <span>{workflows.filter(w => w.isVisible).length}/{workflows.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total nodes:</span>
              <span>{workflows.reduce((sum, w) => sum + w.nodeCount, 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}