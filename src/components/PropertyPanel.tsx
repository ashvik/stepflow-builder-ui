import React, { useCallback, useState, useEffect } from 'react'
import { Node, Edge, useReactFlow, MarkerType } from 'reactflow'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Trash2, 
  Settings, 
  Shield, 
  RotateCcw, 
  CheckCircle, 
  XCircle,
  Copy,
  Zap
} from 'lucide-react'
import { StepNodeData, GuardNodeData } from '../types/stepflow'

interface PropertyPanelProps {
  selectedNodes: Node[]
  selectedEdges: Edge[]
  onUpdateNode: (nodeId: string, updates: Partial<Node>) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateEdge: (edgeId: string, updates: Partial<Edge>) => void
  onDeleteEdge: (edgeId: string) => void
  onCloneNode: (nodeId: string) => void
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedNodes,
  selectedEdges,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
  onCloneNode,
}) => {
  const { getNode, getEdge, getNodes, getEdges, addEdges } = useReactFlow()

  // Get the most up-to-date node data from React Flow
  const selectedNode = selectedNodes[0] ? getNode(selectedNodes[0].id) || selectedNodes[0] : undefined
  const selectedEdge = selectedEdges[0] ? getEdge(selectedEdges[0].id) || selectedEdges[0] : undefined

  // Local state for form inputs to ensure controlled components
  const [formData, setFormData] = useState<any>({})
  
  // Update form data when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setFormData({
        label: selectedNode.data.label || '',
        type: selectedNode.data.type || '',
        guard: selectedNode.data.guard || '',
        condition: selectedNode.data.condition || '',
        retryCount: selectedNode.data.retryCount || 0,
        retryGuard: selectedNode.data.retryGuard || '',
        config: selectedNode.data.config ? JSON.stringify(selectedNode.data.config, null, 2) : ''
      })
    } else if (selectedEdge) {
      setFormData({
        label: selectedEdge.label as string || ''
      })
    } else {
      setFormData({})
    }
  }, [selectedNode?.id, selectedEdge?.id])

  // Handle step node updates
  const updateStepNode = useCallback((field: string, value: any) => {
    if (!selectedNode) return

    // Update local form data immediately for UI responsiveness
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    const updates: Partial<Node> = {
      data: {
        ...selectedNode.data,
        [field]: value,
      },
    }

    onUpdateNode(selectedNode.id, updates)
  }, [selectedNode, onUpdateNode])

  // Handle guard node updates
  const updateGuardNode = useCallback((field: string, value: any) => {
    if (!selectedNode) return

    // Update local form data immediately for UI responsiveness
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    const updates: Partial<Node> = {
      data: {
        ...selectedNode.data,
        [field]: value,
      },
    }

    onUpdateNode(selectedNode.id, updates)
  }, [selectedNode, onUpdateNode])

  // Handle config updates
  const updateConfig = useCallback((configString: string) => {
    // Update local form data immediately for UI responsiveness
    setFormData(prev => ({
      ...prev,
      config: configString
    }))

    try {
      const config = configString.trim() ? JSON.parse(configString) : {}
      // Update the actual node data
      if (selectedNode) {
        const updates: Partial<Node> = {
          data: {
            ...selectedNode.data,
            config: config,
          },
        }
        onUpdateNode(selectedNode.id, updates)
      }
    } catch (error) {
      // Keep the text in the textarea even if JSON is invalid
      console.error('Invalid JSON config:', error)
    }
  }, [selectedNode, onUpdateNode])

  // Toggle node properties
  const toggleProperty = useCallback((property: string) => {
    if (!selectedNode) return
    const currentValue = selectedNode.data[property]
    updateStepNode(property, !currentValue)
  }, [selectedNode, updateStepNode])

  // Handle edge updates
  const updateEdgeProperty = useCallback((field: string, value: any) => {
    if (!selectedEdge) return

    const updates: Partial<Edge> = {}

    if (field === 'label') {
      updates.label = value
    } else if (field === 'className') {
      updates.className = value
    } else {
      updates.data = {
        ...selectedEdge.data,
        [field]: value,
      }
    }

    onUpdateEdge(selectedEdge.id, updates)
  }, [selectedEdge, onUpdateEdge])

  // Clone selected node
  const cloneNode = useCallback(() => {
    if (!selectedNode) return
    onCloneNode(selectedNode.id)
  }, [selectedNode, onCloneNode])

  if (selectedNodes.length === 0 && selectedEdges.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Select a node or edge to edit properties</p>
      </div>
    )
  }

  if (selectedNode) {
    const isStepNode = selectedNode.type === 'step'
    const isGuardNode = selectedNode.type === 'guard'
    const stepData = selectedNode.data as StepNodeData
    const guardData = selectedNode.data as GuardNodeData
    const allSteps = getNodes().filter(n => n.type === 'step' && !(n.data as any)?.isTerminal)
    const edges = getEdges()
    const successEdge = edges.find(e => e.source === selectedNode.id && (e.className?.includes('edge-guard-success') || (typeof e.label === 'string' && e.label.toUpperCase() === 'TRUE')))
    const failureEdge = edges.find(e => e.source === selectedNode.id && (e.className?.includes('edge-guard-failure') || (typeof e.label === 'string' && e.label.toUpperCase() === 'FALSE')))

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium flex items-center gap-2">
            {isStepNode && <Settings className="w-5 h-5" />}
            {isGuardNode && <Shield className="w-5 h-5" />}
            {isStepNode ? 'Step Properties' : 'Guard Properties'}
          </h3>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={cloneNode}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={() => onDeleteNode(selectedNode.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isStepNode && (
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Step Name</label>
                <Input
                  value={formData.label || ''}
                  onChange={(e) => updateStepNode('label', e.target.value)}
                  placeholder="Enter step name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Step Type</label>
                <Input
                  value={formData.type || ''}
                  onChange={(e) => updateStepNode('type', e.target.value)}
                  placeholder="Enter step type (e.g., ValidateOrderStep)"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Guard Class</label>
                <Input
                  value={formData.guard || ''}
                  onChange={(e) => updateStepNode('guard', e.target.value)}
                  placeholder="Enter guard class (optional)"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={stepData.isRoot ? 'default' : 'outline'}
                  onClick={() => toggleProperty('isRoot')}
                  className="flex-1"
                >
                  <Zap className="w-4 h-4 mr-1" />
                  Root Step
                </Button>
                <Button
                  size="sm"
                  variant={stepData.isTerminal ? 'default' : 'outline'}
                  onClick={() => toggleProperty('isTerminal')}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Terminal
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Configuration (JSON)</label>
                <Textarea
                  value={formData.config || ''}
                  onChange={(e) => updateConfig(e.target.value)}
                  placeholder='{"timeout": 5000, "retries": 3}'
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter JSON configuration for this step
                </p>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Retry Count</label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.retryCount || 0}
                    onChange={(e) => updateStepNode('retryCount', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Retry Guard</label>
                  <Input
                    value={formData.retryGuard || ''}
                    onChange={(e) => updateStepNode('retryGuard', e.target.value)}
                    placeholder="Retry condition class"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Retry Configuration
                </h4>
                <p className="text-xs text-muted-foreground">
                  Set retry count &gt; 0 to enable automatic retries. 
                  Add a retry guard to control when retries should happen.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {isGuardNode && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Guard Name</label>
              <Input
                value={formData.label || ''}
                onChange={(e) => updateGuardNode('label', e.target.value)}
                placeholder="Enter guard name"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Condition</label>
              <Input
                value={formData.condition || ''}
                onChange={(e) => updateGuardNode('condition', e.target.value)}
                placeholder="Enter condition class name"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Success Target (TRUE)</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={successEdge?.target || ''}
                  onChange={(e) => {
                    const target = e.target.value
                    if (successEdge) {
                      onUpdateEdge(successEdge.id, { target, className: 'edge-guard-success', label: 'TRUE', data: { ...(successEdge.data || {}), guard: guardData?.condition || '' } })
                    } else if (target) {
                      addEdges([{
                        id: `${selectedNode.id}-success-${Date.now()}`,
                        source: selectedNode.id,
                        sourceHandle: 'success',
                        target,
                        type: 'default',
                        className: 'edge-guard-success',
                        label: 'TRUE',
                        data: { guard: guardData?.condition || '' },
                        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#999' },
                      }])
                    }
                  }}
                >
                  <option value="">Select step...</option>
                  {allSteps.map(s => (
                    <option key={s.id} value={s.id}>{(s.data as any).label || s.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Failure Target (FALSE)</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={failureEdge?.target || ''}
                  onChange={(e) => {
                    const target = e.target.value
                    if (failureEdge) {
                      const cond = guardData?.condition || ''
                      const neg = cond ? (cond.startsWith('Not') ? cond : `Not${cond}`) : ''
                      onUpdateEdge(failureEdge.id, { target, className: 'edge-guard-failure', label: 'FALSE', data: { ...(failureEdge.data || {}), guard: neg } })
                    } else if (target) {
                      const cond = guardData?.condition || ''
                      const neg = cond ? (cond.startsWith('Not') ? cond : `Not${cond}`) : ''
                      addEdges([{
                        id: `${selectedNode.id}-failure-${Date.now()}`,
                        source: selectedNode.id,
                        sourceHandle: 'failure',
                        target,
                        type: 'default',
                        className: 'edge-guard-failure',
                        label: 'FALSE',
                        data: { guard: neg },
                        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#999' },
                      }])
                    }
                  }}
                >
                  <option value="">Select step...</option>
                  {allSteps.map(s => (
                    <option key={s.id} value={s.id}>{(s.data as any).label || s.id}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Guard Logic
              </h4>
              <p className="text-xs text-muted-foreground">
                Guards evaluate conditions and route the flow based on true/false results.
                Connect the green handle for success path and red handle for failure path.
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (selectedEdge) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Edge Properties</h3>
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={() => onDeleteEdge(selectedEdge.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Label</label>
          <Input
            key={`${selectedEdge.id}-label`}
            value={selectedEdge.label as string || ''}
            onChange={(e) => updateEdgeProperty('label', e.target.value)}
            placeholder="Edge label (optional)"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Guard Class (edge-level)</label>
          <Input
            key={`${selectedEdge.id}-guard`}
            value={(selectedEdge.data as any)?.guard || ''}
            onChange={(e) => updateEdgeProperty('guard', e.target.value)}
            placeholder="e.g., OrderValidGuard"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Evaluated after the source step completes; first TRUE guard wins.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Edge Type</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={selectedEdge.className?.includes('edge-retry') ? 'default' : 'outline'}
              onClick={() => updateEdgeProperty('className', 'edge-retry')}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Retry
            </Button>
            <Button
              size="sm"
              variant={selectedEdge.className?.includes('edge-terminal') ? 'default' : 'outline'}
              onClick={() => updateEdgeProperty('className', 'edge-terminal')}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Terminal
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p><strong>From:</strong> {selectedEdge.source}</p>
          <p><strong>To:</strong> {selectedEdge.target}</p>
        </div>
      </div>
    )
  }

  return null
}

export default PropertyPanel
