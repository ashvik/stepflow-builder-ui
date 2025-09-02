// StepFlow Core Configuration Types - Aligned with stepflow-core specification

// ===== Core StepFlow Configuration Types =====

/** Step definition matching stepflow-core StepDef */
export interface StepDef {
  /** Component type - annotation name, class name, lowerCamel, or FQCN */
  type: string
  /** Step configuration injected into fields/methods */
  config?: Record<string, any>
  /** Step-level guards (all must pass - AND logic) */
  guards?: string[]
  /** Engine-driven retry policy */
  retry?: RetryPolicy
}

/** Engine-driven retry configuration */
export interface RetryPolicy {
  /** Number of attempts (>=1) */
  maxAttempts: number
  /** Delay between attempts in milliseconds */
  delay: number
  /** Guard to decide whether to retry after failure */
  guard?: string
}

/** Edge guard failure handling strategies */
export type EdgeFailureStrategy = 'STOP' | 'SKIP' | 'ALTERNATIVE' | 'RETRY' | 'CONTINUE'

/** Workflow edge definition */
export interface EdgeDef {
  /** Source step name */
  from: string
  /** Target step name or terminal (SUCCESS/FAILURE) */
  to: string
  /** Edge-level guard (must pass to take transition) */
  guard?: string
  /** Edge condition (placeholder, not evaluated by engine) */
  condition?: string
  /** Edge kind - "terminal" for ROOT→SUCCESS edges */
  kind?: string
  /** What to do if guard fails */
  onFailure?: {
    strategy: EdgeFailureStrategy
    /** Alternative step to go to (for ALTERNATIVE strategy) */
    alternativeTarget?: string
    /** Number of retry attempts (for RETRY strategy) */
    retryAttempts?: number
    /** Delay between retries in ms (for RETRY strategy) */
    retryDelay?: number
  }
}

/** Workflow definition */
export interface WorkflowDef {
  /** Starting step name */
  root: string
  /** Edges in declaration order */
  edges: EdgeDef[]
}

/** Complete stepflow-core configuration */
export interface StepFlowConfig {
  /** Global key/values for @ConfigValue(globalPath) */
  settings?: Record<string, any>
  /** Default configurations that auto-merge */
  defaults?: {
    /** Defaults for all steps */
    step?: Record<string, any>
    /** Defaults for all guards */
    guard?: Record<string, any>
    /** Name-specific defaults (step name or guard type) */
    [name: string]: Record<string, any> | undefined
  }
  /** Step definitions */
  steps?: Record<string, StepDef>
  /** Workflow definitions */
  workflows?: Record<string, WorkflowDef>
}

// ===== Legacy Types for Backwards Compatibility =====

export interface LoopPolicy {
  maxIterations?: number
  delayMs?: number
  whileGuard?: string
}

export interface RequestDef {
  root: string
  edges: EdgeDef[]
}

export interface FlowConfig {
  steps: Record<string, StepDef>
  requests: Record<string, RequestDef>
}

// ===== UI-Specific Types =====

export type YamlFormat = 'TRADITIONAL' | 'WORKFLOW'

/** Node data for step components */
export interface StepNodeData {
  id: string
  label: string
  /** Step type - component class identifier */
  type: string
  /** Step configuration */
  config?: Record<string, any>
  /** Step-level guards */
  guards?: string[]
  /** Retry policy configuration */
  retry?: RetryPolicy
  /** Whether this is a root step */
  isRoot?: boolean
  /** Whether this is a terminal step (SUCCESS/FAILURE) */
  isTerminal?: boolean
  /** Edit callback */
  onEdit?: (id: string) => void
  /** Associated workflow */
  workflow?: string
  /** Validation issues */
  issues?: ValidationIssue[]
}

/** Node data for guard components (when guards are defined as steps) */
export interface GuardNodeData {
  id: string
  label: string
  /** Guard type - component class identifier */
  type: string
  /** Guard configuration */
  config?: Record<string, any>
  /** Edit callback */
  onEdit?: (id: string) => void
  /** Associated workflow */
  workflow?: string
  /** Validation issues */
  issues?: ValidationIssue[]
}

/** Edge data for workflow connections */
export interface EdgeData {
  id: string
  /** Edge label */
  label?: string
  /** Edge-level guard */
  guard?: string
  /** Edge condition */
  condition?: string
  /** Edge classification */
  kind?: 'terminal' | 'normal'
  /** What to do if guard fails */
  onFailure?: {
    strategy: EdgeFailureStrategy
    /** Alternative step to go to (for ALTERNATIVE strategy) */
    alternativeTarget?: string
    /** Number of retry attempts (for RETRY strategy) */
    retryAttempts?: number
    /** Delay between retries in ms (for RETRY strategy) */
    retryDelay?: number
  }
}

/** Validation issue */
export interface ValidationIssue {
  /** Issue type */
  type: 'error' | 'warning' | 'info'
  /** Issue message */
  message: string
  /** Issue location */
  location?: string
}

/** Component discovery information */
export interface ComponentInfo {
  /** Component name/identifier */
  name: string
  /** Component type */
  type: 'step' | 'guard'
  /** Simple class name */
  className?: string
  /** Package name */
  package?: string
  /** Configuration schema */
  schema?: Record<string, any>
}

/** Application state */
export interface AppState {
  /** Current configuration */
  config: StepFlowConfig
  /** Active workflow */
  activeWorkflow?: string
  /** Available components */
  components: ComponentInfo[]
  /** Scan packages for component discovery */
  scanPackages: string[]
  /** UI state */
  ui: {
    /** Selected nodes */
    selectedNodes: string[]
    /** Selected edges */
    selectedEdges: string[]
    /** Panel visibility */
    panels: {
      navigator: boolean
      properties: boolean
      console: boolean
    }
  }
}