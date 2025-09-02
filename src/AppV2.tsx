import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  NodeChange,
  EdgeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Button } from './components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import StepNode from './components/nodes/StepNode'
import GuardNode from './components/nodes/GuardNode'
import { SimulationPanel } from './components/SimulationPanel'
import { CollaborationPanel, CollaboratorCursor } from './components/CollaborationPanel'
import ConfigurationSidebar from './components/ConfigurationSidebar'
import WorkflowManagerV2 from './components/WorkflowManagerV2'
import PropertiesPanel from './components/PropertiesPanel'
import { QuickAddStepDialog } from './components/QuickAddStepDialog'

import { 
  Sun, 
  Moon, 
  Download,
  Upload,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  LayoutDashboard,
  AlertTriangle,
  Plus,
  FolderGit2,
  Shield,
  PlusSquare,
  Zap,
  Undo,
  Redo,
  Menu,
  X,
  Settings,
  Wifi,
  WifiOff,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react'

import { 
  StepFlowConfig, 
  StepNodeData, 
  GuardNodeData, 
  ComponentInfo, 
  AppState,
  ValidationIssue,
  WorkflowDef,
  FlowConfig,
  WorkflowFormat,
  YamlFormat,
  StepDef,
  EdgeData,
  EdgeFailureStrategy
} from './types/stepflow'
import YAML from 'yaml'
import { YamlConverter } from './lib/yaml-converter'
import { YamlHighlighter } from './lib/yaml-highlighter'
import { generateId } from './lib/utils'
import { useUndoRedo, useUndoRedoShortcuts } from './hooks/useUndoRedo'
import { WorkflowSimulator } from './lib/workflow-simulator'
import { CollaborationManager } from './lib/collaboration'
import { useDebounce, useThrottle, performanceMonitor, WorkflowCache } from './lib/performance'

const nodeTypes = { step: StepNode, guard: GuardNode }

// Mock component data - in a real app this would come from the backend
const MOCK_COMPONENTS: ComponentInfo[] = [
  { name: 'ValidateOrderStep', type: 'step', className: 'ValidateOrderStep', package: 'com.example.steps' },
  { name: 'ProcessPaymentStep', type: 'step', className: 'ProcessPaymentStep', package: 'com.example.steps' },
  { name: 'SendNotificationStep', type: 'step', className: 'SendNotificationStep', package: 'com.example.steps' },
  { name: 'OrderValueGuard', type: 'guard', className: 'OrderValueGuard', package: 'com.example.guards' },
  { name: 'PaymentSuccessGuard', type: 'guard', className: 'PaymentSuccessGuard', package: 'com.example.guards' },
]

const INITIAL_CONFIG: StepFlowConfig = {
  settings: {},
  defaults: {},
  steps: {},
  workflows: {}
}

interface WorkflowTabState {
  workflowName: string
  nodes: Node[]
  edges: Edge[]
  selectedNodes: string[]
  selectedEdges: string[]
  viewport: { x: number; y: number; zoom: number }
}

interface AppStateV2 extends Omit<AppState, 'activeWorkflow' | 'ui'> {
  workflowTabs: WorkflowTabState[]
  activeTabIndex: number
  ui: {
    panels: {
      navigator: boolean
      properties: boolean
      console: boolean
    }
    showAllWorkflows: boolean // Toggle to show all workflows in overview
  }
}

const StepFlowBuilderAppV2: React.FC = () => {
  const [appState, setAppState] = useState<AppStateV2>({
    config: INITIAL_CONFIG,
    workflowTabs: [],
    activeTabIndex: 0,
    components: [],
    scanPackages: [],
    ui: {
      panels: {
        navigator: true,
        properties: true,
        console: false,
      },
      showAllWorkflows: false
    }
  })

  const [darkMode, setDarkMode] = useState(false)
  const [collaborationEnabled, setCollaborationEnabled] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationIssue[]>([])
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddPosition, setQuickAddPosition] = useState({ x: 0, y: 0 })

  // Get current active workflow tab
  const activeTab = useMemo(() => {
    return appState.workflowTabs[appState.activeTabIndex]
  }, [appState.workflowTabs, appState.activeTabIndex])

  const nodes = activeTab?.nodes || []
  const edges = activeTab?.edges || []
  const selectedNodeIds = activeTab?.selectedNodes || []
  const selectedEdgeIds = activeTab?.selectedEdges || []

  // Undo/Redo for current active tab
  const { undo, redo, canUndo, canRedo, pushState } = useUndoRedo({
    nodes: nodes,
    edges: edges,
    config: appState.config
  }, {
    maxHistorySize: 50,
    debounceMs: 500,
    autoSave: true
  })

  // Initialize components
  useEffect(() => {
    setAppState(prev => ({ ...prev, components: MOCK_COMPONENTS }))
  }, [])

  // Setup keyboard shortcuts
  useUndoRedoShortcuts(undo, redo)

  // Create a new workflow tab
  const createWorkflowTab = useCallback((workflowName: string) => {
    const newTab: WorkflowTabState = {
      workflowName,
      nodes: [],
      edges: [],
      selectedNodes: [],
      selectedEdges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    setAppState(prev => ({
      ...prev,
      workflowTabs: [...prev.workflowTabs, newTab],
      activeTabIndex: prev.workflowTabs.length
    }))
  }, [])

  // Close workflow tab
  const closeWorkflowTab = useCallback((index: number) => {
    setAppState(prev => {
      const newTabs = prev.workflowTabs.filter((_, i) => i !== index)
      const newActiveIndex = Math.max(0, Math.min(prev.activeTabIndex, newTabs.length - 1))
      
      return {
        ...prev,
        workflowTabs: newTabs,
        activeTabIndex: newTabs.length === 0 ? 0 : newActiveIndex
      }
    })
  }, [])

  // Switch to workflow tab (create if doesn't exist)
  const switchToWorkflowTab = useCallback((workflowName: string) => {
    const existingTabIndex = appState.workflowTabs.findIndex(tab => tab.workflowName === workflowName)
    
    if (existingTabIndex !== -1) {
      setAppState(prev => ({ ...prev, activeTabIndex: existingTabIndex }))
    } else {
      createWorkflowTab(workflowName)
    }
  }, [appState.workflowTabs, createWorkflowTab])

  // Update current tab state
  const updateActiveTab = useCallback((updates: Partial<WorkflowTabState>) => {
    if (!activeTab) return

    setAppState(prev => ({
      ...prev,
      workflowTabs: prev.workflowTabs.map((tab, index) =>
        index === prev.activeTabIndex ? { ...tab, ...updates } : tab
      )
    }))
  }, [activeTab])

  // Add step to current workflow
  const handleAddStep = useCallback((stepName: string, stepType: string, position?: { x: number; y: number }) => {
    if (!activeTab) return

    // Add step to configuration
    const newStepDef: StepDef = {
      type: stepType
    }

    const newConfig = {
      ...appState.config,
      steps: {
        ...appState.config.steps,
        [stepName]: newStepDef
      }
    }

    setAppState(prev => ({ ...prev, config: newConfig }))

    // Add node to current tab
    const newNode: Node = {
      id: stepName,
      type: 'step',
      position: position || { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: {
        id: stepName,
        label: stepName,
        type: stepType,
        workflow: activeTab.workflowName,
      } as StepNodeData,
    }

    updateActiveTab({ nodes: [...nodes, newNode] })
  }, [activeTab, appState.config, nodes, updateActiveTab])

  // Add edge connection
  const onConnect = useCallback((connection: Connection) => {
    if (!activeTab || !connection.source || !connection.target) return

    const newEdge: Edge = {
      id: `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      type: 'default',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        id: `${connection.source}-${connection.target}`,
        kind: 'normal'
      } as EdgeData
    }

    const updatedEdges = [...edges, newEdge]
    updateActiveTab({ edges: updatedEdges })

    // Also update workflow configuration
    if (appState.config.workflows?.[activeTab.workflowName]) {
      const workflow = appState.config.workflows[activeTab.workflowName]
      const newEdgeDef = {
        from: connection.source,
        to: connection.target
      }
      
      const updatedWorkflow: WorkflowDef = {
        ...workflow,
        edges: [...workflow.edges, newEdgeDef]
      }

      const newConfig = {
        ...appState.config,
        workflows: {
          ...appState.config.workflows,
          [activeTab.workflowName]: updatedWorkflow
        }
      }
      
      setAppState(prev => ({ ...prev, config: newConfig }))
    }
  }, [activeTab, edges, updateActiveTab, appState.config])

  // Canvas context menu for adding steps
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    if (!activeTab) return
    
    setQuickAddPosition({ x: event.clientX, y: event.clientY })
    setShowQuickAdd(true)
  }, [activeTab])

  // Delete node
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!activeTab) return

    // Remove from tab
    const updatedNodes = nodes.filter(n => n.id !== nodeId)
    const updatedEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    updateActiveTab({ nodes: updatedNodes, edges: updatedEdges, selectedNodes: [] })

    // Remove from configuration
    const newSteps = { ...appState.config.steps }
    delete newSteps[nodeId]
    
    const newConfig = {
      ...appState.config,
      steps: newSteps
    }
    
    setAppState(prev => ({ ...prev, config: newConfig }))
  }, [activeTab, nodes, edges, updateActiveTab, appState.config])

  // Update node
  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<StepNodeData>) => {
    if (!activeTab) return

    // Update node in tab
    const updatedNodes = nodes.map(node => 
      node.id === nodeId 
        ? { ...node, data: { ...node.data, ...updates } }
        : node
    )
    updateActiveTab({ nodes: updatedNodes })

    // Update step in configuration
    if (appState.config.steps?.[nodeId]) {
      const newSteps = {
        ...appState.config.steps,
        [nodeId]: {
          ...appState.config.steps[nodeId],
          type: updates.type || appState.config.steps[nodeId].type,
          config: updates.config || appState.config.steps[nodeId].config,
          guards: updates.guards || appState.config.steps[nodeId].guards,
          retry: updates.retry || appState.config.steps[nodeId].retry
        }
      }
      
      const newConfig = {
        ...appState.config,
        steps: newSteps
      }
      
      setAppState(prev => ({ ...prev, config: newConfig }))
    }
  }, [activeTab, nodes, updateActiveTab, appState.config])

  // Update edge
  const handleUpdateEdge = useCallback((edgeId: string, updates: Partial<EdgeData>) => {
    if (!activeTab) return

    // Update edge in tab
    const updatedEdges = edges.map(edge => 
      edge.id === edgeId 
        ? { ...edge, data: { ...edge.data, ...updates } }
        : edge
    )
    updateActiveTab({ edges: updatedEdges })

    // TODO: Update workflow configuration
  }, [activeTab, edges, updateActiveTab])

  // Delete edge
  const handleDeleteEdge = useCallback((edgeId: string) => {
    if (!activeTab) return

    const updatedEdges = edges.filter(e => e.id !== edgeId)
    updateActiveTab({ edges: updatedEdges, selectedEdges: [] })
    
    // TODO: Update workflow configuration
  }, [activeTab, edges, updateActiveTab])

  // Generate nodes and edges for current workflow
  const generateNodesAndEdges = useMemo(() => {
    if (!activeTab || !appState.config.workflows?.[activeTab.workflowName]) {
      return { nodes: [], edges: [] }
    }

    const { config } = appState
    const workflow = config.workflows[activeTab.workflowName]
    const stepNodes: Node[] = []
    const workflowEdges: Edge[] = []

    // Create nodes for all steps referenced in the workflow
    const referencedSteps = new Set<string>()
    
    // Add root step
    referencedSteps.add(workflow.root)
    
    // Add terminal steps
    referencedSteps.add('SUCCESS')
    referencedSteps.add('FAILURE')
    
    // Add all steps from edges
    workflow.edges.forEach(edge => {
      referencedSteps.add(edge.from)
      if (edge.to !== 'SUCCESS' && edge.to !== 'FAILURE') {
        referencedSteps.add(edge.to)
      }
      if (edge.onFailure?.alternativeTarget) {
        referencedSteps.add(edge.onFailure.alternativeTarget)
      }
    })
    
    // Add all other steps from the config that might be part of this workflow
    // For now, we'll include all configured steps to make them available
    Object.keys(config.steps || {}).forEach(stepName => {
      if (!stepName.includes('_START') || stepName === workflow.root) {
        referencedSteps.add(stepName)
      }
    })

    // Generate step nodes
    let nodeIndex = 0
    referencedSteps.forEach(stepName => {
      const stepDef = config.steps?.[stepName]
      if (stepDef || stepName === 'SUCCESS' || stepName === 'FAILURE') {
        stepNodes.push({
          id: stepName,
          type: 'step',
          position: { 
            x: 200 + (nodeIndex % 4) * 250, 
            y: 100 + Math.floor(nodeIndex / 4) * 150 
          },
          data: {
            id: stepName,
            label: stepName,
            type: stepDef?.type || stepName,
            config: stepDef?.config,
            guards: stepDef?.guards,
            retry: stepDef?.retry,
            isRoot: stepName === workflow.root,
            isTerminal: stepName === 'SUCCESS' || stepName === 'FAILURE',
            workflow: activeTab.workflowName,
          } as StepNodeData,
        })
        nodeIndex++
      }
    })

    // Debug: Only log once when creating nodes
    if (stepNodes.length > 0) {
      console.log('Generated', stepNodes.length, 'nodes for workflow:', activeTab.workflowName)
    }

    // Generate edges
    workflow.edges.forEach((edgeDef, index) => {
      // Main edge
      const mainEdge: Edge = {
        id: `${edgeDef.from}-${edgeDef.to}-${index}`,
        source: edgeDef.from,
        target: edgeDef.to,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        label: edgeDef.guard ? `[${edgeDef.guard}]` : undefined,
        className: edgeDef.kind === 'terminal' ? 'edge-terminal' : 
                  edgeDef.onFailure?.strategy === 'ALTERNATIVE' ? 'edge-has-alternative' : 'edge-main',
        data: {
          id: `${edgeDef.from}-${edgeDef.to}-${index}`,
          label: edgeDef.guard,
          guard: edgeDef.guard,
          condition: edgeDef.condition,
          kind: edgeDef.kind === 'terminal' ? 'terminal' : 'normal',
          onFailure: edgeDef.onFailure
        } as EdgeData
      }
      workflowEdges.push(mainEdge)

      // Alternative failure edge (visual indicator)
      if (edgeDef.onFailure?.strategy === 'ALTERNATIVE' && edgeDef.onFailure.alternativeTarget) {
        const alternativeEdge: Edge = {
          id: `${edgeDef.from}-${edgeDef.onFailure.alternativeTarget}-failure-${index}`,
          source: edgeDef.from,
          target: edgeDef.onFailure.alternativeTarget,
          type: 'default',
          label: 'ON FAILURE',
          className: 'edge-failure edge-alternative-failure',
          markerEnd: { type: MarkerType.ArrowClosed },
          data: {
            id: `${edgeDef.from}-${edgeDef.onFailure.alternativeTarget}-failure-${index}`,
            label: 'ON FAILURE',
            kind: 'failure'
          } as EdgeData
        }
        workflowEdges.push(alternativeEdge)
      }
    })

    return { nodes: stepNodes, edges: workflowEdges }
  }, [appState.config, activeTab])

  // Initialize tab nodes when tab is created
  useEffect(() => {
    if (activeTab && activeTab.nodes.length === 0 && appState.config.workflows?.[activeTab.workflowName]) {
      console.log('Initializing nodes for new tab:', activeTab.workflowName)
      const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges
      updateActiveTab({ 
        nodes: newNodes, 
        edges: newEdges 
      })
    }
  }, [activeTab?.workflowName, appState.config.workflows]) // Only when tab changes or workflows change

  // Node change handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes)
    updateActiveTab({ nodes: updatedNodes })
  }, [nodes, updateActiveTab])

  // Edge change handlers  
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, edges)
    updateActiveTab({ edges: updatedEdges })

    // Update selected edges
    const currentSelectedEdges = selectedEdgeIds
    const updatedSelectedEdges = currentSelectedEdges.filter(edgeId =>
      updatedEdges.some(edge => edge.id === edgeId)
    )
    
    if (updatedSelectedEdges.length !== currentSelectedEdges.length) {
      updateActiveTab({ selectedEdges: updatedSelectedEdges })
    }
  }, [edges, selectedEdgeIds, updateActiveTab])

  // Selection handlers
  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }) => {
    updateActiveTab({ 
      selectedNodes: selectedNodes?.map(node => node.id) || [],
      selectedEdges: selectedEdges?.map(edge => edge.id) || []
    })
  }, [updateActiveTab])

  // Config change handler
  const handleConfigChange = useCallback((newConfig: StepFlowConfig) => {
    setAppState(prev => ({ ...prev, config: newConfig }))
  }, [])

  // Workflow management
  const handleWorkflowCreate = useCallback((workflowName: string) => {
    // Create START step if it doesn't exist
    const startStepName = `${workflowName}_START`
    
    const newWorkflow: WorkflowDef = {
      root: startStepName,
      edges: []
    }
    
    const newConfig = {
      ...appState.config,
      steps: {
        ...appState.config.steps,
        [startStepName]: {
          type: 'StartStep'
        },
        'SUCCESS': {
          type: 'SuccessStep'
        },
        'FAILURE': {
          type: 'FailureStep'
        }
      },
      workflows: {
        ...appState.config.workflows,
        [workflowName]: newWorkflow
      }
    }
    
    handleConfigChange(newConfig)
    switchToWorkflowTab(workflowName)
  }, [appState.config, handleConfigChange, switchToWorkflowTab])

  const handleWorkflowDelete = useCallback((workflowName: string) => {
    const newWorkflows = { ...appState.config.workflows }
    delete newWorkflows[workflowName]
    
    const newConfig = {
      ...appState.config,
      workflows: newWorkflows
    }
    
    handleConfigChange(newConfig)
    
    // Close the tab if it's open
    const tabIndex = appState.workflowTabs.findIndex(tab => tab.workflowName === workflowName)
    if (tabIndex !== -1) {
      closeWorkflowTab(tabIndex)
    }
  }, [appState.config, appState.workflowTabs, handleConfigChange, closeWorkflowTab])

  // Render workflow tabs
  const renderWorkflowTabs = () => {
    if (appState.workflowTabs.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No workflows open</p>
            <p className="text-sm">Create or select a workflow to get started</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        {/* Tab Navigation */}
        <div className="border-b bg-background/50">
          <div className="h-auto p-1 bg-transparent flex">
            {appState.workflowTabs.map((tab, index) => (
              <button
                key={`${tab.workflowName}-${index}`}
                onClick={() => setAppState(prev => ({ ...prev, activeTabIndex: index }))}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 relative group ${
                  appState.activeTabIndex === index
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:bg-background/50"
                }`}
              >
                <span className="truncate max-w-32">{tab.workflowName}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 ml-2 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeWorkflowTab(index)
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          {appState.workflowTabs.map((tab, index) => (
            <div
              key={`${tab.workflowName}-${index}`}
              className={`absolute inset-0 h-full w-full ${appState.activeTabIndex === index ? 'z-10' : 'z-0 pointer-events-none'}`}
              style={{ visibility: appState.activeTabIndex === index ? 'visible' : 'hidden' }}
            >
              <ReactFlowProvider>
                <ReactFlow
                  nodes={tab.nodes}
                  edges={tab.edges}
                  onNodesChange={appState.activeTabIndex === index ? onNodesChange : undefined}
                  onEdgesChange={appState.activeTabIndex === index ? onEdgesChange : undefined}
                  onSelectionChange={appState.activeTabIndex === index ? onSelectionChange : undefined}
                  onConnect={appState.activeTabIndex === index ? onConnect : undefined}
                  onPaneContextMenu={appState.activeTabIndex === index ? onPaneContextMenu : undefined}
                  nodeTypes={nodeTypes}
                  defaultViewport={tab.viewport}
                  fitView
                  className="h-full w-full"
                >
                  <Background />
                  <Controls />
                  
                  <Panel position="top-left">
                    <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border">
                      <FolderGit2 className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-sm">{tab.workflowName}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{tab.nodes.length} steps</span>
                        <span>•</span>
                        <span>{tab.edges.filter(e => !e.className?.includes('edge-failure')).length} edges</span>
                      </div>
                    </div>
                  </Panel>

                  <Panel position="top-right">
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setQuickAddPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
                          setShowQuickAdd(true)
                        }}
                        title="Add Step (or right-click canvas)"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </Panel>
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen w-screen flex flex-col ${darkMode ? 'dark' : ''}`}>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r bg-muted/20 flex flex-col">
          <WorkflowManagerV2
            config={appState.config}
            activeWorkflowTabs={appState.workflowTabs.map(tab => tab.workflowName)}
            onConfigChange={handleConfigChange}
            onWorkflowOpen={switchToWorkflowTab}
            onWorkflowCreate={handleWorkflowCreate}
            onWorkflowDelete={handleWorkflowDelete}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Toolbar */}
          <div className="border-b bg-background/50 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}>
                  <Undo className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}>
                  <Redo className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setDarkMode(!darkMode)}>
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setCollaborationEnabled(!collaborationEnabled)}
                >
                  {collaborationEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Workflow Canvas */}
          <div className="flex-1">
            {renderWorkflowTabs()}
          </div>
        </div>

        {/* Right Properties Panel */}
        {appState.ui.panels.properties && (
          <div className="w-96 border-l bg-muted/20">
            <PropertiesPanel
              selectedNodeId={selectedNodeIds[0]}
              selectedEdgeId={selectedEdgeIds[0]}
              nodeData={nodes.find(n => n.id === selectedNodeIds[0])?.data}
              edgeData={edges.find(e => e.id === selectedEdgeIds[0])?.data}
              edge={edges.find(e => e.id === selectedEdgeIds[0])}
              config={appState.config}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onUpdateEdge={handleUpdateEdge}
              onDeleteEdge={handleDeleteEdge}
              components={appState.components}
            />
          </div>
        )}
      </div>

      {/* Quick Add Dialog */}
      {showQuickAdd && activeTab && (
        <QuickAddStepDialog
          open={showQuickAdd}
          onOpenChange={setShowQuickAdd}
          onAddStep={(name: string, stepDef: StepDef) => {
            handleAddStep(name, stepDef.type, quickAddPosition)
            setShowQuickAdd(false)
          }}
          config={appState.config}
        />
      )}
    </div>
  )
}

export default StepFlowBuilderAppV2