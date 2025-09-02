import React, { useState, useCallback, useMemo } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { 
  Workflow,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  GitBranch,
  Target,
  Eye,
  EyeOff,
  FolderGit2,
  FileText,
  ExternalLink
} from 'lucide-react'
import { StepFlowConfig, WorkflowDef, ValidationIssue, EdgeDef } from '../types/stepflow'
import { cn } from '../lib/utils'

interface WorkflowManagerV2Props {
  config: StepFlowConfig
  activeWorkflowTabs: string[]
  onConfigChange: (config: StepFlowConfig) => void
  onWorkflowOpen: (workflowName: string) => void
  onWorkflowCreate: (workflowName: string) => void
  onWorkflowDelete: (workflowName: string) => void
}

interface WorkflowValidationResult {
  workflow: string
  issues: ValidationIssue[]
  reachableSteps: string[]
  unreachableSteps: string[]
  deadEnds: string[]
  cycles: string[][]
}

const WorkflowManagerV2: React.FC<WorkflowManagerV2Props> = ({
  config,
  activeWorkflowTabs,
  onConfigChange,
  onWorkflowOpen,
  onWorkflowCreate,
  onWorkflowDelete,
}) => {
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')

  const workflows = config.workflows || {}

  // Validate individual workflow
  const validateWorkflow = useCallback((workflowName: string, workflow: WorkflowDef): WorkflowValidationResult => {
    const issues: ValidationIssue[] = []
    const reachableSteps: string[] = []
    const unreachableSteps: string[] = []
    const deadEnds: string[] = []
    const cycles: string[][] = []

    // Basic validation
    if (!workflow.root) {
      issues.push({
        type: 'error',
        message: 'Workflow must have a root step',
        location: workflowName
      })
    }

    // Check if root step exists
    if (workflow.root && !config.steps?.[workflow.root]) {
      issues.push({
        type: 'error',
        message: `Root step '${workflow.root}' not found in steps definition`,
        location: `${workflowName}.root`
      })
    }

    // Check edges
    workflow.edges.forEach((edge, index) => {
      if (!config.steps?.[edge.from] && edge.from !== workflow.root) {
        issues.push({
          type: 'error',
          message: `Step '${edge.from}' not found in steps definition`,
          location: `${workflowName}.edges[${index}].from`
        })
      }

      if (!config.steps?.[edge.to] && edge.to !== 'SUCCESS' && edge.to !== 'FAILURE') {
        issues.push({
          type: 'error',
          message: `Step '${edge.to}' not found in steps definition`,
          location: `${workflowName}.edges[${index}].to`
        })
      }

      // Check alternative targets
      if (edge.onFailure?.alternativeTarget && !config.steps?.[edge.onFailure.alternativeTarget]) {
        issues.push({
          type: 'error',
          message: `Alternative target '${edge.onFailure.alternativeTarget}' not found in steps definition`,
          location: `${workflowName}.edges[${index}].onFailure.alternativeTarget`
        })
      }
    })

    // TODO: Add more sophisticated reachability and cycle detection

    return {
      workflow: workflowName,
      issues,
      reachableSteps,
      unreachableSteps,
      deadEnds,
      cycles
    }
  }, [config.steps])

  // Get validation results for all workflows
  const validationResults = useMemo(() => {
    return Object.entries(workflows).map(([name, workflow]) =>
      validateWorkflow(name, workflow)
    )
  }, [workflows, validateWorkflow])

  // Create new workflow
  const handleCreateWorkflow = useCallback(() => {
    if (!newWorkflowName.trim()) return

    const workflowName = newWorkflowName.trim()
    
    if (workflows[workflowName]) {
      alert('Workflow with this name already exists')
      return
    }

    onWorkflowCreate(workflowName)
    setNewWorkflowName('')
    setShowCreateForm(false)
  }, [newWorkflowName, workflows, onWorkflowCreate])

  // Delete workflow
  const handleDeleteWorkflow = useCallback((workflowName: string) => {
    if (confirm(`Delete workflow "${workflowName}"?`)) {
      onWorkflowDelete(workflowName)
    }
  }, [onWorkflowDelete])

  // Get workflow stats
  const getWorkflowStats = useCallback((workflow: WorkflowDef) => {
    const stepCount = new Set([
      workflow.root,
      ...workflow.edges.flatMap(e => [e.from, e.to]),
      ...workflow.edges.flatMap(e => e.onFailure?.alternativeTarget ? [e.onFailure.alternativeTarget] : [])
    ]).size

    const edgeCount = workflow.edges.length
    const hasErrors = validationResults.find(r => r.workflow === workflow)?.issues.some(i => i.type === 'error')
    const hasWarnings = validationResults.find(r => r.workflow === workflow)?.issues.some(i => i.type === 'warning')

    return { stepCount, edgeCount, hasErrors, hasWarnings }
  }, [validationResults])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Workflows
          </h2>
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="p-3">
            <div className="space-y-2">
              <Input
                placeholder="Workflow name"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorkflow()
                  } else if (e.key === 'Escape') {
                    setShowCreateForm(false)
                    setNewWorkflowName('')
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateWorkflow} disabled={!newWorkflowName.trim()}>
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setShowCreateForm(false)
                  setNewWorkflowName('')
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Workflows List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {Object.entries(workflows).length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FolderGit2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No workflows yet</p>
            <p className="text-sm">Create your first workflow to get started</p>
          </div>
        ) : (
          Object.entries(workflows).map(([name, workflow]) => {
            const stats = getWorkflowStats(workflow)
            const isOpen = activeWorkflowTabs.includes(name)
            const validation = validationResults.find(r => r.workflow === name)

            return (
              <Card 
                key={name}
                className={cn(
                  "p-3 cursor-pointer transition-colors hover:bg-muted/50",
                  isOpen && "ring-2 ring-primary bg-primary/5",
                  selectedWorkflow === name && "bg-muted"
                )}
                onClick={() => setSelectedWorkflow(selectedWorkflow === name ? '' : name)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderGit2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium truncate">{name}</span>
                      {isOpen && (
                        <Badge variant="outline" className="text-xs">
                          Open
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {stats.stepCount} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {stats.edgeCount} edges
                      </span>
                      {validation && validation.issues.length > 0 && (
                        <span className="flex items-center gap-1 text-orange-500">
                          <AlertTriangle className="w-3 h-3" />
                          {validation.issues.length}
                        </span>
                      )}
                    </div>

                    {/* Root step info */}
                    {workflow.root && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Root: <code className="bg-muted px-1 rounded">{workflow.root}</code>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Status indicator */}
                    {stats.hasErrors ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : stats.hasWarnings ? (
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedWorkflow === name && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          onWorkflowOpen(name)
                        }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteWorkflow(name)
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Validation Issues */}
                    {validation && validation.issues.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Issues:</p>
                        {validation.issues.map((issue, index) => (
                          <div
                            key={index}
                            className={cn(
                              "text-xs p-2 rounded border-l-2",
                              issue.type === 'error' && "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300",
                              issue.type === 'warning' && "bg-orange-50 dark:bg-orange-900/20 border-orange-500 text-orange-700 dark:text-orange-300",
                              issue.type === 'info' && "bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300"
                            )}
                          >
                            {issue.message}
                            {issue.location && (
                              <div className="text-xs opacity-75 mt-1">
                                {issue.location}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Edge Summary */}
                    {workflow.edges.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Edges ({workflow.edges.length}):
                        </p>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {workflow.edges.slice(0, 5).map((edge, index) => (
                            <div key={index} className="text-xs bg-muted/50 rounded px-2 py-1">
                              <code>{edge.from}</code> → <code>{edge.to}</code>
                              {edge.guard && (
                                <span className="text-muted-foreground ml-2">
                                  [{edge.guard}]
                                </span>
                              )}
                            </div>
                          ))}
                          {workflow.edges.length > 5 && (
                            <div className="text-xs text-muted-foreground px-2">
                              ... and {workflow.edges.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* Summary Stats */}
      <div className="border-t p-4 bg-muted/20">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium">{Object.keys(workflows).length}</div>
            <div className="text-muted-foreground">Workflows</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{activeWorkflowTabs.length}</div>
            <div className="text-muted-foreground">Open Tabs</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkflowManagerV2