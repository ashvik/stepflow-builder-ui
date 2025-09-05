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
import DslViewer from './components/DslViewer'
import YamlTreeView from './components/YamlTreeView'

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
  EyeOff,
  Layers,
  List,
  FileCode,
  Copy,
  Trash2
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
  StepDef,
  EdgeData,
  EdgeFailureStrategy
} from './types/stepflow'
import YAML from 'yaml'
import { YamlHighlighter } from './lib/yaml-highlighter'
import { generateId } from './lib/utils'
import { useUndoRedo, useUndoRedoShortcuts } from './hooks/useUndoRedo'
  import { WorkflowSimulator } from './lib/workflow-simulator'
    import { CollaborationManager } from './lib/collaboration'
    import IssuesPanel from './components/IssuesPanel'
    import { useDebounce, useThrottle, performanceMonitor, WorkflowCache } from './lib/performance'
    import { LayoutAlgorithms } from './lib/layout-algorithms'
import DslQuickStart from './components/DslQuickStart'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'

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
  id: string
  workflowName: string
  nodes: Node[]
  edges: Edge[]
  selectedNodes: string[]
  selectedEdges: string[]
  viewport: { x: number; y: number; zoom: number }
}

interface AppStateV3 extends Omit<AppState, 'activeWorkflow' | 'ui'> {
  // V1 compatibility
  activeWorkflow?: string
  // V2 multi-tab capability
  workflowTabs: WorkflowTabState[]
  activeTabIndex: number
  // V3 enhanced UI
  ui: {
    panels: {
      navigator: boolean
      properties: boolean
      console: boolean
    }
    showAllWorkflows: boolean
    viewMode: 'single' | 'tabs' // Toggle between single workflow and multi-tab
  }
}

  const StepFlowBuilderAppV4: React.FC = () => {
  const [appState, setAppState] = useState<AppStateV3>({
    config: INITIAL_CONFIG,
    activeWorkflow: undefined,
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
      showAllWorkflows: false,
viewMode: 'tabs' // Always use multi-tab mode
    }
  })

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('stepflow-dark-mode')
    return saved ? JSON.parse(saved) : false
  })
  
  // Apply dark mode to document root and save to localStorage
  useEffect(() => {
    const htmlElement = document.documentElement
    if (darkMode) {
      htmlElement.classList.add('dark')
      htmlElement.style.setProperty('color-scheme', 'dark')
    } else {
      htmlElement.classList.remove('dark')
      htmlElement.style.setProperty('color-scheme', 'light')
    }
    localStorage.setItem('stepflow-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  // Force initial theme application
  useEffect(() => {
    const htmlElement = document.documentElement
    if (darkMode) {
      htmlElement.classList.add('dark')
      htmlElement.style.setProperty('color-scheme', 'dark')
    } else {
      htmlElement.classList.remove('dark')
      htmlElement.style.setProperty('color-scheme', 'light')
    }
  }, [])

  // Toggle theme function
  const toggleTheme = useCallback(() => {
    setDarkMode(prev => !prev)
  }, [])
  
  const [collaborationEnabled, setCollaborationEnabled] = useState(false)
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'workflow' | 'configuration' | 'yaml' | 'dsl' | 'properties'>('dsl')
  const [yamlViewMode, setYamlViewMode] = useState<'yaml' | 'tree'>('tree')
  const [dslInnerTab, setDslInnerTab] = useState<'editor' | 'quickstart'>('editor')
  const [sidebarWidth, setSidebarWidth] = useState(480) // Increased from 384px to 480px to reduce vertical scrolling
  const [isResizing, setIsResizing] = useState(false)
  const [validationResults, setValidationResults] = useState<Record<string, ValidationIssue[]>>({})
  const [showIssuesPanel, setShowIssuesPanel] = useState(false)
  const [isDslMaximized, setIsDslMaximized] = useState(false)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const restorationCheckedRef = useRef(false)
  const [showCodegen, setShowCodegen] = useState(false)
  const [codegenProjectName, setCodegenProjectName] = useState('stepflow-project')
  const [codegenBasePackage, setCodegenBasePackage] = useState('com.example.stepflow')
  const [codegenError, setCodegenError] = useState<string | null>(null)
  const [codegenIncludeJava, setCodegenIncludeJava] = useState(true)
  
  // Collaboration state
  const [collaborationManager] = useState(() => new CollaborationManager(
    'local-demo',
    { id: 'you', name: 'You', color: '#3b82f6' }
  ))
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [clipboardStepId, setClipboardStepId] = useState<string | null>(null)

  // Enable/disable collaboration (offline demo mode) and keep collaborator list in sync
  useEffect(() => {
    if (!collaborationEnabled) {
      collaborationManager.disconnect()
      setCollaborators([])
      return
    }

    // Use offline mock for now
    collaborationManager.enableOfflineMode()
    // Initial snapshot
    setTimeout(() => {
      setCollaborators(collaborationManager.getCollaborators())
    }, 200)

    const sync = () => setCollaborators(collaborationManager.getCollaborators())
    collaborationManager.on('user-joined', sync as any)
    collaborationManager.on('user-left', sync as any)
    collaborationManager.on('cursor-moved', sync as any)
    collaborationManager.on('connected', sync as any)
    collaborationManager.on('disconnected', sync as any)

    return () => {
      collaborationManager.off('user-joined', sync as any)
      collaborationManager.off('user-left', sync as any)
      collaborationManager.off('cursor-moved', sync as any)
      collaborationManager.off('connected', sync as any)
      collaborationManager.off('disconnected', sync as any)
    }
  }, [collaborationEnabled, collaborationManager])

  // Get current active workflow tab (for multi-tab mode)
  const currentTab = useMemo(() => {
    return appState.workflowTabs[appState.activeTabIndex]
  }, [appState.workflowTabs, appState.activeTabIndex])

  // Generate nodes and edges for current workflow
  const { nodes, edges } = useMemo(() => {
    const { config, activeWorkflow } = appState
    
    // In tab mode, use current tab's nodes/edges
    if (appState.ui.viewMode === 'tabs' && currentTab) {
      return { nodes: currentTab.nodes, edges: currentTab.edges }
    }
    
    // In single mode, generate from active workflow
    const workflow = activeWorkflow ? config.workflows?.[activeWorkflow] : undefined
    if (!workflow || !config.steps) {
      return { nodes: [], edges: [] }
    }

    const stepNodes: Node[] = []
    const workflowEdges: Edge[] = []

    // Create nodes for all steps referenced in the workflow
    const referencedSteps = new Set<string>()
    
    // Add root step
    referencedSteps.add(workflow.root)
    
    // Add terminal steps only if referenced by any edge
    const hasSuccess = workflow.edges.some(e => e.to === 'SUCCESS' || e.onFailure?.alternativeTarget === 'SUCCESS')
    const hasFailure = workflow.edges.some(e => e.to === 'FAILURE' || e.onFailure?.alternativeTarget === 'FAILURE')
    if (hasSuccess) referencedSteps.add('SUCCESS')
    if (hasFailure) referencedSteps.add('FAILURE')
    
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
            workflow: activeWorkflow,
          } as StepNodeData,
        })
        nodeIndex++
      }
    })

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
      console.log('Edge generation check:', { edgeDef, onFailure: edgeDef.onFailure })
      if (edgeDef.onFailure?.strategy === 'ALTERNATIVE' && edgeDef.onFailure.alternativeTarget) {
        console.log('Creating alternative edge:', edgeDef.from, '->', edgeDef.onFailure.alternativeTarget)
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
            label: 'ON FAILURE'
          } as EdgeData
        }
        workflowEdges.push(alternativeEdge)
      }
    })

    return { nodes: stepNodes, edges: workflowEdges }
  }, [appState.config, appState.activeWorkflow, currentTab, appState.ui.viewMode])

  // Generate nodes/edges from config for a workflow (used to initialize tabs)
  const generateGraphForWorkflow = useCallback((config: StepFlowConfig, workflowName: string): { nodes: Node[]; edges: Edge[] } => {
    const workflow = config.workflows?.[workflowName]
    if (!workflow || !config.steps) return { nodes: [], edges: [] }

    const stepNodes: Node[] = []
    const workflowEdges: Edge[] = []

    const referencedSteps = new Set<string>()
    referencedSteps.add(workflow.root)
    const hasSuccess2 = workflow.edges.some(e => e.to === 'SUCCESS' || e.onFailure?.alternativeTarget === 'SUCCESS')
    const hasFailure2 = workflow.edges.some(e => e.to === 'FAILURE' || e.onFailure?.alternativeTarget === 'FAILURE')
    if (hasSuccess2) referencedSteps.add('SUCCESS')
    if (hasFailure2) referencedSteps.add('FAILURE')

    workflow.edges.forEach(edge => {
      referencedSteps.add(edge.from)
      if (edge.to !== 'SUCCESS' && edge.to !== 'FAILURE') referencedSteps.add(edge.to)
      if (edge.onFailure?.alternativeTarget) referencedSteps.add(edge.onFailure.alternativeTarget)
    })

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
            workflow: workflowName,
            onEdit: (id: string) => openPropertiesForNode(id)
          } as StepNodeData,
        })
        nodeIndex++
      }
    })

    workflow.edges.forEach((edgeDef, index) => {
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
  }, [])

  // Rebuild tabs when an external import event is dispatched (e.g., from YamlViewer)
  useEffect(() => {
    const handler = (e: any) => {
      const imported: StepFlowConfig | undefined = e?.detail?.config
      const cfg = imported || appState.config
      const newTabs: WorkflowTabState[] = Object.keys(cfg.workflows || {}).map((wfName) => {
        const graph = generateGraphForWorkflow(cfg, wfName)
        return {
          id: generateId('tab'),
          workflowName: wfName,
          nodes: graph.nodes,
          edges: graph.edges,
          selectedNodes: [],
          selectedEdges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        }
      })
      setAppState(prev => ({ ...prev, config: cfg, workflowTabs: newTabs, activeTabIndex: 0 }))
    }
    window.addEventListener('stepflow-config-imported', handler as any)
    return () => window.removeEventListener('stepflow-config-imported', handler as any)
  }, [appState.config, generateGraphForWorkflow])

  // Handle keyboard shortcuts for DSL editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDslMaximized) {
          setIsDslMaximized(false)
          e.preventDefault()
        }
      }
      // F11 to toggle fullscreen (common shortcut)
      if (e.key === 'F11' && activeTab === 'dsl') {
        e.preventDefault()
        setIsDslMaximized(!isDslMaximized)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDslMaximized, activeTab])

  // Reset DSL states when switching away from DSL tab
  useEffect(() => {
    if (activeTab !== 'dsl') {
      setIsDslMaximized(false)
    }
  }, [activeTab])

  // Selected IDs based on current mode
  const selectedNodeIds = appState.ui.viewMode === 'tabs' 
    ? (currentTab?.selectedNodes || [])
    : []
  
  const selectedEdgeIds = appState.ui.viewMode === 'tabs'
    ? (currentTab?.selectedEdges || [])
    : []

  const selectedNodeId = selectedNodeIds[0]
  const selectedEdgeId = selectedEdgeIds[0]

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

  // Initialize components and setup
  useEffect(() => {
    setAppState(prev => ({ ...prev, components: MOCK_COMPONENTS }))
  }, [])

  // --- Session Persistence ---
  const [hydrated, setHydrated] = useState(false)
  type SavedSessionV1 = {
    version: 1
    timestamp: number
    config: StepFlowConfig
    activeTabIndex: number
    // Node positions per workflow and viewport per tab
    nodePositions: Record<string, Record<string, { x: number; y: number }>>
    viewports: Record<string, { x: number; y: number; zoom: number }>
  }

  const SESSION_KEY = 'stepflow-session-v1'

  // On load, restore previous session (ask user)
  useEffect(() => {
    if (restorationCheckedRef.current) return
    restorationCheckedRef.current = true
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) {
        setHydrated(true)
        return
      }
      const saved: SavedSessionV1 = JSON.parse(raw)
      if (!saved || saved.version !== 1 || !saved.config) return
      const shouldRestore = confirm('Restore previous StepFlow session?')
      if (!shouldRestore) {
        setHydrated(true)
        return
      }
      // Rebuild workflow tabs from saved config and reapply positions/viewport
      const cfg = saved.config
      const wfNames = Object.keys(cfg.workflows || {})
      const rebuiltTabs: WorkflowTabState[] = wfNames.map((wfName) => {
        const graph = generateGraphForWorkflow(cfg, wfName)
        const posMap = saved.nodePositions?.[wfName] || {}
        const mergedNodes = graph.nodes.map((n) => {
          const p = posMap[n.id]
          return p ? { ...n, position: { x: p.x, y: p.y } } : n
        })
        const viewport = saved.viewports?.[wfName] || { x: 0, y: 0, zoom: 1 }
        return {
          id: generateId('tab'),
          workflowName: wfName,
          nodes: mergedNodes,
          edges: graph.edges,
          selectedNodes: [],
          selectedEdges: [],
          viewport,
        }
      })
      setAppState((prev) => ({
        ...prev,
        config: cfg,
        workflowTabs: rebuiltTabs,
        activeTabIndex: Math.min(saved.activeTabIndex ?? 0, Math.max(rebuiltTabs.length - 1, 0)),
      }))
      setHydrated(true)
    } catch (e) {
      console.warn('Failed to restore session', e)
      setHydrated(true)
    }
  }, [generateGraphForWorkflow])

  // Save session (config + node positions + viewport) when relevant state changes
  useEffect(() => {
    if (!hydrated) return
    try {
      const nodePositions: SavedSessionV1['nodePositions'] = {}
      const viewports: SavedSessionV1['viewports'] = {}
      for (const tab of appState.workflowTabs) {
        nodePositions[tab.workflowName] = {}
        for (const n of tab.nodes) {
          nodePositions[tab.workflowName][n.id] = { x: n.position.x, y: n.position.y }
        }
        viewports[tab.workflowName] = tab.viewport
      }
      const payload: SavedSessionV1 = {
        version: 1,
        timestamp: Date.now(),
        config: appState.config,
        activeTabIndex: appState.activeTabIndex,
        nodePositions,
        viewports,
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
    } catch (e) {
      // ignore storage errors
      console.warn('Failed to save session', e)
    }
  }, [hydrated, appState.config, appState.workflowTabs, appState.activeTabIndex])

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {}
    // Reset state to a clean slate
    setAppState({
      config: INITIAL_CONFIG,
      activeWorkflow: undefined,
      workflowTabs: [],
      activeTabIndex: 0,
      components: MOCK_COMPONENTS,
      scanPackages: [],
      ui: {
        panels: { navigator: true, properties: true, console: false },
        showAllWorkflows: false,
        viewMode: 'tabs',
      },
    })
  }, [])

  const canGenerateCode = useCallback(() => {
    const stepsCount = Object.keys(appState.config.steps || {}).length
    const wfCount = Object.keys(appState.config.workflows || {}).length
    if (stepsCount === 0) return { ok: false, msg: 'No steps defined. Add steps before generating code.' }
    if (wfCount === 0) return { ok: false, msg: 'No workflows defined. Create a workflow before generating code.' }
    return { ok: true }
  }, [appState.config])

  const handleGenerateCode = useCallback(async () => {
    const v = canGenerateCode()
    if (!v.ok) {
      setCodegenError(v.msg)
      setShowCodegen(true)
      return
    }
    try {
      const { buildJavaZip } = await import('./lib/codegen')
      const opts = { projectName: codegenProjectName || 'stepflow-project', basePackage: codegenBasePackage || 'com.example.stepflow' }
      if (codegenIncludeJava) {
        const blob = buildJavaZip(appState.config, opts)
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${opts.projectName}-java.zip`
        a.click()
        URL.revokeObjectURL(a.href)
      }
      setShowCodegen(false)
    } catch (e) {
      setCodegenError('Failed to generate code: ' + String(e))
      setShowCodegen(true)
    }
  }, [appState.config, codegenProjectName, codegenBasePackage, codegenIncludeJava, canGenerateCode])

  // Setup keyboard shortcuts
  useUndoRedoShortcuts(undo, redo, canUndo, canRedo)

  // Global shortcuts: Create Workflow (Ctrl/Cmd+W), Add Step (Ctrl/Cmd+S)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Avoid interfering with text inputs
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isEditable = (target as any)?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'
      if (isEditable) return

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 'w') {
          e.preventDefault()
          // Optional safety: first-time warning about overriding browser tab close
          const allowCtrlW = localStorage.getItem('enableCtrlWShortcut') === '1'
          if (!allowCtrlW) {
            const proceed = confirm('Enable Ctrl/Cmd+W to Create Workflow? This overrides the browser tab-close shortcut while this app is focused.')
            if (!proceed) return
            localStorage.setItem('enableCtrlWShortcut', '1')
          }
          // Ensure properties panel is visible and switch to Workflow tab
          setAppState(prev => ({
            ...prev,
            ui: { ...prev.ui, panels: { ...prev.ui.panels, properties: true } }
          }))
          setActiveTab('workflow')
          // Trigger create workflow form
          setTimeout(() => {
            const event = new CustomEvent('createWorkflow')
            document.dispatchEvent(event)
          }, 50)
        } else if (key === 's') {
          e.preventDefault()
          const hasWorkflow = Object.keys(appState.config.workflows || {}).length > 0
          if (!hasWorkflow) {
            alert('Please create at least one workflow before adding steps.')
            return
          }
          setShowQuickAddDialog(true)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [appState.config.workflows])

  // Toggle view mode between single and tabs

  // === TAB MODE FUNCTIONS ===
  
  // Create workflow tab
  const createWorkflowTab = useCallback((workflowName: string) => {
    const initial = generateGraphForWorkflow(appState.config, workflowName)
    const newTab: WorkflowTabState = {
      id: generateId('tab'),
      workflowName,
      nodes: initial.nodes,
      edges: initial.edges,
      selectedNodes: [],
      selectedEdges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    setAppState(prev => ({
      ...prev,
      workflowTabs: [...prev.workflowTabs, newTab],
      activeTabIndex: prev.workflowTabs.length
    }))
  }, [appState.config, generateGraphForWorkflow])

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

  // Switch to workflow (single or tab mode)
  const handleActiveWorkflowChange = useCallback((workflowName: string) => {
    if (appState.ui.viewMode === 'single') {
      setAppState(prev => ({ ...prev, activeWorkflow: workflowName }))
    } else {
      // Tab mode - find or create tab
      const existingTabIndex = appState.workflowTabs.findIndex(tab => tab.workflowName === workflowName)
      if (existingTabIndex !== -1) {
        setAppState(prev => ({ ...prev, activeTabIndex: existingTabIndex }))
      } else {
        createWorkflowTab(workflowName)
      }
    }
  }, [appState.ui.viewMode, appState.workflowTabs, createWorkflowTab])

  // Update tab state
  const updateTabState = useCallback((updates: Partial<WorkflowTabState>) => {
    if (appState.ui.viewMode !== 'tabs' || !currentTab) return

    setAppState(prev => ({
      ...prev,
      workflowTabs: prev.workflowTabs.map((tab, index) =>
        index === prev.activeTabIndex ? { ...tab, ...updates } : tab
      )
    }))
  }, [appState.ui.viewMode, currentTab])

  // Node change handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes)
    
    if (appState.ui.viewMode === 'tabs') {
      updateTabState({ nodes: updatedNodes })
    }
    // In single mode, nodes are generated from config, so no direct update needed
  }, [nodes, appState.ui.viewMode, updateTabState])

  // Edge change handlers  
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, edges)
    
    if (appState.ui.viewMode === 'tabs') {
      updateTabState({ edges: updatedEdges })
    }

    // Handle edge removals by updating config
    const removedEdges = changes
      .filter(change => change.type === 'remove')
      .map(change => edges.find(e => e.id === change.id))
      .filter(Boolean)

    if (removedEdges.length > 0) {
      setAppState(prev => {
        const newConfig = { ...prev.config }
        const activeWorkflowName = prev.ui.viewMode === 'tabs' ? currentTab?.workflowName : prev.activeWorkflow
        
        if (activeWorkflowName && newConfig.workflows?.[activeWorkflowName]) {
          const workflow = newConfig.workflows[activeWorkflowName]
          const remainingEdgeIds = updatedEdges
            .filter(e => !e.className?.includes('edge-failure'))
            .map(e => e.id)
          
          const newWorkflows = { ...newConfig.workflows }
          newWorkflows[activeWorkflowName] = {
            ...workflow,
            edges: workflow.edges.filter((_, index) => 
              remainingEdgeIds.includes(`${workflow.edges[index]?.from}-${workflow.edges[index]?.to}-${index}`)
            )
          }
          
          newConfig.workflows = newWorkflows
        }
        
        return { ...prev, config: newConfig }
      })
    }
  }, [edges, appState.ui.viewMode, updateTabState, currentTab])

  // Selection change handler (no auto-opening of properties)
  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }) => {
    const nodeIds = selectedNodes?.map(node => node.id) || []
    const edgeIds = selectedEdges?.map(edge => edge.id) || []
    if (appState.ui.viewMode === 'tabs') {
      updateTabState({ selectedNodes: nodeIds, selectedEdges: edgeIds })
    }
  }, [appState.ui.viewMode, updateTabState])

  // Helper: open properties for a node from the node card's Edit button
  const openPropertiesForNode = useCallback((nodeId: string) => {
    setActiveTab('properties')
    if (appState.ui.viewMode === 'tabs') {
      updateTabState({ selectedNodes: [nodeId], selectedEdges: [] })
    }
  }, [appState.ui.viewMode, updateTabState])

  // Copy selected step (reference only)
  const copySelectedNode = useCallback(() => {
    if (appState.ui.viewMode !== 'tabs' || !currentTab) return
    const sel = currentTab.selectedNodes?.[0]
    if (!sel) return
    if (!appState.config.steps?.[sel]) return
    setClipboardStepId(sel)
  }, [appState.ui.viewMode, currentTab, appState.config.steps])

  // Paste step into current tab as reference (no new entry in config.steps)
  const pasteNodeFromClipboard = useCallback(() => {
    if (!clipboardStepId) return
    if (appState.ui.viewMode !== 'tabs' || !currentTab) return
    const stepDef = appState.config.steps?.[clipboardStepId]
    if (!stepDef) return

    const exists = currentTab.nodes.find(n => n.id === clipboardStepId)
    if (exists) {
      updateTabState({ selectedNodes: [clipboardStepId], selectedEdges: [] })
      setActiveTab('properties')
      return
    }

    const newNode: Node = {
      id: clipboardStepId,
      type: 'step',
      position: { x: 220 + (currentTab.nodes.length % 4) * 230, y: 120 + Math.floor(currentTab.nodes.length / 4) * 150 },
      data: {
        id: clipboardStepId,
        label: clipboardStepId,
        type: stepDef.type,
        config: stepDef.config,
        guards: stepDef.guards,
        retry: stepDef.retry,
        workflow: currentTab.workflowName,
        onEdit: (id: string) => openPropertiesForNode(id)
      } as StepNodeData
    }

    updateTabState({ nodes: [...currentTab.nodes, newNode], selectedNodes: [clipboardStepId], selectedEdges: [] })
    setActiveTab('properties')
  }, [clipboardStepId, appState.ui.viewMode, currentTab, appState.config.steps, openPropertiesForNode, updateTabState])

  // Global copy/paste shortcuts for step nodes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.getAttribute('role') === 'textbox')
      if (isEditable) return
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrl = isMac ? e.metaKey : e.ctrlKey
      if (!ctrl) return
      const key = e.key.toLowerCase()
      if (key === 'c') {
        e.preventDefault()
        copySelectedNode()
      } else if (key === 'v') {
        e.preventDefault()
        pasteNodeFromClipboard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [copySelectedNode, pasteNodeFromClipboard])

  // Auto-arrange current workflow/tab nodes left-to-right
  const autoArrange = useCallback(() => {
    if (appState.ui.viewMode === 'tabs' && currentTab) {
      const layoutEdges = (currentTab.edges || []).filter(e => !e.className?.includes('edge-failure'))
      const { nodes: laidOut } = LayoutAlgorithms.applyLayout(currentTab.nodes || [], layoutEdges as any, 'hierarchical', {
        spacing: { x: 380, y: 180 },
        padding: { x: 120, y: 120 },
        direction: 'LR'
      })
      updateTabState({ nodes: laidOut })
      // force ReactFlow to remount so fitView triggers on next render
      setLayoutVersion(v => v + 1)
    } else {
      // Single mode: not primary path in V4, but attempt using computed nodes/edges
      const layoutEdges = (edges || []).filter(e => !e.className?.includes('edge-failure'))
      const { nodes: laidOut } = LayoutAlgorithms.applyLayout(nodes || [], layoutEdges as any, 'hierarchical', {
        spacing: { x: 380, y: 180 },
        padding: { x: 120, y: 120 },
        direction: 'LR'
      })
      // no direct setter for single mode nodes; users typically work in tabs
      console.debug('Auto-arrange (single mode) computed positions:', laidOut.length)
    }
  }, [appState.ui.viewMode, currentTab, nodes, edges, updateTabState])

  // Connection handler
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return

    const workflowName = appState.ui.viewMode === 'tabs' ? currentTab?.workflowName : appState.activeWorkflow
    if (!workflowName || !appState.config.workflows?.[workflowName]) return

    const newEdgeDef = {
      from: connection.source,
      to: connection.target
    }
    
    const workflow = appState.config.workflows[workflowName]
    const updatedWorkflow: WorkflowDef = {
      ...workflow,
      edges: [...workflow.edges, newEdgeDef]
    }

    const newConfig = {
      ...appState.config,
      workflows: {
        ...appState.config.workflows,
        [workflowName]: updatedWorkflow
      }
    }
    
    setAppState(prev => ({ ...prev, config: newConfig }))

    // In tabs mode, also add the edge to the current tab so it renders immediately
    if (appState.ui.viewMode === 'tabs' && currentTab) {
      const newEdge: Edge = {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        className: 'edge-main',
        data: {
          id: `${connection.source}-${connection.target}`,
          kind: 'normal'
        } as EdgeData
      }
      updateTabState({ edges: [...(currentTab.edges || []), newEdge] })
    }
  }, [appState.ui.viewMode, currentTab, appState.activeWorkflow, appState.config, updateTabState])

  // Quick add step dialog
  const handleQuickAddStep = useCallback((name: string, stepDef: StepDef) => {
    const hasWorkflow = Object.keys(appState.config.workflows || {}).length > 0
    if (!hasWorkflow) {
      alert('Please create at least one workflow before adding steps.')
      setShowQuickAddDialog(false)
      return
    }
    const newConfig = {
      ...appState.config,
      steps: {
        ...appState.config.steps,
        [name]: stepDef
      }
    }

    // For multi-tab mode, also add node to current tab
    if (appState.ui.viewMode === 'tabs' && currentTab) {
      const newNode = {
        id: name,
        type: 'step',
        position: { 
          x: 250 + Math.random() * 200, 
          y: 150 + currentTab.nodes.length * 100 + Math.random() * 50 
        },
        data: {
          id: name,
          label: name,
          type: stepDef.type,
          config: stepDef.config,
          guards: stepDef.guards,
          retry: stepDef.retry,
          workflow: currentTab.workflowName,
          onEdit: (id: string) => openPropertiesForNode(id)
        }
      }

      setAppState(prev => {
        const updatedTabs = prev.workflowTabs.map((tab, index) => 
          index === prev.activeTabIndex
            ? { ...tab, nodes: [...tab.nodes, newNode] }
            : tab
        )
        console.log('Adding node to tab:', prev.activeTabIndex, 'New tabs:', updatedTabs)
        return {
          ...prev,
          config: newConfig,
          workflowTabs: updatedTabs
        }
      })
    } else {
      setAppState(prev => ({ ...prev, config: newConfig }))
    }
    
    setShowQuickAddDialog(false)
  }, [appState.config, appState.ui.viewMode, currentTab, appState.activeTabIndex])

  // Transform config for YAML output (rename retryAttempts to attempts, retryDelay to delay)
  const transformConfigForYaml = useCallback((config: StepFlowConfig): StepFlowConfig => {
    const transformedConfig = JSON.parse(JSON.stringify(config)) // Deep clone
    
    // Transform edges in workflows
    if (transformedConfig.workflows) {
      Object.values(transformedConfig.workflows).forEach((workflow: any) => {
        if (workflow.edges) {
          workflow.edges.forEach((edge: any) => {
            if (edge.onFailure && edge.onFailure.strategy === 'RETRY') {
              if (edge.onFailure.retryAttempts !== undefined) {
                edge.onFailure.attempts = edge.onFailure.retryAttempts
                delete edge.onFailure.retryAttempts
              }
              if (edge.onFailure.retryDelay !== undefined) {
                edge.onFailure.delay = edge.onFailure.retryDelay
                delete edge.onFailure.retryDelay
              }
            }
          })
        }
      })
    }
    
    return transformedConfig
  }, [])

  // Transform config from YAML input (rename attempts to retryAttempts, delay to retryDelay)
  const transformConfigFromYaml = useCallback((config: StepFlowConfig): StepFlowConfig => {
    const transformedConfig = JSON.parse(JSON.stringify(config)) // Deep clone
    
    // Transform edges in workflows
    if (transformedConfig.workflows) {
      Object.values(transformedConfig.workflows).forEach((workflow: any) => {
        if (workflow.edges) {
          workflow.edges.forEach((edge: any) => {
            if (edge.onFailure && edge.onFailure.strategy === 'RETRY') {
              if (edge.onFailure.attempts !== undefined) {
                edge.onFailure.retryAttempts = edge.onFailure.attempts
                delete edge.onFailure.attempts
              }
              if (edge.onFailure.delay !== undefined) {
                edge.onFailure.retryDelay = edge.onFailure.delay
                delete edge.onFailure.delay
              }
            }
          })
        }
      })
    }
    
    return transformedConfig
  }, [])

  // YAML Export (simplified like V1)
  const exportYAML = useCallback(() => {
    try {
      const transformedConfig = transformConfigForYaml(appState.config)
      const yaml = YAML.stringify(transformedConfig)
      const blob = new Blob([yaml], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'stepflow-config.yaml'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export YAML:', error)
      alert('Failed to export YAML')
    }
  }, [appState.config, transformConfigForYaml])

  // YAML Import (simplified like V1)
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
            let parsed = YAML.parse(yaml) as StepFlowConfig
            
            // Transform YAML format to internal format (attempts -> retryAttempts, delay -> retryDelay)
            parsed = transformConfigFromYaml(parsed)
            const hasWorkflows = Object.keys(parsed.workflows || {}).length > 0
            const hasRestrictedSections =
              (parsed.steps && Object.keys(parsed.steps).length > 0) ||
              (parsed.settings && Object.keys(parsed.settings).length > 0) ||
              (parsed.defaults && Object.keys(parsed.defaults).length > 0)
            if (!hasWorkflows && hasRestrictedSections) {
              alert('Import blocked: add at least one workflow to create or update steps, settings, or defaults.')
              return
            }
            // Build workflow tabs for all workflows in the imported config
            const newTabs: WorkflowTabState[] = Object.keys(parsed.workflows || {}).map((wfName) => {
              const graph = generateGraphForWorkflow(parsed, wfName)
              return {
                id: generateId('tab'),
                workflowName: wfName,
                nodes: graph.nodes,
                edges: graph.edges,
                selectedNodes: [],
                selectedEdges: [],
                viewport: { x: 0, y: 0, zoom: 1 },
              }
            })
            setAppState(prev => ({ ...prev, config: parsed, workflowTabs: newTabs, activeTabIndex: 0 }))
          } catch (error) {
            alert('Failed to parse YAML file')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])

  // Basic validation (similar to V1) and attach issues to nodes
  const validateNode = useCallback((nodeId: string): ValidationIssue[] => {
    const issues: ValidationIssue[] = []
    const { config } = appState
    const step = config.steps?.[nodeId]
    if (!step) {
      issues.push({ type: 'error', message: 'Step definition not found', location: `steps.${nodeId}` })
      return issues
    }
    if (!step.type) {
      issues.push({ type: 'error', message: 'Step type is required', location: `steps.${nodeId}.type` })
    }
    if (step.retry) {
      const retry = step.retry
      if (retry.maxAttempts < 1) {
        issues.push({ type: 'error', message: 'Max attempts must be >= 1', location: `steps.${nodeId}.retry.maxAttempts` })
      }
      if (retry.delay < 0) {
        issues.push({ type: 'error', message: 'Delay must be >= 0', location: `steps.${nodeId}.retry.delay` })
      }
    }
    return issues
  }, [appState])

  useEffect(() => {
    const newResults: Record<string, ValidationIssue[]> = {}
    Object.keys(appState.config.steps || {}).forEach(stepName => {
      newResults[stepName] = validateNode(stepName)
    })
    setValidationResults(newResults)
  }, [appState.config, validateNode])

  // Reflect validation issues on current tab nodes for visual cues (debounced, minimal changes)
  useEffect(() => {
    if (isDragging) return
    if (!(appState.ui.viewMode === 'tabs' && currentTab)) return
    const timer = setTimeout(() => {
      const updated = (currentTab.nodes || []).map(n => {
        const oldIssues = (n.data as any)?.issues || []
        const newIssues = validationResults[n.id] || []
        // Compare shallowly by length and stringified messages/types
        const same = oldIssues.length === newIssues.length &&
          JSON.stringify(oldIssues.map((i: any) => [i.type, i.message])) === JSON.stringify(newIssues.map((i: any) => [i.type, i.message]))
        if (same) return n
        return { ...n, data: { ...(n.data as any), issues: newIssues } }
      })
      // Only update if any node actually changed reference
      const changed = updated.some((n, i) => n !== (currentTab.nodes || [])[i])
      if (changed) updateTabState({ nodes: updated })
    }, 150)
    return () => clearTimeout(timer)
  }, [validationResults, appState.ui.viewMode, currentTab, updateTabState, isDragging])

  // Get selected node data
  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return undefined
    
    const node = nodes.find(n => n.id === selectedNodeId)
    return node?.data as StepNodeData | GuardNodeData | undefined
  }, [nodes, selectedNodeId])
  
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

  // Basic workflow-level validation to surface in IssuesPanel
  const workflowIssues = useMemo(() => {
    const cfg = appState.config
    const steps = cfg.steps || {}
    const workflows = cfg.workflows || {}
    const results: Array<{ workflow: string; issues: ValidationIssue[] }> = []
    Object.entries(workflows).forEach(([wfName, wf]) => {
      const issues: ValidationIssue[] = []
      if (!wf.root) {
        issues.push({ type: 'error', message: 'Workflow must have a root step', location: `workflows.${wfName}.root` })
      } else if (!steps[wf.root] && wf.root !== 'SUCCESS' && wf.root !== 'FAILURE') {
        issues.push({ type: 'error', message: `Root step '${wf.root}' is not defined`, location: `workflows.${wfName}.root` })
      }
      (wf.edges || []).forEach((edge, idx) => {
        if (edge.from && !steps[edge.from] && edge.from !== 'SUCCESS' && edge.from !== 'FAILURE') {
          issues.push({ type: 'error', message: `Source step '${edge.from}' is not defined`, location: `workflows.${wfName}.edges[${idx}].from` })
        }
        if (edge.to && !steps[edge.to] && edge.to !== 'SUCCESS' && edge.to !== 'FAILURE') {
          issues.push({ type: 'error', message: `Target step '${edge.to}' is not defined`, location: `workflows.${wfName}.edges[${idx}].to` })
        }
      })
      if (issues.length > 0) {
        results.push({ workflow: wfName, issues })
      }
    })
    return results
  }, [appState.config])

  // Keep tab node flags (isRoot, isTerminal) in sync when workflow root changes via WorkflowManager
  useEffect(() => {
    if (appState.ui.viewMode !== 'tabs' || !currentTab) return
    const wf = appState.config.workflows?.[currentTab.workflowName]
    if (!wf) return
    const updated = currentTab.nodes.map(n => {
      const isRoot = n.id === wf.root
      const isTerminal = n.id === 'SUCCESS' || n.id === 'FAILURE'
      const prev = n.data as any
      if ((prev?.isRoot ?? false) !== isRoot || (prev?.isTerminal ?? false) !== isTerminal) {
        return { ...n, data: { ...prev, isRoot, isTerminal } }
      }
      return n
    })
    const changed = updated.some((n, i) => n !== currentTab.nodes[i])
    if (changed) updateTabState({ nodes: updated })
  }, [appState.config.workflows, appState.ui.viewMode, currentTab, updateTabState])

  

  // Initialize tab nodes when switching to tab mode
  useEffect(() => {
    if (appState.ui.viewMode === 'tabs' && currentTab && currentTab.nodes.length === 0 && appState.config.workflows?.[currentTab.workflowName]) {
      // Initialize tab with nodes from config
      const { nodes: configNodes, edges: configEdges } = nodes.length > 0 ? { nodes, edges } : { nodes: [], edges: [] }
      updateTabState({ 
        nodes: configNodes, 
        edges: configEdges 
      })
    }
  }, [appState.ui.viewMode, currentTab, appState.config.workflows, nodes, edges, updateTabState])

  // Render multi-tab canvas
  const renderTabCanvas = () => {
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
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 relative group border-b-2 ${
                  appState.activeTabIndex === index
                    ? "bg-primary/10 text-primary border-primary shadow-sm"
                    : "border-transparent hover:bg-background/50"
                }`}
              >
                <span className="truncate max-w-32">{tab.workflowName}</span>
                <span
                  role="button"
                  aria-label="Close tab"
                  className="inline-flex items-center justify-center h-4 w-4 p-0 ml-2 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeWorkflowTab(index)
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content: render only active tab's canvas to avoid overlapping layers */}
        <div className="flex-1 overflow-hidden relative">
          {(() => {
            const tab = appState.workflowTabs[appState.activeTabIndex]
            if (!tab) return null
            return (
              <div key={`${tab.workflowName}-${appState.activeTabIndex}`} className="absolute inset-0 h-full w-full z-10">
                <ReactFlowProvider>
                  <ReactFlow
                    key={`rf-${tab.id}-${appState.activeTabIndex}-${layoutVersion}`}
                    nodes={tab.nodes}
                    edges={tab.edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onSelectionChange={onSelectionChange}
                    onConnect={onConnect}
                    onNodeDragStart={() => setIsDragging(true)}
                    onNodeDragStop={() => setIsDragging(false)}
                    nodeTypes={nodeTypes}
                    defaultViewport={tab.viewport}
                    onMoveEnd={(e, viewport) => {
                      if (appState.ui.viewMode === 'tabs') {
                        updateTabState({ viewport })
                      }
                    }}
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

                    <Panel position="top-right" className="p-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={autoArrange}
                        className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
                        title="Auto Arrange (Left→Right)"
                      >
                        <LayoutDashboard className="w-5 h-5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowQuickAddDialog(true)}
                        className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
                        title="Add Step (Ctrl/Cmd+S)"
                      >
                        <Settings className="w-5 h-5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveTab('workflow')
                          setTimeout(() => {
                            const event = new CustomEvent('createWorkflow')
                            document.dispatchEvent(event)
                          }, 100)
                        }}
                        className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
                        title="Add Workflow (Ctrl/Cmd+W)"
                      >
                        <FolderGit2 className="w-5 h-5" />
                      </Button>
                    </Panel>
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

  // Render single workflow canvas
  const renderSingleCanvas = () => {
    return (
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="h-full w-full"
        >
          <Background />
          <Controls />
          
          {/* Canvas Action Buttons */}
          <Panel position="top-right" className="p-2 flex gap-2">
            <Button
              size="sm"
              onClick={autoArrange}
              className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
              title="Auto Arrange (Left→Right)"
            >
              <LayoutDashboard className="w-5 h-5" />
            </Button>
            {/* Add Step Button */}
            <Button
              size="sm"
              onClick={() => setShowQuickAddDialog(true)}
              className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
              title="Add Step (Ctrl/Cmd+S)"
            >
              <Settings className="w-5 h-5" />
            </Button>
            
            {/* Add Workflow Button */}
            <Button
              size="sm"
              onClick={() => {
                // Switch to workflow tab
                setActiveTab('workflow')
                // Small delay to ensure tab is switched before triggering workflow creation
                setTimeout(() => {
                  const event = new CustomEvent('createWorkflow')
                  document.dispatchEvent(event)
                }, 100)
              }}
              className="shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 p-0"
              title="Add Workflow (Ctrl/Cmd+W)"
            >
              <FolderGit2 className="w-5 h-5" />
            </Button>
          </Panel>
          
          {appState.activeWorkflow && (
            <Panel position="top-left">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <span className="font-medium text-sm">{appState.activeWorkflow}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{nodes.length} steps</span>
                  <span>•</span>
                  <span>{edges.filter(e => !e.className?.includes('edge-failure')).length} edges</span>
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </ReactFlowProvider>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">StepFlow Builder V4</h1>
          </div>
          
          {((appState.ui.viewMode === 'single' && appState.activeWorkflow) ||
            (appState.ui.viewMode === 'tabs' && currentTab)) && (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-sm">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>{appState.ui.viewMode === 'single' ? appState.activeWorkflow : currentTab?.workflowName}</span>
              {appState.ui.viewMode === 'tabs' && (
                <span className="text-xs opacity-75">
                  [{appState.activeTabIndex + 1}/{appState.workflowTabs.length}]
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          
          <div className="h-4 w-px bg-border mx-1" />
          
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
              <Button size="sm" variant="outline" className="h-7 ml-1" onClick={() => setShowIssuesPanel(true)}>
                View Issues
              </Button>
            </div>
          )}
          
          {/* Action Buttons */}
          <Button 
            size="icon" 
            variant="outline" 
            title="Undo (Ctrl+Z)" 
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            title="Redo (Ctrl+Y)" 
            onClick={redo}
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

          {/* Generate Code */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              const v = canGenerateCode()
              setCodegenError(v.ok ? null : v.msg as any)
              // Default project name from first workflow if available
              const wfNames = Object.keys(appState.config.workflows || {})
              if (wfNames.length > 0) setCodegenProjectName(wfNames[0])
              setShowCodegen(true)
            }}
            title="Generate Java/Scala Code"
          >
            <FileCode className="w-4 h-4" />
          </Button>

          {/* Clear session */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              if (confirm('Clear saved session and start fresh?')) clearSession()
            }}
            title="Clear Session"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <Button 
            size="icon" 
            variant="outline" 
            onClick={() => setCollaborationEnabled(!collaborationEnabled)}
            title={collaborationEnabled ? "Disable Collaboration" : "Enable Collaboration"}
          >
            {collaborationEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </Button>
          
          <Button size="icon" variant="outline" onClick={toggleTheme} title={`Switch to ${darkMode ? 'Light' : 'Dark'} Mode`}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          
          <Button 
            size="icon" 
            variant="outline" 
            onClick={() => setAppState(prev => ({ 
              ...prev, 
              ui: { ...prev.ui, panels: { ...prev.ui.panels, properties: !prev.ui.panels.properties } }
            }))}
            title="Toggle Properties Panel"
          >
            {appState.ui.panels.properties ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          {renderTabCanvas()}
        </div>
        
        {/* Right Sidebar (collapsible and resizable) */}
        {appState.ui.panels.properties && (
        <>
          {/* Resize Handle */}
          <div
            className={`w-2 relative group flex-shrink-0 cursor-col-resize transition-all duration-200 ${
              isResizing 
                ? 'bg-primary/30 shadow-lg' 
                : 'bg-transparent hover:bg-primary/10'
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              setIsResizing(true)
              const startX = e.clientX
              const startWidth = sidebarWidth
              
              const handleMouseMove = (e: MouseEvent) => {
                const deltaX = startX - e.clientX
                const newWidth = Math.max(300, Math.min(1000, startWidth + deltaX))
                setSidebarWidth(newWidth)
              }
              
              const handleMouseUp = () => {
                setIsResizing(false)
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
              }
              
              document.addEventListener('mousemove', handleMouseMove)
              document.addEventListener('mouseup', handleMouseUp)
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
          >
            {/* Main resize line */}
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-px bg-border group-hover:bg-primary/60 transition-colors duration-200 dark:bg-border"></div>
            
            {/* Visual grip indicator */}
            <div className={`absolute inset-y-0 left-1/2 transform -translate-x-1/2 flex items-center justify-center transition-opacity duration-200 ${
              isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              <div className="flex flex-col gap-1 items-center">
                <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
                <div className="w-1 h-1 bg-primary/60 rounded-full"></div>
              </div>
            </div>
            
            {/* Hover overlay */}
            <div className={`absolute inset-0 transition-all duration-200 ${
              isResizing 
                ? 'bg-primary/15 shadow-md' 
                : 'bg-transparent hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10'
            }`}></div>
            
            {/* Active resize indicator */}
            {isResizing && (
              <div className="absolute -left-1 -right-1 inset-y-0 bg-primary/20 border-l-2 border-r-2 border-primary/50 rounded-sm"></div>
            )}
          </div>
          
          <div 
            className={`border-l border-gray-200 dark:border-gray-800 bg-card flex flex-col overflow-hidden transition-all duration-200 flex-shrink-0 ${
              isResizing ? 'select-none' : ''
            }`}
            style={{ width: `${sidebarWidth}px` }}
          >
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
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors text-center ${
                activeTab === 'dsl'
                  ? 'text-primary border-b-2 border-primary bg-accent/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              onClick={() => setActiveTab('dsl')}
            >
              DSL
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
          
          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'yaml' && (
              <div className="h-full flex flex-col overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium">Live YAML Preview</div>
                      <div className="text-xs text-muted-foreground">
                        Real-time configuration • {yamlViewMode === 'tree' ? '🌳 Tree View' : '📄 YAML View'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setYamlViewMode('tree')}
                        className={`p-1.5 rounded-md text-xs transition-all ${
                          yamlViewMode === 'tree' 
                            ? 'bg-primary text-primary-foreground shadow-sm' 
                            : 'bg-secondary text-secondary-foreground hover:bg-accent'
                        }`}
                        title="Tree view"
                      >
                        <List className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setYamlViewMode('yaml')}
                        className={`p-1.5 rounded-md text-xs transition-all ${
                          yamlViewMode === 'yaml' 
                            ? 'bg-primary text-primary-foreground shadow-sm' 
                            : 'bg-secondary text-secondary-foreground hover:bg-accent'
                        }`}
                        title="YAML view"
                      >
                        <FileCode className="w-3 h-3" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const transformedConfig = transformConfigForYaml(appState.config)
                            const yaml = YAML.stringify(transformedConfig, { indent: 2, lineWidth: -1, minContentWidth: 0 })
                            await navigator.clipboard.writeText(yaml)
                          } catch (error) {
                            console.error('Failed to copy YAML:', error)
                          }
                        }}
                        className="p-1.5 rounded-md text-xs bg-secondary text-secondary-foreground hover:bg-accent transition-all"
                        title="Copy YAML"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-3">
                  <div className="relative w-full h-full">
                    <div
                      className="w-full h-full bg-slate-50 dark:bg-slate-900 border border-border rounded-lg overflow-hidden"
                      style={{ maxHeight: 'calc(100vh - 200px)', minHeight: '400px' }}
                    >
                      {yamlViewMode === 'tree' ? (
                        <YamlTreeView 
                          data={transformConfigForYaml(appState.config)}
                          yamlString={YAML.stringify(transformConfigForYaml(appState.config), { indent: 2, lineWidth: -1, minContentWidth: 0 })}
                          className="h-full"
                        />
                      ) : (
                        <pre
                          className="w-full h-full p-4 m-0 overflow-auto font-mono text-sm leading-relaxed whitespace-pre-wrap"
                          style={{
                            fontFamily:
                              'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                            background: 'transparent',
                            color: 'inherit',
                          }}
                        >
                        {(() => {
                          try {
                            const transformedConfig = transformConfigForYaml(appState.config)
                            const yaml = YAML.stringify(transformedConfig, { indent: 2, lineWidth: -1, minContentWidth: 0 })
                            return yaml.split('\n').map((line, index) => (
                              <div key={index} style={{ minHeight: '1.5em' }}>
                                {(() => {
                                  if (/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/.test(line)) {
                                    const match = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:(.*)$/)
                                    if (match) {
                                      const [, indent, key, rest] = match
                                      return (
                                        <>
                                          <span>{indent}</span>
                                          <span style={{ color: '#2563eb', fontWeight: 600 }}>{key}</span>
                                          <span style={{ color: '#6b7280' }}>:</span>
                                          <span>{rest}</span>
                                        </>
                                      )
                                    }
                                  }

                                  if (/^(\s*)-\s/.test(line)) {
                                    const match = line.match(/^(\s*)-(\s*.*)$/)
                                    if (match) {
                                      const [, indent, rest] = match
                                      return (
                                        <>
                                          <span>{indent}</span>
                                          <span style={{ color: '#9333ea', fontWeight: 700 }}>-</span>
                                          <span>{rest}</span>
                                        </>
                                      )
                                    }
                                  }

                                  return (
                                    <span>
                                      {line
                                        .split(/("([^"]*)"|\b(\d+(?:\.\d+)?)\b|\b(true|false|null)\b)/)
                                        .map((part, partIndex) => {
                                          if (!part) return null
                                          if (part.startsWith('"') && part.endsWith('"')) {
                                            return (
                                              <span key={partIndex} style={{ color: '#16a34a' }}>
                                                {part}
                                              </span>
                                            )
                                          }
                                          if (/^\d+(?:\.\d+)?$/.test(part)) {
                                            return (
                                              <span key={partIndex} style={{ color: '#ea580c', fontWeight: 500 }}>
                                                {part}
                                              </span>
                                            )
                                          }
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
                            ))
                          } catch (error) {
                            return <div># Error generating YAML: {String(error)}</div>
                          }
                        })()}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'dsl' && (
              <div className={`${
                isDslMaximized 
                  ? 'fixed inset-0 z-50 dsl-maximized-modal' 
                  : 'h-full overflow-auto'
              } transition-all duration-300`}>
                {isDslMaximized && (
                  <div className="flex items-center justify-between p-4 border-b bg-card">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold">DSL</h2>
                      <Tabs value={dslInnerTab} onValueChange={(v) => setDslInnerTab(v as any)}>
                        <TabsList className="h-8 p-0 bg-transparent">
                          <TabsTrigger value="editor" className="h-8 px-3 text-xs">Editor</TabsTrigger>
                          <TabsTrigger value="quickstart" className="h-8 px-3 text-xs">Quick Start</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <button
                      onClick={() => setIsDslMaximized(false)}
                      className="p-2 hover:bg-accent rounded transition-colors"
                      title="Exit fullscreen"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <div className={`${isDslMaximized ? 'h-[calc(100vh-5rem)] overflow-auto' : 'h-full'} flex flex-col`}>
                  {!isDslMaximized && (
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">DSL</span>
                        </div>
                        <Tabs value={dslInnerTab} onValueChange={(v) => setDslInnerTab(v as any)}>
                          <TabsList className="h-8 p-0 bg-transparent">
                            <TabsTrigger value="editor" className="h-8 px-3 text-xs">Editor</TabsTrigger>
                            <TabsTrigger value="quickstart" className="h-8 px-3 text-xs">Quick Start</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <button
                        onClick={() => setIsDslMaximized(true)}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="Maximize DSL editor (F11)"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className={`${isDslMaximized ? 'p-6' : 'p-3'} flex-1 overflow-auto`}>
                    <div className={dslInnerTab === 'editor' ? '' : 'hidden'}>
                      <DslViewer
                        config={appState.config}
                        onConfigChange={(newConfig) => setAppState(prev => ({ ...prev, config: newConfig }))}
                        components={appState.components}
                      />
                    </div>
                    <div className={dslInnerTab === 'quickstart' ? '' : 'hidden'}>
                      <DslQuickStart />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'properties' && (
              <div className="h-full overflow-auto p-4">
                <PropertiesPanel
                  selectedNodeId={selectedNodeId}
                  selectedEdgeId={selectedEdgeId}
                  nodeData={selectedNodeData}
                  edgeData={selectedEdgeData?.edgeData}
                  edge={selectedEdgeData?.edge}
                  config={appState.config}
              onUpdateNode={(nodeId, updates) => {
                // Update UI node data in tab mode
                if (appState.ui.viewMode === 'tabs' && currentTab) {
                  updateTabState({
                    nodes: currentTab.nodes.map(n => n.id === nodeId ? { ...n, data: { ...(n.data as any), ...updates } } : n)
                  })
                }
                // Sync to config for step fields
                setAppState(prev => {
                  const cfg = { ...prev.config }
                  const step = cfg.steps?.[nodeId]
                  if (step) {
                    const newStep = { ...step }
                    if ((updates as any).type !== undefined) newStep.type = (updates as any).type
                    if ((updates as any).config !== undefined) newStep.config = (updates as any).config
                    if ((updates as any).guards !== undefined) newStep.guards = (updates as any).guards
                    if ((updates as any).retry !== undefined) newStep.retry = (updates as any).retry
                    cfg.steps = { ...(cfg.steps || {}), [nodeId]: newStep }
                  }
                  return { ...prev, config: cfg }
                })
              }}
              onDeleteNode={(nodeId) => {
                // Remove from current tab
                if (appState.ui.viewMode === 'tabs' && currentTab) {
                  const remainingNodes = currentTab.nodes.filter(n => n.id !== nodeId)
                  const remainingEdges = currentTab.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
                  updateTabState({ nodes: remainingNodes, edges: remainingEdges })
                }
                // Remove from config (step and any edges referencing it)
                setAppState(prev => {
                  const cfg = { ...prev.config }
                  const steps = { ...(cfg.steps || {}) }
                  delete steps[nodeId]
                  const wfNames = Object.keys(cfg.workflows || {})
                  const newWfs: Record<string, WorkflowDef> = {}
                  wfNames.forEach(wf => {
                    const w = cfg.workflows![wf]
                    newWfs[wf] = { ...w, edges: w.edges.filter(ed => ed.from !== nodeId && ed.to !== nodeId) }
                  })
                  return { ...prev, config: { ...cfg, steps, workflows: newWfs } }
                })
              }}  
              onUpdateEdge={(edgeId, updates) => {
                const wfName = appState.ui.viewMode === 'tabs' ? currentTab?.workflowName : appState.activeWorkflow
                if (!wfName) return

                // Update config edge (match by source/target)
                setAppState(prev => {
                  const cfg = { ...prev.config }
                  const wf = cfg.workflows?.[wfName]
                  if (!wf) return prev
                  const tabEdge = (appState.ui.viewMode === 'tabs' && currentTab)
                    ? currentTab.edges.find(e => e.id === edgeId)
                    : undefined
                  if (!tabEdge) return prev
                  const updatedEdges = wf.edges.map(ed => {
                    if (ed.from === tabEdge.source && ed.to === tabEdge.target) {
                      return {
                        ...ed,
                        guard: (updates as any).guard ?? ed.guard,
                        condition: (updates as any).condition ?? ed.condition,
                        onFailure: (updates as any).onFailure ?? ed.onFailure,
                      }
                    }
                    return ed
                  })
                  return {
                    ...prev,
                    config: { ...cfg, workflows: { ...cfg.workflows, [wfName]: { ...wf, edges: updatedEdges } } },
                  }
                })

                // Update tab edge visual props (label/class) and manage alternative failure edge
                if (appState.ui.viewMode === 'tabs' && currentTab) {
                  const tabEdge = currentTab.edges.find(e => e.id === edgeId)
                  if (!tabEdge) return
                  const newOnFailure = (updates as any).onFailure ?? (tabEdge.data as any)?.onFailure
                  const newGuard = (updates as any).guard

                  let newEdges = currentTab.edges.map(e => {
                    if (e.id !== edgeId) return e
                    const newData = { ...(e.data as any), ...updates }
                    let cls = 'edge-main'
                    if ((newData as any).kind === 'terminal') cls = 'edge-terminal'
                    if (newOnFailure?.strategy === 'ALTERNATIVE' && newOnFailure.alternativeTarget) {
                      cls = 'edge-has-alternative'
                    }
                    return {
                      ...e,
                      data: newData,
                      label: newGuard !== undefined ? (newGuard ? `[${newGuard}]` : undefined) : e.label,
                      className: cls,
                    }
                  })

                  // Handle ALTERNATIVE failure edge visualization
                  const altTarget = newOnFailure?.strategy === 'ALTERNATIVE' ? newOnFailure.alternativeTarget : undefined
                  // Remove old failure edges from this source if strategy changed away from ALTERNATIVE
                  if (!altTarget) {
                    newEdges = newEdges.filter(e => !(e.source === tabEdge.source && e.className?.includes('edge-failure')))
                  } else {
                    const existsAlt = newEdges.some(e => e.source === tabEdge.source && e.target === altTarget && e.className?.includes('edge-failure'))
                    if (!existsAlt) {
                      newEdges = [
                        ...newEdges,
                        {
                          id: `${tabEdge.source}-${altTarget}-failure-${Date.now()}`,
                          source: tabEdge.source,
                          target: altTarget,
                          type: 'default',
                          label: 'ON FAILURE',
                          className: 'edge-failure edge-alternative-failure',
                          markerEnd: { type: MarkerType.ArrowClosed },
                          data: { id: `${tabEdge.source}-${altTarget}-failure`, label: 'ON FAILURE' } as EdgeData,
                        } as Edge,
                      ]
                    }
                  }

                  updateTabState({ edges: newEdges })
                }
              }}
              onDeleteEdge={(edgeId) => {
                // Remove from tab
                if (appState.ui.viewMode === 'tabs' && currentTab) {
                  const tabEdge = currentTab.edges.find(e => e.id === edgeId)
                  updateTabState({ edges: currentTab.edges.filter(e => e.id !== edgeId) })
                  // Remove from config
                  if (tabEdge) {
                    const wfName = currentTab.workflowName
                    setAppState(prev => {
                      const cfg = { ...prev.config }
                      const wf = cfg.workflows?.[wfName]
                      if (!wf) return prev
                      const filtered = wf.edges.filter(ed => !(ed.from === tabEdge.source && ed.to === tabEdge.target))
                      return { ...prev, config: { ...cfg, workflows: { ...cfg.workflows, [wfName]: { ...wf, edges: filtered } } } }
                    })
                  }
                }
              }}
              onCloneNode={(nodeId) => {
                if (!(appState.ui.viewMode === 'tabs' && currentTab)) return
                const orig = currentTab.nodes.find(n => n.id === nodeId)
                if (!orig) return
                const newId = generateId(nodeId)
                const newNode: Node = {
                  ...orig,
                  id: newId,
                  position: { x: orig.position.x + 40, y: orig.position.y + 40 },
                  data: { ...(orig.data as any), id: newId, label: `${(orig.data as any).label || nodeId}-copy`, onEdit: (id: string) => openPropertiesForNode(id) }
                }
                updateTabState({ nodes: [...currentTab.nodes, newNode] })
                // Add to config as a new step copying type/config/guards/retry
                setAppState(prev => {
                  const cfg = { ...prev.config }
                  const base = cfg.steps?.[nodeId]
                  if (base) {
                    cfg.steps = { ...(cfg.steps || {}), [newId]: { ...base } }
                  }
                  return { ...prev, config: cfg }
                })
              }}
              onValidateNode={(nodeId) => validateNode(nodeId)}
              embedded
              components={appState.components}
            />
          </div>
        )}
            
            {activeTab === 'workflow' && (
              <div className="h-full overflow-auto">
                <WorkflowManager
                  config={appState.config}
                  activeWorkflow={appState.ui.viewMode === 'single' ? appState.activeWorkflow : currentTab?.workflowName}
                  onConfigChange={(newConfig) => setAppState(prev => ({ ...prev, config: newConfig }))}
                  onActiveWorkflowChange={handleActiveWorkflowChange}
                  embedded
                />
              </div>
            )}
            
            {activeTab === 'configuration' && (
              <div className="h-full overflow-auto">
                <ConfigurationSidebar
                  config={appState.config}
                  onConfigChange={(newConfig) => setAppState(prev => ({ ...prev, config: newConfig }))}
                  embedded
                  onAddStep={() => setShowQuickAddDialog(true)}
                />
              </div>
            )}
          </div>
        </div>
        </>
        )}
        
      </div>

      {/* Codegen Dialog */}
      <div className={`fixed inset-0 z-50 ${showCodegen ? '' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowCodegen(false)} />
        <div className="relative max-w-lg w-full mx-auto mt-24 bg-card border border-border rounded-lg shadow-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Generate Code</div>
            <button className="p-1 hover:bg-muted rounded" onClick={() => setShowCodegen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          {codegenError && (
            <div className="mb-3 p-2 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {codegenError}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs block mb-1">Project Name</label>
              <input
                value={codegenProjectName}
                onChange={(e) => setCodegenProjectName(e.target.value)}
                className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                placeholder="stepflow-project"
              />
            </div>
            <div>
              <label className="text-xs block mb-1">Base Package</label>
              <input
                value={codegenBasePackage}
                onChange={(e) => setCodegenBasePackage(e.target.value)}
                className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                placeholder="com.example.stepflow"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={codegenIncludeJava} onChange={(e) => setCodegenIncludeJava(e.target.checked)} />
                Java zip
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-border">
            <button className="px-3 h-8 rounded border bg-background hover:bg-accent" onClick={() => setShowCodegen(false)}>Cancel</button>
            <button
              className="px-3 h-8 rounded bg-primary text-primary-foreground hover:opacity-90"
              onClick={handleGenerateCode}
            >
              Download
            </button>
          </div>
        </div>
      </div>
      
      {/* Quick Add Dialog */}
      <QuickAddStepDialog
        open={showQuickAddDialog}
        onOpenChange={setShowQuickAddDialog}
        onAddStep={handleQuickAddStep}
        config={appState.config}
      />
      
      {/* Collaboration Features */}
      {collaborationEnabled && (
        <>
          <CollaborationPanel collaborationManager={collaborationManager} />
          {collaborators.map((collaborator: any) => (
            collaborator.cursor ? (
              <CollaboratorCursor
                key={collaborator.id}
                collaborator={collaborator}
                position={collaborator.cursor}
              />
            ) : null
          ))}
        </>
      )}

      {/* Issues Panel */}
      <IssuesPanel
        open={showIssuesPanel}
        onOpenChange={setShowIssuesPanel}
        stepIssues={validationResults}
        workflowIssues={workflowIssues}
      />
    </div>
  )
}

export default StepFlowBuilderAppV4
