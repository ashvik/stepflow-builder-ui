import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Workflow,
  Plus,
  Minus,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  GitBranch,
  Target,
  Eye,
  EyeOff
} from 'lucide-react'
import { StepFlowConfig, WorkflowDef, ValidationIssue, EdgeDef } from '../types/stepflow'
import { cn } from '../lib/utils'

interface WorkflowManagerProps {
  config: StepFlowConfig
  activeWorkflow?: string
  onConfigChange: (config: StepFlowConfig) => void
  onActiveWorkflowChange: (workflowName: string) => void
  onAnalyzeWorkflow?: (workflowName: string) => void
  /** When true, renders full-width without sidebar borders */
  embedded?: boolean
}

interface WorkflowValidationResult {
  workflow: string
  issues: ValidationIssue[]
  reachableSteps: string[]
  unreachableSteps: string[]
  deadEnds: string[]
  cycles: string[][]
}

const WorkflowManager: React.FC<WorkflowManagerProps> = ({
  config,
  activeWorkflow,
  onConfigChange,
  onActiveWorkflowChange,
  onAnalyzeWorkflow,
  embedded = false,
}) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [showValidation, setShowValidation] = useState(true)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const workflows = config.workflows || {}
  const steps = config.steps || {}
  
  // Validation logic
  const validateWorkflow = useCallback((workflowName: string, workflow: WorkflowDef): WorkflowValidationResult => {
    const issues: ValidationIssue[] = []
    const reachableSteps = new Set<string>()
    const unreachableSteps = new Set(Object.keys(steps))
    const deadEnds: string[] = []
    const cycles: string[][] = []
    
    // Check if root step exists
    if (!workflow.root) {
      issues.push({
        type: 'error',
        message: 'Workflow must have a root step',
        location: `workflows.${workflowName}.root`
      })
    } else if (!steps[workflow.root] && workflow.root !== 'SUCCESS' && workflow.root !== 'FAILURE') {
      issues.push({
        type: 'error',
        message: `Root step '${workflow.root}' is not defined`,
        location: `workflows.${workflowName}.root`
      })
    } else {
      reachableSteps.add(workflow.root)
      unreachableSteps.delete(workflow.root)
    }
    
    // Validate edges
    const edgeMap = new Map<string, EdgeDef[]>()
    workflow.edges.forEach((edge, index) => {
      // Check if source step exists
      if (!steps[edge.from] && edge.from !== 'SUCCESS' && edge.from !== 'FAILURE') {
        issues.push({
          type: 'error',
          message: `Source step '${edge.from}' is not defined`,
          location: `workflows.${workflowName}.edges[${index}].from`
        })
      }
      
      // Check if target step exists or is terminal
      if (!steps[edge.to] && edge.to !== 'SUCCESS' && edge.to !== 'FAILURE') {
        issues.push({
          type: 'error',
          message: `Target step '${edge.to}' is not defined`,
          location: `workflows.${workflowName}.edges[${index}].to`
        })
      }
      
      // Check for duplicate edges
      const existingEdges = edgeMap.get(edge.from) || []
      const duplicate = existingEdges.find(e => e.to === edge.to && e.guard === edge.guard)
      if (duplicate) {
        issues.push({
          type: 'warning',
          message: `Duplicate edge from '${edge.from}' to '${edge.to}'`,
          location: `workflows.${workflowName}.edges[${index}]`
        })
      }
      
      // Build edge map for reachability analysis
      if (!edgeMap.has(edge.from)) {
        edgeMap.set(edge.from, [])
      }
      edgeMap.get(edge.from)!.push(edge)
      
      // Track reachable steps
      if (reachableSteps.has(edge.from)) {
        reachableSteps.add(edge.to)
        unreachableSteps.delete(edge.to)
      }
    })
    
    // Find dead ends (steps with no outgoing edges that aren't terminals)
    Object.keys(steps).forEach(stepName => {
      if (!edgeMap.has(stepName) && stepName !== 'SUCCESS' && stepName !== 'FAILURE') {
        deadEnds.push(stepName)
      }
    })
    
    // Detect cycles using DFS
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    
    const detectCycles = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node)
        cycles.push(path.slice(cycleStart))
        return
      }
      
      if (visited.has(node)) return
      
      visited.add(node)
      recursionStack.add(node)
      
      const edges = edgeMap.get(node) || []
      edges.forEach(edge => {
        detectCycles(edge.to, [...path, edge.to])
      })
      
      recursionStack.delete(node)
    }
    
    if (workflow.root) {
      detectCycles(workflow.root, [workflow.root])
    }
    
    // Add issues for analysis results
    if (unreachableSteps.size > 0) {
      issues.push({
        type: 'warning',
        message: `Unreachable steps: ${Array.from(unreachableSteps).join(', ')}`,
        location: `workflows.${workflowName}`
      })
    }
    
    if (deadEnds.length > 0) {
      issues.push({
        type: 'warning',
        message: `Dead end steps: ${deadEnds.join(', ')}`,
        location: `workflows.${workflowName}`
      })
    }
    
    if (cycles.length > 0) {
      cycles.forEach((cycle, index) => {
        issues.push({
          type: 'error',
          message: `Cycle detected: ${cycle.join(' → ')}`,
          location: `workflows.${workflowName}.cycle[${index}]`
        })
      })
    }
    
    return {
      workflow: workflowName,
      issues,
      reachableSteps: Array.from(reachableSteps),
      unreachableSteps: Array.from(unreachableSteps),
      deadEnds,
      cycles
    }
  }, [steps])
  
  // Validate all workflows
  const validationResults = useMemo(() => {
    return Object.entries(workflows).map(([name, workflow]) => 
      validateWorkflow(name, workflow)
    )
  }, [workflows, validateWorkflow])
  
  const createWorkflow = useCallback(() => {
    if (!newWorkflowName.trim()) return
    
    const name = newWorkflowName.trim()
    if (workflows[name]) {
      alert('Workflow name already exists')
      return
    }
    
    const newWorkflow: WorkflowDef = {
      root: '',
      edges: []
    }
    
    onConfigChange({
      ...config,
      workflows: {
        ...workflows,
        [name]: newWorkflow
      }
    })
    
    setNewWorkflowName('')
    setShowCreateForm(false)
    onActiveWorkflowChange(name)
  }, [newWorkflowName, workflows, config, onConfigChange, onActiveWorkflowChange])
  
  // Listen for external workflow creation trigger
  useEffect(() => {
    const handleCreateWorkflow = () => {
      setShowCreateForm(true)
      // Auto-generate a unique workflow name
      const workflowCount = Object.keys(workflows).length
      const defaultName = `workflow${workflowCount + 1}`
      setNewWorkflowName(defaultName)
      // Focus the input after a small delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
    
    document.addEventListener('createWorkflow', handleCreateWorkflow)
    return () => document.removeEventListener('createWorkflow', handleCreateWorkflow)
  }, [workflows])
  
  const deleteWorkflow = useCallback((workflowName: string) => {
    if (!confirm(`Delete workflow "${workflowName}"?`)) return
    
    const newWorkflows = { ...workflows }
    delete newWorkflows[workflowName]
    
    onConfigChange({
      ...config,
      workflows: newWorkflows
    })
    
    if (activeWorkflow === workflowName) {
      const remaining = Object.keys(newWorkflows)
      if (remaining.length > 0) {
        onActiveWorkflowChange(remaining[0])
      } else {
        // Clear active workflow when no workflows remain
        onActiveWorkflowChange('')
      }
    }
  }, [workflows, config, activeWorkflow, onConfigChange, onActiveWorkflowChange])
  
  const updateWorkflow = useCallback((workflowName: string, updates: Partial<WorkflowDef>) => {
    const updatedWorkflow = { ...workflows[workflowName], ...updates }
    
    onConfigChange({
      ...config,
      workflows: {
        ...workflows,
        [workflowName]: updatedWorkflow
      }
    })
  }, [workflows, config, onConfigChange])
  
  const addEdge = useCallback((workflowName: string) => {
    const workflow = workflows[workflowName]
    if (!workflow) return
    
    const newEdge: EdgeDef = {
      from: '',
      to: '',
      guard: ''
    }
    
    updateWorkflow(workflowName, {
      edges: [...workflow.edges, newEdge]
    })
  }, [workflows, updateWorkflow])
  
  const removeEdge = useCallback((workflowName: string, edgeIndex: number) => {
    const workflow = workflows[workflowName]
    if (!workflow) return
    
    const newEdges = workflow.edges.filter((_, i) => i !== edgeIndex)
    updateWorkflow(workflowName, { edges: newEdges })
  }, [workflows, updateWorkflow])
  
  const updateEdge = useCallback((workflowName: string, edgeIndex: number, updates: Partial<EdgeDef>) => {
    const workflow = workflows[workflowName]
    if (!workflow) return
    
    const newEdges = [...workflow.edges]
    newEdges[edgeIndex] = { ...newEdges[edgeIndex], ...updates }
    updateWorkflow(workflowName, { edges: newEdges })
  }, [workflows, updateWorkflow])
  
  const getWorkflowStatus = (result: WorkflowValidationResult) => {
    const errorCount = result.issues.filter(i => i.type === 'error').length
    const warningCount = result.issues.filter(i => i.type === 'warning').length
    
    if (errorCount > 0) return { status: 'error', icon: XCircle, color: 'text-red-500' }
    if (warningCount > 0) return { status: 'warning', icon: AlertTriangle, color: 'text-yellow-500' }
    return { status: 'valid', icon: CheckCircle, color: 'text-green-500' }
  }
  
  return (
    <div className={embedded ? "w-full bg-card flex flex-col" : "w-96 border-r border-border bg-card flex flex-col"}>
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Workflows
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowValidation(!showValidation)}
              title={showValidation ? 'Hide validation' : 'Show validation'}
            >
              {showValidation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            {!showCreateForm && (
              <Button
                size="sm"
                onClick={() => {
                  setShowCreateForm(true)
                  setNewWorkflowName('')
                  setTimeout(() => inputRef.current?.focus(), 50)
                }}
                className="w-8 h-8 p-0"
                title="Add Workflow"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {showCreateForm && (
          <div className="flex gap-2 mb-3">
            <Input
              ref={inputRef}
              value={newWorkflowName}
              onChange={(e) => setNewWorkflowName(e.target.value)}
              placeholder="New workflow name"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') createWorkflow()
                if (e.key === 'Escape') {
                  setShowCreateForm(false)
                  setNewWorkflowName('')
                }
              }}
            />
            <Button 
              size="sm" 
              onClick={createWorkflow} 
              disabled={!newWorkflowName.trim()}
              className="w-8 h-8 p-0"
            >
              <CheckCircle className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => {
                setShowCreateForm(false)
                setNewWorkflowName('')
              }}
              className="w-8 h-8 p-0"
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-3 space-y-2">
          {Object.keys(workflows).length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Workflow className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No workflows defined</p>
              <p className="text-xs">Click the + button to create your first workflow</p>
            </div>
          ) : (
            Object.entries(workflows).map(([name, workflow]) => {
              const result = validationResults.find(r => r.workflow === name)!
              const { status, icon: StatusIcon, color } = getWorkflowStatus(result)
              const isActive = activeWorkflow === name
              const isSelected = selectedWorkflow === name
              
              return (
                <Card 
                  key={name} 
                  className={cn(
                    'p-3 cursor-pointer transition-colors',
                    isActive && 'ring-2 ring-blue-500 ring-opacity-50',
                    isSelected && 'bg-accent'
                  )}
                  onClick={() => {
                    setSelectedWorkflow(isSelected ? '' : name)
                    onActiveWorkflowChange(name)
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn('w-4 h-4', color)} />
                      <span className="font-medium text-sm">{name}</span>
                      {isActive && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {onAnalyzeWorkflow && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAnalyzeWorkflow(name)
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteWorkflow(name)
                        }}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Root:</span>
                      <span className="font-mono">{workflow.root || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Edges:</span>
                      <span>{workflow.edges.length}</span>
                    </div>
                    {showValidation && result.issues.length > 0 && (
                      <div className="flex justify-between">
                        <span>Issues:</span>
                        <span className={color}>{result.issues.length}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Expanded workflow details */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <Tabs defaultValue="properties" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="properties" className="text-xs">Properties</TabsTrigger>
                          <TabsTrigger value="edges" className="text-xs">Edges</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="properties" className="space-y-3 mt-3">
                          <div>
                            <label className="text-xs font-medium mb-1 block">Root Step</label>
                            <select
                              value={workflow.root}
                              onChange={(e) => updateWorkflow(name, { root: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="">Select root step...</option>
                              {Object.keys(steps).map(stepName => (
                                <option key={stepName} value={stepName}>{stepName}</option>
                              ))}
                            </select>
                          </div>
                          
                          {showValidation && (
                            <div>
                              <div className="flex items-center gap-1 mb-2">
                                <Target className="w-3 h-3" />
                                <span className="text-xs font-medium">Analysis</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span>Reachable:</span>
                                  <span className="text-green-600">{result.reachableSteps.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Unreachable:</span>
                                  <span className="text-yellow-600">{result.unreachableSteps.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Dead ends:</span>
                                  <span className="text-orange-600">{result.deadEnds.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Cycles:</span>
                                  <span className="text-red-600">{result.cycles.length}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="edges" className="space-y-2 mt-3">
                          {workflow.edges.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">
                              <GitBranch className="w-6 h-6 mx-auto mb-1 opacity-50" />
                              <p className="text-xs">No edges defined</p>
                            </div>
                          ) : (
                            workflow.edges.map((edge, index) => (
                              <div key={index} className="bg-muted rounded p-2 space-y-2">
                                <div className="flex justify-between items-start">
                                  <span className="text-xs font-medium">Edge {index + 1}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeEdge(name, index)}
                                    className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs mb-1 block">From</label>
                                    <select
                                      value={edge.from}
                                      onChange={(e) => updateEdge(name, index, { from: e.target.value })}
                                      className="w-full h-6 rounded border border-input bg-background px-1 text-xs"
                                    >
                                      <option value="">Select...</option>
                                      {Object.keys(steps).map(stepName => (
                                        <option key={stepName} value={stepName}>{stepName}</option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  <div>
                                    <label className="text-xs mb-1 block">To</label>
                                    <select
                                      value={edge.to}
                                      onChange={(e) => updateEdge(name, index, { to: e.target.value })}
                                      className="w-full h-6 rounded border border-input bg-background px-1 text-xs"
                                    >
                                      <option value="">Select...</option>
                                      {Object.keys(steps).map(stepName => (
                                        <option key={stepName} value={stepName}>{stepName}</option>
                                      ))}
                                      <option value="SUCCESS">SUCCESS</option>
                                      <option value="FAILURE">FAILURE</option>
                                    </select>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="text-xs mb-1 block">Guard (optional)</label>
                                  <Input
                                    value={edge.guard || ''}
                                    onChange={(e) => updateEdge(name, index, { guard: e.target.value })}
                                    placeholder="Guard class name"
                                    className="h-6 text-xs"
                                  />
                                </div>
                              </div>
                            ))
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addEdge(name)}
                            className="w-full h-7 text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Edge
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                  
                  {/* Validation issues */}
                  {showValidation && isSelected && result.issues.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-1 mb-2">
                        <AlertTriangle className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs font-medium">Validation Issues</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-auto">
                        {result.issues.map((issue, index) => (
                          <div key={index} className={cn(
                            'text-xs p-2 rounded',
                            issue.type === 'error' && 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
                            issue.type === 'warning' && 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
                            issue.type === 'info' && 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          )}>
                            <div className="font-medium capitalize">{issue.type}</div>
                            <div>{issue.message}</div>
                            {issue.location && (
                              <div className="font-mono text-xs opacity-70">{issue.location}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default WorkflowManager
