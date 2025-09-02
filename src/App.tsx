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
import StepNode from './components/nodes/StepNode'
import GuardNode from './components/nodes/GuardNode'
import { SimulationPanel } from './components/SimulationPanel'
import { CollaborationPanel, CollaboratorCursor } from './components/CollaborationPanel'
import ConfigurationSidebar from './components/ConfigurationSidebar'
import WorkflowManager from './components/WorkflowManager'
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
  WifiOff
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

const StepFlowBuilderApp: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    config: INITIAL_CONFIG,
    activeWorkflow: undefined,
    components: [],
    scanPackages: [],
    ui: {
      selectedNodes: [],
      selectedEdges: [],
      panels: {
        navigator: true,
        properties: true,
        console: false
      }
    }
  })
  
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [validationResults, setValidationResults] = useState<Record<string, ValidationIssue[]>>({})
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>()
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>()
  
  // Enhanced state for new features
  const [allNodes, setAllNodes] = useState<Node[]>([])
  const [showSimulationPanel, setShowSimulationPanel] = useState(false)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false)
  const [collaborationEnabled, setCollaborationEnabled] = useState(false)
  
  // Undo/Redo system
  const { undo, redo, canUndo, canRedo, pushState } = useUndoRedo({
    nodes: nodes,
    edges: edges,
    config: appState.config
  }, {
    maxHistorySize: 50,
    debounceMs: 500,
    autoSave: true
  })
  
  // Simulation and collaboration
  const [simulator] = useState(() => new WorkflowSimulator())
  const [collaborationManager] = useState(() => {
    const roomId = new URLSearchParams(window.location.search).get('room') || `room-${generateId('collab')}`
    const user = {
      id: generateId('user'),
      name: `User ${Math.floor(Math.random() * 1000)}`,
      color: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)]
    }
    return new CollaborationManager(roomId, user)
  })
  const [collaborators, setCollaborators] = useState(collaborationManager.getCollaborators())
  const [workflowCache] = useState(() => new WorkflowCache())
  
  
  // Tab state for right sidebar
  const [activeTab, setActiveTab] = useState<'properties' | 'workflow' | 'configuration' | 'yaml'>('yaml')
  
  const rfRef = useRef<any>(null)
  
  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Helper functions for enhanced features

  // Undo/Redo functions
  const handleUndo = useCallback(() => {
    const prevState = undo()
    if (prevState) {
      setNodes(prevState.nodes)
      setEdges(prevState.edges)
      if (prevState.config) {
        setAppState(prev => ({ ...prev, config: prevState.config }))
      }
    }
  }, [undo])

  const handleRedo = useCallback(() => {
    const nextState = redo()
    if (nextState) {
      setNodes(nextState.nodes)
      setEdges(nextState.edges)
      if (nextState.config) {
        setAppState(prev => ({ ...prev, config: nextState.config }))
      }
    }
  }, [redo])

  // Enable keyboard shortcuts
  useUndoRedoShortcuts(handleUndo, handleRedo, canUndo, canRedo)
  
  // Save state for undo/redo when nodes, edges, or config change
  useEffect(() => {
    pushState({ nodes, edges, config: appState.config })
  }, [nodes, edges, appState.config, pushState])
  
  // Keyboard shortcuts for canvas actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault()
        setShowQuickAddDialog(true)
      }
      if (event.ctrlKey && event.shiftKey && event.key === 'W') {
        event.preventDefault()
        // Switch to workflow tab and ensure properties panel is visible
        setActiveTab('workflow')
        setAppState(prev => ({ ...prev, ui: { ...prev.ui, panels: { ...prev.ui.panels, properties: true } } }))
        // Trigger workflow creation
        setTimeout(() => {
          const event = new CustomEvent('createWorkflow')
          document.dispatchEvent(event)
        }, 100)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Enhanced YAML highlighter and live generation
  const liveYaml = useMemo(() => {
    return YAML.stringify(appState.config, null, 2)
  }, [appState.config])


  // Helper: build FlowConfig from current state
  const buildFlowConfig = useCallback((): FlowConfig => {
    const steps: FlowConfig['steps'] = {}
    allNodes.forEach(n => {
      if (n.type === 'step') {
        const d = n.data as StepNodeData
        steps[d.label || d.id] = { type: d.type, config: d.config, guard: d.guard }
      }
    })
    const requests: FlowConfig['requests'] = {}
    return { steps, requests }
  }, [allNodes])


  // Simulation handlers
  const handleRunWorkflow = useCallback(async (workflowName: string) => {
    const flowConfig = buildFlowConfig()
    
    if (!flowConfig.requests?.[workflowName]) {
      alert(`Workflow "${workflowName}" not found`)
      return
    }

    try {
      const traceId = simulator.createTrace(workflowName, allNodes, edges)
      setShowSimulationPanel(true)
      
      await simulator.startSimulation(traceId, flowConfig, workflowName, {
        stepDelay: 1000,
        enableRetries: true,
        enableGuards: true,
        mockStepBehavior: {},
        maxExecutionTime: 30000
      })
    } catch (error) {
      console.error('Failed to start simulation:', error)
      alert(`Failed to start simulation: ${error}`)
    }
  }, [buildFlowConfig, simulator, allNodes, edges])

  const handleStepHighlight = useCallback((nodeId: string | null) => {
    setHighlightedNodeId(nodeId)
  }, [])

  // Initialize collaboration
  useEffect(() => {
    if (collaborationEnabled) {
      collaborationManager.enableOfflineMode()
      
      const handleUserJoined = () => {
        setCollaborators(collaborationManager.getCollaborators())
      }

      const handleUserLeft = () => {
        setCollaborators(collaborationManager.getCollaborators())
      }

      collaborationManager.on('user-joined', handleUserJoined)
      collaborationManager.on('user-left', handleUserLeft)

      return () => {
        collaborationManager.off('user-joined', handleUserJoined)
        collaborationManager.off('user-left', handleUserLeft)
      }
    } else {
      // Disconnect when collaboration is disabled
      collaborationManager.disconnect()
      setCollaborators([])
    }
  }, [collaborationManager, collaborationEnabled])
  
  // Cleanup collaboration on unmount
  useEffect(() => {
    return () => {
      collaborationManager.disconnect()
    }
  }, [collaborationManager])


  // Convert config to visual nodes and edges
  const syncConfigToCanvas = useCallback(() => {
    const { config, activeWorkflow } = appState
    const steps = config.steps || {}
    const workflow = activeWorkflow ? config.workflows?.[activeWorkflow] : undefined
    
    // Create nodes from steps
    const newNodes: Node[] = []
    let x = 100, y = 100
    
    Object.entries(steps).forEach(([stepName, stepDef], index) => {
      const isRoot = workflow?.root === stepName
      const nodeData: StepNodeData = {
        id: stepName,
        label: stepName,
        type: stepDef.type,
        config: stepDef.config,
        guards: stepDef.guards,
        retry: stepDef.retry,
        isRoot,
        workflow: activeWorkflow,
        issues: validationResults[stepName] || [],
        onEdit: (id) => {
          // Select the node
          setAppState(prev => ({
            ...prev,
            ui: { 
              ...prev.ui, 
              selectedNodes: [id], 
              selectedEdges: [],
              // Ensure properties panel is visible
              panels: { ...prev.ui.panels, properties: true }
            }
          }))
          
          // Switch to properties tab for immediate editing
          setActiveTab('properties')
        }
      }
      
      newNodes.push({
        id: stepName,
        type: 'step',
        position: { x: x + (index % 3) * 250, y: y + Math.floor(index / 3) * 150 },
        data: nodeData
      })
    })
    
    // Add terminal nodes if referenced in edges
    if (workflow?.edges.some(e => e.to === 'SUCCESS' || e.to === 'FAILURE')) {
      if (workflow.edges.some(e => e.to === 'SUCCESS')) {
        newNodes.push({
          id: 'SUCCESS',
          type: 'step',
          position: { x: x + 500, y: y },
          data: {
            id: 'SUCCESS',
            label: 'SUCCESS',
            type: 'TerminalStep',
            isTerminal: true,
            workflow: activeWorkflow
          } as StepNodeData
        })
      }
      
      if (workflow.edges.some(e => e.to === 'FAILURE')) {
        newNodes.push({
          id: 'FAILURE',
          type: 'step',
          position: { x: x + 500, y: y + 150 },
          data: {
            id: 'FAILURE',
            label: 'FAILURE',
            type: 'TerminalStep',
            isTerminal: true,
            workflow: activeWorkflow
          } as StepNodeData
        })
      }
    }
    
    // Create edges from workflow
    const newEdges: Edge[] = []
    if (workflow) {
      workflow.edges.forEach((edgeDef, index) => {
        // Main edge (success path)
        const mainEdge: Edge = {
          id: `${edgeDef.from}-${edgeDef.to}-${index}`,
          source: edgeDef.from,
          target: edgeDef.to,
          type: 'default',
          label: edgeDef.guard || (edgeDef.onFailure?.strategy ? 'SUCCESS' : ''),
          data: {
            guard: edgeDef.guard,
            condition: edgeDef.condition,
            kind: edgeDef.kind || 'normal',
            onFailure: edgeDef.onFailure,
            priority: edgeDef.priority,
            edgeType: 'main'
          },
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#10b981' },
          className: [
            'edge-main',
            edgeDef.kind === 'terminal' ? 'edge-terminal' : '',
            edgeDef.onFailure?.strategy === 'ALTERNATIVE' ? 'edge-has-alternative' : '',
            edgeDef.onFailure?.strategy === 'RETRY' ? 'edge-retry' : '',
            edgeDef.onFailure?.strategy === 'SKIP' ? 'edge-skip' : '',
            edgeDef.onFailure?.strategy === 'CONTINUE' ? 'edge-continue' : ''
          ].filter(Boolean).join(' ')
        }
        
        newEdges.push(mainEdge)
        
        // Create alternative failure edge if strategy is ALTERNATIVE
        if (edgeDef.onFailure?.strategy === 'ALTERNATIVE' && edgeDef.onFailure.alternativeTarget) {
          const alternativeEdge: Edge = {
            id: `${edgeDef.from}-${edgeDef.onFailure.alternativeTarget}-failure-${index}`,
            source: edgeDef.from,
            target: edgeDef.onFailure.alternativeTarget,
            type: 'default',
            label: 'ON FAILURE',
            data: {
              guard: edgeDef.guard,
              condition: `Alternative path when guard "${edgeDef.guard || 'condition'}" fails`,
              kind: 'failure',
              onFailure: edgeDef.onFailure,
              priority: (edgeDef.priority || 0) + 1000, // Lower priority than main edge
              edgeType: 'failure',
              parentEdgeId: mainEdge.id
            },
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#ef4444' },
            className: 'edge-failure edge-alternative-failure',
            style: {
              strokeDasharray: '8,4',
              stroke: '#ef4444',
              strokeWidth: 2,
              opacity: 0.8
            }
          }
          
          newEdges.push(alternativeEdge)
        }
      })
    }
    
    setNodes(newNodes)
    setEdges(newEdges)
  }, [appState.config, appState.activeWorkflow, validationResults])
  
  // Sync config changes to canvas
  useEffect(() => {
    syncConfigToCanvas()
  }, [syncConfigToCanvas])
  
  // Validation
  const validateNode = useCallback((nodeId: string): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const { config } = appState
    const step = config.steps?.[nodeId]
    
    if (!step) {
      issues.push({ type: 'error', message: 'Step definition not found', location: `steps.${nodeId}` })
      return issues
    }
    
    // Validate type
    if (!step.type) {
      issues.push({ type: 'error', message: 'Step type is required', location: `steps.${nodeId}.type` })
    }
    // Component validation removed - resolved at runtime
    
    // Validate guards
    if (step.guards) {
      step.guards.forEach((guard, index) => {
        if (!guard) {
          issues.push({ 
            type: 'error', 
            message: 'Guard name cannot be empty', 
            location: `steps.${nodeId}.guards[${index}]` 
          })
        } else {
          const guardStep = config.steps?.[guard]
          const guardComponent = appState.components.find(c => c.name === guard && c.type === 'guard')
          
          if (!guardStep && !guardComponent) {
            issues.push({ 
              type: 'warning', 
              message: `Guard '${guard}' not found as step or component`, 
              location: `steps.${nodeId}.guards[${index}]` 
            })
          }
        }
      })
    }
    
    // Validate retry policy
    if (step.retry) {
      const retry = step.retry
      if (retry.maxAttempts < 1) {
        issues.push({ 
          type: 'error', 
          message: 'Max attempts must be &gt;= 1', 
          location: `steps.${nodeId}.retry.maxAttempts` 
        })
      }
      
      if (retry.delay < 0) {
        issues.push({ 
          type: 'error', 
          message: 'Delay must be &gt;= 0', 
          location: `steps.${nodeId}.retry.delay` 
        })
      }
      
      if (retry.guard) {
        const retryGuardStep = config.steps?.[retry.guard]
        const retryGuardComponent = appState.components.find(c => c.name === retry.guard && c.type === 'guard')
        
        if (!retryGuardStep && !retryGuardComponent) {
          issues.push({ 
            type: 'warning', 
            message: `Retry guard '${retry.guard}' not found`, 
            location: `steps.${nodeId}.retry.guard` 
          })
        }
      }
    }
    
    return issues
  }, [appState.config, appState.components])
  
  // Update validation results when config changes
  useEffect(() => {
    const newResults: Record<string, ValidationIssue[]> = {}
    
    Object.keys(appState.config.steps || {}).forEach(stepName => {
      newResults[stepName] = validateNode(stepName)
    })
    
    setValidationResults(newResults)
  }, [appState.config, validateNode])
  
  // Canvas event handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
    
    // Handle node deletions - sync back to config
    const removedNodes = changes.filter(c => c.type === 'remove')
    if (removedNodes.length > 0) {
      const removedIds = removedNodes.map((c: any) => c.id)
      
      setAppState(prev => {
        const newConfig = { ...prev.config }
        const newSteps = { ...newConfig.steps }
        
        // Remove deleted steps from config
        removedIds.forEach(id => {
          delete newSteps[id]
        })
        
        // Remove edges connecting to deleted nodes from all workflows
        const newWorkflows = { ...newConfig.workflows }
        Object.keys(newWorkflows).forEach(workflowName => {
          const workflow = newWorkflows[workflowName]
          newWorkflows[workflowName] = {
            ...workflow,
            edges: workflow.edges.filter(edge => 
              !removedIds.includes(edge.from) && !removedIds.includes(edge.to)
            )
          }
        })
        
        return {
          ...prev,
          config: {
            ...newConfig,
            steps: newSteps,
            workflows: newWorkflows
          }
        }
      })
    }
    
    // Update selection state
    const selectedNodeChanges = changes.filter(c => c.type === 'select')
    if (selectedNodeChanges.length > 0) {
      const selectedIds = selectedNodeChanges
        .filter((c: any) => c.selected)
        .map((c: any) => c.id)
      
      setAppState(prev => ({
        ...prev,
        ui: { ...prev.ui, selectedNodes: selectedIds, selectedEdges: [] }
      }))
      
      // Clear selectedEdgeId when nodes are selected
      setSelectedEdgeId(undefined)
    }
  }, [appState.config])
  
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
    
    // Handle edge deletions - sync back to workflow config
    const removedEdges = changes.filter(c => c.type === 'remove')
    if (removedEdges.length > 0 && appState.activeWorkflow) {
      const removedIds = removedEdges.map((c: any) => c.id)
      
      setAppState(prev => {
        const newConfig = { ...prev.config }
        const activeWorkflow = prev.activeWorkflow
        
        if (activeWorkflow && newConfig.workflows?.[activeWorkflow]) {
          const workflow = newConfig.workflows[activeWorkflow]
          const newWorkflows = { ...newConfig.workflows }
          
          // Remove deleted edges from workflow definition
          newWorkflows[activeWorkflow] = {
            ...workflow,
            edges: workflow.edges.filter(edge => {
              const edgeId = `${edge.from}-${edge.to}`
              return !removedIds.some(id => id.includes(edgeId))
            })
          }
          
          return {
            ...prev,
            config: {
              ...newConfig,
              workflows: newWorkflows
            }
          }
        }
        
        return prev
      })
    }
    
    // Update selection state  
    const selectedEdgeChanges = changes.filter(c => c.type === 'select')
    if (selectedEdgeChanges.length > 0) {
      const selectedIds = selectedEdgeChanges
        .filter((c: any) => c.selected)
        .map((c: any) => c.id)
        .filter(id => {
          // Exclude failure edges from selection
          const edge = edges.find(e => e.id === id)
          return edge?.data?.edgeType !== 'failure'
        })
      
      setAppState(prev => ({
        ...prev,
        ui: { ...prev.ui, selectedEdges: selectedIds, selectedNodes: [] }
      }))
      
      // Set selectedEdgeId for properties panel (only main edges)
      setSelectedEdgeId(selectedIds.length > 0 ? selectedIds[0] : undefined)
    }
  }, [appState.config, appState.activeWorkflow])
  
  const onConnect = useCallback((params: Connection) => {
    const { config, activeWorkflow } = appState
    
    if (!activeWorkflow || !config.workflows?.[activeWorkflow]) return
    
    const newEdge = {
      from: params.source!,
      to: params.target!,
      guard: '',
      kind: 'normal'
    }
    
    const workflow = config.workflows[activeWorkflow]
    const updatedWorkflow: WorkflowDef = {
      ...workflow,
      edges: [...workflow.edges, newEdge]
    }
    
    const updatedConfig: StepFlowConfig = {
      ...config,
      workflows: {
        ...config.workflows,
        [activeWorkflow]: updatedWorkflow
      }
    }
    
    setAppState(prev => ({ ...prev, config: updatedConfig }))
  }, [appState])
  
  // UI event handlers
  const updateConfig = useCallback((newConfig: StepFlowConfig) => {
    setAppState(prev => ({ ...prev, config: newConfig }))
  }, [])
  
  const updateScanPackages = useCallback((packages: string[]) => {
    setAppState(prev => ({ ...prev, scanPackages: packages }))
  }, [])
  
  const setActiveWorkflow = useCallback((workflowName: string) => {
    setAppState(prev => ({ ...prev, activeWorkflow: workflowName }))
  }, [])

  // Component management functions
  const addComponent = useCallback((component: ComponentInfo) => {
    setAppState(prev => ({
      ...prev,
      components: [...prev.components, component]
    }))
  }, [])

  const removeComponent = useCallback((componentId: string) => {
    setAppState(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== componentId)
    }))
  }, [])

  const toggleComponent = useCallback((componentId: string) => {
    setAppState(prev => ({
      ...prev,
      components: prev.components.map(c => 
        c.id === componentId ? { ...c, enabled: !c.enabled } : c
      )
    }))
  }, [])
  
  const updateNode = useCallback((nodeId: string, updates: Partial<StepNodeData | GuardNodeData>) => {
    const { config } = appState
    const currentStep = config.steps?.[nodeId]
    
    if (!currentStep) return
    
    // Type-safe handling of step vs guard updates
    const stepUpdates = updates as Partial<StepNodeData>
    
    const updatedStep = {
      ...currentStep,
      type: updates.type || currentStep.type,
      config: updates.config !== undefined ? updates.config : currentStep.config,
      guards: stepUpdates.guards !== undefined ? stepUpdates.guards : currentStep.guards,
      retry: stepUpdates.retry !== undefined ? stepUpdates.retry : currentStep.retry
    }
    
    const updatedConfig: StepFlowConfig = {
      ...config,
      steps: {
        ...config.steps,
        [nodeId]: updatedStep
      }
    }
    
    setAppState(prev => ({ ...prev, config: updatedConfig }))
  }, [appState.config])
  
  const deleteNode = useCallback((nodeId: string) => {
    const { config } = appState
    const newSteps = { ...config.steps }
    delete newSteps[nodeId]
    
    const updatedConfig: StepFlowConfig = {
      ...config,
      steps: newSteps
    }
    
    setAppState(prev => ({
      ...prev,
      config: updatedConfig,
      ui: { ...prev.ui, selectedNodes: [], selectedEdges: [] }
    }))
  }, [appState])
  
  const cloneNode = useCallback((nodeId: string) => {
    const { config } = appState
    const sourceStep = config.steps?.[nodeId]
    
    if (!sourceStep) return
    
    const newNodeId = `${nodeId}_copy_${Date.now()}`
    const clonedStep = { ...sourceStep }
    
    const updatedConfig: StepFlowConfig = {
      ...config,
      steps: {
        ...config.steps,
        [newNodeId]: clonedStep
      }
    }
    
    setAppState(prev => ({ ...prev, config: updatedConfig }))
  }, [appState.config])
  
  // Edge management functions
  const updateEdge = useCallback((edgeId: string, updates: Partial<EdgeData>) => {
    const { config, activeWorkflow } = appState
    
    if (!activeWorkflow || !config.workflows?.[activeWorkflow]) return
    
    // Find the edge in the current edges array to get source/target
    const currentEdge = edges.find(e => e.id === edgeId)
    if (!currentEdge) return
    
    const workflow = config.workflows[activeWorkflow]
    const edgeIndex = workflow.edges.findIndex(e => 
      `${e.from}-${e.to}` === `${currentEdge.source}-${currentEdge.target}`
    )
    
    if (edgeIndex === -1) return
    
    const updatedEdges = [...workflow.edges]
    updatedEdges[edgeIndex] = {
      ...updatedEdges[edgeIndex],
      guard: updates.guard,
      condition: updates.condition,
      onFailure: updates.onFailure,
      priority: updates.priority
    }
    
    const updatedConfig: StepFlowConfig = {
      ...config,
      workflows: {
        ...config.workflows,
        [activeWorkflow]: {
          ...workflow,
          edges: updatedEdges
        }
      }
    }
    
    setAppState(prev => ({ ...prev, config: updatedConfig }))
    
    // Also update the canvas edge data and regenerate failure edges if needed
    setEdges(prevEdges => {
      let updatedEdges = prevEdges
        // Update main edge
        .map(edge => 
          edge.id === edgeId 
            ? { 
                ...edge, 
                data: { ...edge.data, ...updates }, 
                label: updates.guard || (updates.onFailure?.strategy ? 'SUCCESS' : ''),
                className: [
                  'edge-main',
                  updates.onFailure?.strategy === 'ALTERNATIVE' ? 'edge-has-alternative' : '',
                  updates.onFailure?.strategy === 'RETRY' ? 'edge-retry' : '',
                  updates.onFailure?.strategy === 'SKIP' ? 'edge-skip' : '',
                  updates.onFailure?.strategy === 'CONTINUE' ? 'edge-continue' : ''
                ].filter(Boolean).join(' ')
              }
            : edge
        )
        // Remove old failure edges for this main edge
        .filter(edge => edge.data?.parentEdgeId !== edgeId)
      
      // Add new failure edge if strategy is ALTERNATIVE
      if (updates.onFailure?.strategy === 'ALTERNATIVE' && updates.onFailure.alternativeTarget) {
        const mainEdge = updatedEdges.find(e => e.id === edgeId)
        if (mainEdge) {
          const failureEdge: Edge = {
            id: `${mainEdge.source}-${updates.onFailure.alternativeTarget}-failure-${Date.now()}`,
            source: mainEdge.source,
            target: updates.onFailure.alternativeTarget,
            type: 'default',
            label: 'ON FAILURE',
            data: {
              guard: updates.guard,
              condition: `Alternative path when guard "${updates.guard || 'condition'}" fails`,
              kind: 'failure',
              onFailure: updates.onFailure,
              priority: (updates.priority || 0) + 1000,
              edgeType: 'failure',
              parentEdgeId: edgeId
            },
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#ef4444' },
            className: 'edge-failure edge-alternative-failure',
            style: {
              strokeDasharray: '8,4',
              stroke: '#ef4444',
              strokeWidth: 2,
              opacity: 0.8
            }
          }
          updatedEdges.push(failureEdge)
        }
      }
      
      return updatedEdges
    })
  }, [appState.config, appState.activeWorkflow, edges])
  
  const deleteEdgeFromCanvas = useCallback((edgeId: string) => {
    // Find and remove the edge
    const edgeToRemove = edges.find(e => e.id === edgeId)
    if (!edgeToRemove) return
    
    // Remove main edge and any associated failure edges
    setEdges(prevEdges => 
      prevEdges.filter(e => 
        e.id !== edgeId && e.data?.parentEdgeId !== edgeId
      )
    )
    setSelectedEdgeId(undefined)
    
    // Also remove from config
    const { config, activeWorkflow } = appState
    if (!activeWorkflow || !config.workflows?.[activeWorkflow]) return
    
    const workflow = config.workflows[activeWorkflow]
    const updatedEdges = workflow.edges.filter(edge => {
      const edgeId = `${edge.from}-${edge.to}`
      return edgeId !== `${edgeToRemove.source}-${edgeToRemove.target}`
    })
    
    const updatedConfig: StepFlowConfig = {
      ...config,
      workflows: {
        ...config.workflows,
        [activeWorkflow]: {
          ...workflow,
          edges: updatedEdges
        }
      }
    }
    
    setAppState(prev => ({ ...prev, config: updatedConfig }))
  }, [edges, appState.config, appState.activeWorkflow])
  
  // Quick add step handler
  const handleQuickAddStep = useCallback((name: string, stepDef: StepDef) => {
    const updatedConfig: StepFlowConfig = {
      ...appState.config,
      steps: {
        ...appState.config.steps,
        [name]: stepDef
      }
    }
    
    setAppState(prev => ({ ...prev, config: updatedConfig }))
    
    // Auto-select the newly created step
    setTimeout(() => {
      setAppState(prev => ({
        ...prev,
        ui: { ...prev.ui, selectedNodes: [name], selectedEdges: [] }
      }))
    }, 100)
  }, [appState.config])
  
  const togglePanel = useCallback((panel: keyof AppState['ui']['panels']) => {
    setAppState(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        panels: {
          ...prev.ui.panels,
          [panel]: !prev.ui.panels[panel]
        }
      }
    }))
  }, [])
  
  const fitView = useCallback(() => {
    rfRef.current?.fitView?.({ padding: 0.2 })
  }, [])
  
  const exportYAML = useCallback(() => {
    const yaml = YAML.stringify(appState.config)
    const blob = new Blob([yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stepflow-config.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }, [appState.config])
  
  const importYAML = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const yaml = e.target?.result as string
            const parsed = YAML.parse(yaml) as StepFlowConfig
            setAppState(prev => ({ ...prev, config: parsed }))
          } catch (error) {
            alert('Failed to parse YAML file')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])
  
  // Get selected node data
  const selectedNodeData = useMemo(() => {
    const selectedNodeId = appState.ui.selectedNodes[0]
    if (!selectedNodeId) return undefined
    
    const node = nodes.find(n => n.id === selectedNodeId)
    return node?.data as StepNodeData | GuardNodeData | undefined
  }, [nodes, appState.ui.selectedNodes])
  
  // Get selected edge data
  const selectedEdgeData = useMemo(() => {
    if (!selectedEdgeId) return undefined
    
    const edge = edges.find(e => e.id === selectedEdgeId)
    return {
      edge,
      edgeData: edge?.data as EdgeData | undefined
    }
  }, [edges, selectedEdgeId])
  
  // Get total validation issues count
  const totalIssues = useMemo(() => {
    const allIssues = Object.values(validationResults).flat()
    return {
      errors: allIssues.filter(i => i.type === 'error').length,
      warnings: allIssues.filter(i => i.type === 'warning').length,
      info: allIssues.filter(i => i.type === 'info').length
    }
  }, [validationResults])
  
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">StepFlow Builder</h1>
          </div>
          
          {appState.activeWorkflow && (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-sm">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>{appState.activeWorkflow}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Validation Summary */}
          {(totalIssues.errors > 0 || totalIssues.warnings > 0) && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-sm">
              {totalIssues.errors > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{totalIssues.errors}</span>
                </div>
              )}
              {totalIssues.warnings > 0 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{totalIssues.warnings}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Action Buttons (Icon Only) */}
          <Button 
            size="icon" 
            variant="outline" 
            title="Undo (Ctrl+Z)" 
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            title="Redo (Ctrl+Y)" 
            onClick={handleRedo}
            disabled={!canRedo}
          >
            <Redo className="w-4 h-4" />
          </Button>
          
          <Button size="icon" variant="outline" onClick={importYAML} title="Import YAML">
            <Upload className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={exportYAML} title="Export YAML">
            <Download className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={fitView} title="Fit View">
            <Maximize2 className="w-4 h-4" />
          </Button>
          
          {/* Panel Toggle */}
          <Button 
            size="icon" 
            variant="outline" 
            onClick={() => togglePanel('properties')}
            title={appState.ui.panels.properties ? 'Hide Properties' : 'Show Properties'}
          >
            {appState.ui.panels.properties ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
          
          {/* Theme Toggle */}
          <Button size="icon" variant="outline" onClick={() => setIsDark(!isDark)} title={isDark ? 'Light Mode' : 'Dark Mode'}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          
          {/* Collaboration Toggle */}
          <Button 
            size="icon" 
            variant="outline" 
            onClick={() => setCollaborationEnabled(!collaborationEnabled)}
            title={collaborationEnabled ? 'Disable Collaboration' : 'Enable Collaboration'}
          >
            {collaborationEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </Button>
          
          {/* Collaboration Panel */}
          {collaborationEnabled && <CollaborationPanel collaborationManager={collaborationManager} />}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Enhanced Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(instance) => { rfRef.current = instance }}
            onMouseMove={(event) => {
              // Track cursor for collaboration (only if enabled)
              if (collaborationEnabled) {
                const rect = (event.target as HTMLElement).getBoundingClientRect()
                const x = event.clientX - rect.left
                const y = event.clientY - rect.top
                collaborationManager.updateCursor(x, y)
              }
            }}
            fitView
            className="bg-background"
          >
            <Background />
            <Controls />
            
            {/* Canvas Action Buttons */}
            <Panel position="top-right" className="p-2 flex gap-2">
              {/* Add Step Button */}
              <Button
                size="sm"
                onClick={() => setShowQuickAddDialog(true)}
                className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
                title="Add Step (Ctrl+Shift+A)"
              >
                <Settings className="w-5 h-5" />
              </Button>
              
              {/* Add Workflow Button */}
              <Button
                size="sm"
                onClick={() => {
                  // Switch to workflow tab and trigger new workflow creation
                  setActiveTab('workflow')
                  setAppState(prev => ({ ...prev, ui: { ...prev.ui, panels: { ...prev.ui.panels, properties: true } } }))
                  // Small delay to ensure tab is switched before triggering workflow creation
                  setTimeout(() => {
                    const event = new CustomEvent('createWorkflow')
                    document.dispatchEvent(event)
                  }, 100)
                }}
                className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
                title="Add Workflow (Ctrl+Shift+W)"
              >
                <FolderGit2 className="w-5 h-5" />
              </Button>
            </Panel>
            
            {/* Canvas Info Panel */}
            <Panel position="bottom-left" className="text-xs p-3 rounded bg-card border border-border text-muted-foreground max-w-xs">
              <div className="font-medium mb-2">Canvas Info</div>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                  <span>Steps:</span>
                  <span>{Object.keys(appState.config.steps || {}).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Workflows:</span>
                  <span>{Object.keys(appState.config.workflows || {}).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Components:</span>
                  <span>{appState.components.length}</span>
                </div>
                {appState.activeWorkflow && appState.config.workflows?.[appState.activeWorkflow] && (
                  <div className="flex justify-between">
                    <span>Edges:</span>
                    <span>{appState.config.workflows[appState.activeWorkflow].edges.length}</span>
                  </div>
                )}
              </div>
              
              {/* Edge Legend */}
              <div className="border-t border-border pt-2">
                <div className="font-medium mb-2">Edge Types</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500"></div>
                    <span className="text-xs">Success Path</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-red-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #ef4444 0px, #ef4444 6px, transparent 6px, transparent 10px)'}}></div>
                    <span className="text-xs">Failure Path</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-purple-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #8b5cf6 0px, #8b5cf6 2px, transparent 2px, transparent 4px)'}}></div>
                    <span className="text-xs">Retry</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-cyan-500" style={{backgroundImage: 'repeating-linear-gradient(to right, #06b6d4 0px, #06b6d4 8px, transparent 8px, transparent 12px)'}}></div>
                    <span className="text-xs">Skip</span>
                  </div>
                </div>
              </div>
            </Panel>
          </ReactFlow>
          
          {/* Collaborator Cursors */}
          {collaborationEnabled && collaborators
            .filter(collaborator => collaborator.cursor && collaborator.isActive)
            .map(collaborator => (
              <CollaboratorCursor
                key={collaborator.id}
                collaborator={collaborator}
                position={collaborator.cursor!}
              />
            ))
          }
          
          {/* Simulation Panel */}
          <SimulationPanel
            simulator={simulator}
            onStepHighlight={handleStepHighlight}
            isVisible={showSimulationPanel}
            onClose={() => setShowSimulationPanel(false)}
          />
        </div>
        
        {/* Tabbed Right Sidebar */}
        {appState.ui.panels.properties && (
          <div className="border-l border-border bg-card flex flex-col overflow-hidden w-96">
            {/* Tab Headers */}
            <div className="flex border-b border-border bg-card">
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'yaml'
                    ? 'text-primary border-b-2 border-primary bg-accent/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => setActiveTab('yaml')}
              >
                YAML
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'properties'
                    ? 'text-primary border-b-2 border-primary bg-accent/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => setActiveTab('properties')}
              >
                Properties
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'workflow'
                    ? 'text-primary border-b-2 border-primary bg-accent/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => setActiveTab('workflow')}
              >
                Workflow
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'configuration'
                    ? 'text-primary border-b-2 border-primary bg-accent/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => setActiveTab('configuration')}
              >
                Config
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'yaml' && (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-card">
                    <div className="text-sm font-medium">Live YAML Preview</div>
                    <div className="text-xs text-muted-foreground">Real-time configuration preview</div>
                  </div>
                  <div className="flex-1 overflow-auto p-3">
                    <div className="relative w-full h-full">
                      <div 
                        className="w-full h-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg overflow-hidden"
                        style={{ 
                          maxHeight: 'calc(100vh - 200px)',
                          minHeight: '400px'
                        }}
                      >
                        <pre 
                          className="w-full h-full p-4 m-0 overflow-auto font-mono text-sm leading-relaxed whitespace-pre-wrap"
                          style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                            background: 'transparent',
                            color: 'inherit'
                          }}
                        >
                          {liveYaml.split('\n').map((line, index) => (
                            <div key={index} style={{ minHeight: '1.5em' }}>
                              {(() => {
                                // Key highlighting (property names)
                                if (/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/.test(line)) {
                                  const match = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:(.*)$/)
                                  if (match) {
                                    const [, indent, key, rest] = match
                                    return (
                                      <React.Fragment>
                                        <span>{indent}</span>
                                        <span style={{ color: '#2563eb', fontWeight: 600 }}>{key}</span>
                                        <span style={{ color: '#6b7280' }}>:</span>
                                        <span>{rest}</span>
                                      </React.Fragment>
                                    )
                                  }
                                }
                                
                                // Array items
                                if (/^(\s*)-\s/.test(line)) {
                                  const match = line.match(/^(\s*)-(\s*.*)$/)
                                  if (match) {
                                    const [, indent, rest] = match
                                    return (
                                      <React.Fragment>
                                        <span>{indent}</span>
                                        <span style={{ color: '#9333ea', fontWeight: 700 }}>-</span>
                                        <span>{rest}</span>
                                      </React.Fragment>
                                    )
                                  }
                                }
                                
                                // Regular line with string/number highlighting
                                return (
                                  <span>
                                    {line.split(/("([^"]*)"|\b(\d+(?:\.\d+)?)\b|\b(true|false|null)\b)/).map((part, partIndex) => {
                                      if (!part) return null
                                      
                                      // Quoted strings
                                      if (part.startsWith('"') && part.endsWith('"')) {
                                        return (
                                          <span key={partIndex} style={{ color: '#16a34a' }}>
                                            {part}
                                          </span>
                                        )
                                      }
                                      
                                      // Numbers
                                      if (/^\d+(?:\.\d+)?$/.test(part)) {
                                        return (
                                          <span key={partIndex} style={{ color: '#ea580c', fontWeight: 500 }}>
                                            {part}
                                          </span>
                                        )
                                      }
                                      
                                      // Booleans and null
                                      if (/^(true|false|null)$/.test(part)) {
                                        return (
                                          <span key={partIndex} style={{ color: '#dc2626', fontWeight: 600 }}>
                                            {part}
                                          </span>
                                        )
                                      }
                                      
                                      return <span key={partIndex}>{part}</span>
                                    })}
                                  </span>
                                )
                              })()}
                            </div>
                          ))}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'properties' && (
                <div className="h-full overflow-auto">
                  <PropertiesPanel
                    selectedNodeId={appState.ui.selectedNodes[0]}
                    selectedEdgeId={selectedEdgeId}
                    nodeData={selectedNodeData}
                    edgeData={selectedEdgeData?.edgeData}
                    edge={selectedEdgeData?.edge}
                    config={appState.config}
                    components={appState.components}
                    onUpdateNode={updateNode}
                    onUpdateEdge={updateEdge}
                    onDeleteNode={deleteNode}
                    onDeleteEdge={deleteEdgeFromCanvas}
                    onCloneNode={cloneNode}
                    onValidateNode={validateNode}
                  />
                </div>
              )}

              {activeTab === 'workflow' && (
                <div className="h-full overflow-auto">
                  <WorkflowManager
                    config={appState.config}
                    activeWorkflow={appState.activeWorkflow}
                    onConfigChange={(newConfig) => setAppState(prev => ({ ...prev, config: newConfig }))}
                    onActiveWorkflowChange={setActiveWorkflow}
                  />
                </div>
              )}

              {activeTab === 'configuration' && (
                <div className="h-full overflow-auto">
                  <ConfigurationSidebar
                    config={appState.config}
                    onConfigChange={(newConfig) => setAppState(prev => ({ ...prev, config: newConfig }))}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Add Step Dialog */}
      <QuickAddStepDialog
        open={showQuickAddDialog}
        onOpenChange={setShowQuickAddDialog}
        onAddStep={handleQuickAddStep}
        config={appState.config}
      />
    </div>
  )
}

const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <StepFlowBuilderApp />
    </ReactFlowProvider>
  )
}

export default App
