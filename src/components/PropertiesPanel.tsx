import React, { useState, useCallback, useMemo } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Card } from './ui/card'
import { 
  Settings, 
  Shield, 
  RotateCcw, 
  Clock,
  Plus,
  Minus,
  Copy,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  Target
} from 'lucide-react'
import { StepNodeData, GuardNodeData, StepFlowConfig, RetryPolicy, ComponentInfo, ValidationIssue, EdgeData } from '../types/stepflow'
import { cn } from '../lib/utils'
import { Edge } from 'reactflow'
import EdgePropertiesPanel from './EdgePropertiesPanel'

interface PropertiesPanelProps {
  selectedNodeId?: string
  selectedEdgeId?: string
  nodeData?: StepNodeData | GuardNodeData
  edgeData?: EdgeData
  edge?: Edge
  config: StepFlowConfig
  components: ComponentInfo[]
  onUpdateNode: (nodeId: string, updates: Partial<StepNodeData | GuardNodeData>) => void
  onUpdateEdge: (edgeId: string, updates: Partial<EdgeData>) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onCloneNode: (nodeId: string) => void
  onValidateNode?: (nodeId: string) => ValidationIssue[]
  embedded?: boolean
}

interface GuardConfig {
  name: string
  enabled: boolean
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNodeId,
  selectedEdgeId,
  nodeData,
  edgeData,
  edge,
  config,
  components,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onCloneNode,
  onValidateNode,
  embedded = false,
}) => {
  const [activeTab, setActiveTab] = useState('basic')
  const [configJson, setConfigJson] = useState('')
  const [configError, setConfigError] = useState('')
  
  const isStepNode = nodeData && 'type' in nodeData && nodeData.type !== undefined
  const stepData = isStepNode ? nodeData as StepNodeData : undefined
  const guardData = !isStepNode ? nodeData as GuardNodeData : undefined
  
  // Get available components for the current node type
  const availableComponents = useMemo(() => {
    const nodeType = isStepNode ? 'step' : 'guard'
    return components.filter(comp => comp.type === nodeType)
  }, [components, isStepNode])
  
  // Get validation issues for the current node
  const validationIssues = useMemo(() => {
    if (!selectedNodeId || !onValidateNode) return []
    return onValidateNode(selectedNodeId)
  }, [selectedNodeId, onValidateNode])
  
  // Initialize config JSON when node changes
  React.useEffect(() => {
    if (nodeData?.config) {
      setConfigJson(JSON.stringify(nodeData.config, null, 2))
      setConfigError('')
    } else {
      setConfigJson('')
      setConfigError('')
    }
  }, [nodeData])
  
  const updateNode = useCallback((updates: Partial<StepNodeData | GuardNodeData>) => {
    if (!selectedNodeId) return
    onUpdateNode(selectedNodeId, updates)
  }, [selectedNodeId, onUpdateNode])
  
  const updateConfig = useCallback((jsonString: string) => {
    setConfigJson(jsonString)
    
    if (!jsonString.trim()) {
      setConfigError('')
      updateNode({ config: undefined })
      return
    }
    
    try {
      const parsed = JSON.parse(jsonString)
      setConfigError('')
      updateNode({ config: parsed })
    } catch (error) {
      setConfigError('Invalid JSON syntax')
    }
  }, [updateNode])
  
  const addGuard = useCallback(() => {
    if (!stepData) return
    const currentGuards = stepData.guards || []
    updateNode({ guards: [...currentGuards, ''] })
  }, [stepData, updateNode])
  
  const removeGuard = useCallback((index: number) => {
    if (!stepData) return
    const currentGuards = stepData.guards || []
    const newGuards = currentGuards.filter((_, i) => i !== index)
    updateNode({ guards: newGuards.length > 0 ? newGuards : undefined })
  }, [stepData, updateNode])
  
  const updateGuard = useCallback((index: number, value: string) => {
    if (!stepData) return
    const currentGuards = stepData.guards || []
    const newGuards = [...currentGuards]
    newGuards[index] = value
    updateNode({ guards: newGuards })
  }, [stepData, updateNode])
  
  const updateRetryPolicy = useCallback((updates: Partial<RetryPolicy>) => {
    if (!stepData) return
    const currentRetry = stepData.retry || { maxAttempts: 1, delay: 1000 }
    const newRetry = { ...currentRetry, ...updates }
    updateNode({ retry: newRetry })
  }, [stepData, updateNode])
  
  const removeRetryPolicy = useCallback(() => {
    if (!stepData) return
    updateNode({ retry: undefined })
  }, [stepData, updateNode])
  
  const cloneNode = useCallback(() => {
    if (!selectedNodeId) return
    onCloneNode(selectedNodeId)
  }, [selectedNodeId, onCloneNode])
  
  const deleteNode = useCallback(() => {
    if (!selectedNodeId || !nodeData) return
    const name = nodeData.label || selectedNodeId
    if (confirm(`Delete ${isStepNode ? 'step' : 'guard'} "${name}"?`)) {
      onDeleteNode(selectedNodeId)
    }
  }, [selectedNodeId, nodeData, isStepNode, onDeleteNode])
  
  // Handle edge selection
  if (selectedEdgeId && edgeData && edge) {
    const content = (
      <div className="flex-1 overflow-auto p-3">
        <EdgePropertiesPanel
          selectedEdgeId={selectedEdgeId}
          edgeData={edgeData}
          edge={edge}
          config={config}
          onUpdateEdge={onUpdateEdge}
          onDeleteEdge={onDeleteEdge}
        />
      </div>
    )
    if (embedded) return content
    return (
      <div className="w-96 border-l border-border bg-card flex flex-col">
        {content}
      </div>
    )
  }
  
  // Handle no selection
  if (!nodeData || !selectedNodeId) {
    const content = (
      <div className="p-4 text-center text-muted-foreground">
        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Select a node or edge to edit properties</p>
      </div>
    )
    if (embedded) return content
    return (
      <div className="w-80 border-l border-border bg-card flex flex-col">
        {content}
      </div>
    )
  }
  
  const body = (
    <div className="flex flex-col">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {isStepNode ? <Settings className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            {isStepNode ? 'Step Properties' : 'Guard Properties'}
          </h2>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={cloneNode}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="destructive" onClick={deleteNode}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Validation Issues Summary */}
        {validationIssues.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            {validationIssues.some(i => i.type === 'error') && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span>{validationIssues.filter(i => i.type === 'error').length} errors</span>
              </div>
            )}
            {validationIssues.some(i => i.type === 'warning') && (
              <div className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="w-4 h-4" />
                <span>{validationIssues.filter(i => i.type === 'warning').length} warnings</span>
              </div>
            )}
            {validationIssues.some(i => i.type === 'info') && (
              <div className="flex items-center gap-1 text-blue-600">
                <Info className="w-4 h-4" />
                <span>{validationIssues.filter(i => i.type === 'info').length} info</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 mx-3 mt-3">
          <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
          <TabsTrigger value="config" className="text-xs">Config</TabsTrigger>
          {isStepNode && (
            <>
              <TabsTrigger value="guards" className="text-xs">Guards</TabsTrigger>
              <TabsTrigger value="retry" className="text-xs">Retry</TabsTrigger>
            </>
          )}
          {!isStepNode && (
            <TabsTrigger value="validation" className="text-xs">Issues</TabsTrigger>
          )}
        </TabsList>
        
        <div className="flex-1 overflow-auto">
          <TabsContent value="basic" className="p-3 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                value={nodeData.label || ''}
                onChange={(e) => updateNode({ label: e.target.value })}
                placeholder={isStepNode ? 'Step name' : 'Guard name'}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <div className="space-y-2">
                <select
                  value={nodeData.type || ''}
                  onChange={(e) => updateNode({ type: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Select component type...</option>
                  {availableComponents.map((comp) => (
                    <option key={comp.name} value={comp.name}>{comp.name}</option>
                  ))}
                </select>
                
                {/* Manual type input */}
                <Input
                  value={nodeData.type || ''}
                  onChange={(e) => updateNode({ type: e.target.value })}
                  placeholder={isStepNode ? 'e.g., ValidateOrderStep' : 'e.g., OrderValueGuard'}
                  className="text-sm font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Component type resolved by: annotation name, class name, lowerCamel, or FQCN
              </p>
            </div>
            
            {isStepNode && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={stepData?.isRoot ? 'default' : 'outline'}
                  onClick={() => updateNode({ isRoot: !stepData?.isRoot })}
                  className="flex-1"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Root Step
                </Button>
                <Button
                  size="sm"
                  variant={stepData?.isTerminal ? 'default' : 'outline'}
                  onClick={() => updateNode({ isTerminal: !stepData?.isTerminal })}
                  className="flex-1"
                >
                  <Target className="w-4 h-4 mr-1" />
                  Terminal
                </Button>
              </div>
            )}
            
            {/* Component Info */}
            {nodeData.type && (
              <Card className="p-3">
                <div className="text-sm font-medium mb-2">Component Info</div>
                <div className="text-xs text-muted-foreground">
                  Type: <span className="font-mono">{nodeData.type}</span>
                  <div className="mt-1">Component will be resolved at runtime</div>
                </div>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="config" className="p-3 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Configuration (JSON)</label>
              <Textarea
                value={configJson}
                onChange={(e) => updateConfig(e.target.value)}
                placeholder='{\n  "timeout": 5000,\n  "retries": 3,\n  "enabled": true\n}'
                className="min-h-[200px] font-mono text-sm"
              />
              {configError && (
                <p className="text-xs text-red-600 mt-1">{configError}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Configuration injected into component fields/methods via @ConfigValue
              </p>
            </div>
            
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">Effective Configuration</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Merge order (last wins):</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Category defaults ({isStepNode ? 'step' : 'guard'})</li>
                  <li>Named defaults ({nodeData.type || 'componentType'})</li>
                  <li>Individual config (above)</li>
                  <li>Global settings (via @ConfigValue globalPath)</li>
                </ol>
              </div>
            </Card>
          </TabsContent>
          
          {isStepNode && (
            <>
              <TabsContent value="guards" className="p-3 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium">Step Guards</label>
                    <Button size="sm" variant="outline" onClick={addGuard}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Guard
                    </Button>
                  </div>
                  
                  {(!stepData?.guards || stepData.guards.length === 0) ? (
                    <div className="text-center text-muted-foreground py-6">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No guards configured</p>
                      <p className="text-xs">Guards control step execution</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stepData.guards.map((guard, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Guard {index + 1}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeGuard(index)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          <Input
                            value={guard}
                            onChange={(e) => updateGuard(index, e.target.value)}
                            placeholder="Guard class name or step name"
                            className="font-mono text-sm"
                          />
                          
                          <p className="text-xs text-muted-foreground mt-1">
                            Reference by step name (if guard defined as step) or guard type/name
                          </p>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  <Card className="p-3">
                    <div className="text-sm font-medium mb-2">Guard Behavior</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• All guards must pass (AND logic)</p>
                      <p>• If any guard fails, step is skipped</p>
                      <p>• Engine attempts to route from same node</p>
                      <p>• If no eligible transition exists, workflow fails</p>
                    </div>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="retry" className="p-3 space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Engine-Driven Retry Policy
                  </label>
                  {stepData?.retry ? (
                    <Button size="sm" variant="outline" onClick={removeRetryPolicy}>
                      <Minus className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => updateRetryPolicy({ maxAttempts: 3, delay: 1000 })}>
                      <Plus className="w-4 h-4 mr-1" />
                      Enable
                    </Button>
                  )}
                </div>
                
                {!stepData?.retry ? (
                  <div className="text-center text-muted-foreground py-6">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No retry policy configured</p>
                    <p className="text-xs">Step executes once (internal retry up to step)</p>
                  </div>
                ) : (
                  <Card className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Max Attempts</label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={stepData.retry.maxAttempts}
                          onChange={(e) => updateRetryPolicy({ maxAttempts: parseInt(e.target.value) || 1 })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Number of engine attempts (&gt;=1)</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Delay (ms)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={stepData.retry.delay}
                          onChange={(e) => updateRetryPolicy({ delay: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Sleep between attempts</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Retry Guard (Optional)</label>
                      <Input
                        value={stepData.retry.guard || ''}
                        onChange={(e) => updateRetryPolicy({ guard: e.target.value || undefined })}
                        placeholder="Guard to decide whether to retry"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        If present, evaluated after failure to decide if retry should happen
                      </p>
                    </div>
                  </Card>
                )}
                
                <Card className="p-3">
                  <div className="text-sm font-medium mb-2">Retry Behavior</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Engine-driven retry for consistent behavior</p>
                    <p>• When step fails, retry guard is evaluated (if present)</p>
                    <p>• If guard allows or no guard, engine sleeps delay ms</p>
                    <p>• Retries up to maxAttempts</p>
                    <p>• If attempts exhausted, step returns FAILURE with last result</p>
                  </div>
                </Card>
              </TabsContent>
            </>
          )}
          
          <TabsContent value="validation" className="p-3 space-y-4">
            <div>
              <div className="text-sm font-medium mb-3">Validation Issues</div>
              
              {validationIssues.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">No validation issues</p>
                  <p className="text-xs">Configuration looks good!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {validationIssues.map((issue, index) => (
                    <Card key={index} className={cn(
                      'p-3',
                      issue.type === 'error' && 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
                      issue.type === 'warning' && 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20',
                      issue.type === 'info' && 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    )}>
                      <div className="flex items-start gap-2">
                        {issue.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                        {issue.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />}
                        {issue.type === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                        
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'text-sm font-medium capitalize',
                            issue.type === 'error' && 'text-red-700 dark:text-red-300',
                            issue.type === 'warning' && 'text-yellow-700 dark:text-yellow-300',
                            issue.type === 'info' && 'text-blue-700 dark:text-blue-300'
                          )}>
                            {issue.type}
                          </div>
                          <div className={cn(
                            'text-sm',
                            issue.type === 'error' && 'text-red-600 dark:text-red-400',
                            issue.type === 'warning' && 'text-yellow-600 dark:text-yellow-400',
                            issue.type === 'info' && 'text-blue-600 dark:text-blue-400'
                          )}>
                            {issue.message}
                          </div>
                          {issue.location && (
                            <div className="text-xs font-mono text-muted-foreground mt-1">
                              {issue.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )

  if (embedded) return body
  return (
    <div className="w-96 border-l border-border bg-card">
      {body}
    </div>
  )
}

export default PropertiesPanel
