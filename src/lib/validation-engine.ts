import { Node, Edge } from 'reactflow'
import { StepNodeData, GuardNodeData } from '../types/stepflow'

export interface ValidationIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  category: 'structure' | 'configuration' | 'logic' | 'performance'
  title: string
  description: string
  nodeId?: string
  edgeId?: string
  suggestion?: string
  autoFix?: () => void
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  score: number // 0-100, quality score
}

export class WorkflowValidationEngine {
  
  static validateWorkflow(nodes: Node[], edges: Edge[], activeRequest?: string): ValidationResult {
    const issues: ValidationIssue[] = []
    
    // Run all validation checks
    issues.push(...this.validateStructure(nodes, edges))
    issues.push(...this.validateConfiguration(nodes, edges))
    issues.push(...this.validateLogic(nodes, edges))
    issues.push(...this.validatePerformance(nodes, edges))
    
    const errors = issues.filter(i => i.type === 'error')
    const warnings = issues.filter(i => i.type === 'warning')
    
    // Calculate quality score
    const score = Math.max(0, 100 - (errors.length * 15) - (warnings.length * 5))
    
    return {
      isValid: errors.length === 0,
      issues,
      score
    }
  }
  
  private static validateStructure(nodes: Node[], edges: Edge[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    
    // Check for root step
    const rootSteps = nodes.filter(n => n.type === 'step' && (n.data as StepNodeData).isRoot)
    if (rootSteps.length === 0) {
      issues.push({
        id: 'no-root-step',
        type: 'error',
        category: 'structure',
        title: 'No Root Step',
        description: 'Workflow must have exactly one root step to define the starting point',
        suggestion: 'Mark a step as root by selecting it and clicking the "Root Step" button'
      })
    } else if (rootSteps.length > 1) {
      issues.push({
        id: 'multiple-root-steps',
        type: 'error',
        category: 'structure',
        title: 'Multiple Root Steps',
        description: `Found ${rootSteps.length} root steps. Only one root step is allowed per workflow`,
        suggestion: 'Keep only one root step and unmark the others'
      })
    }
    
    // Check for orphaned nodes (no incoming or outgoing edges)
    const connectedNodes = new Set<string>()
    edges.forEach(edge => {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    })
    
    nodes.forEach(node => {
      if (node.type === 'step' && !(node.data as StepNodeData).isRoot && !connectedNodes.has(node.id)) {
        issues.push({
          id: `orphaned-node-${node.id}`,
          type: 'warning',
          category: 'structure',
          title: 'Orphaned Node',
          description: `Node "${(node.data as StepNodeData).label || node.id}" has no connections`,
          nodeId: node.id,
          suggestion: 'Connect this node to the workflow or remove it if unnecessary'
        })
      }
    })
    
    // Check for unreachable nodes
    const reachableNodes = this.getReachableNodes(nodes, edges)
    nodes.forEach(node => {
      if (node.type === 'step' && !(node.data as StepNodeData).isRoot && !reachableNodes.has(node.id)) {
        issues.push({
          id: `unreachable-node-${node.id}`,
          type: 'warning',
          category: 'structure',
          title: 'Unreachable Node',
          description: `Node "${(node.data as StepNodeData).label || node.id}" cannot be reached from root`,
          nodeId: node.id,
          suggestion: 'Connect this node to a path from the root step'
        })
      }
    })
    
    // Check for cycles
    const cycles = this.detectCycles(nodes, edges)
    cycles.forEach(cycle => {
      issues.push({
        id: `cycle-${cycle.join('-')}`,
        type: 'warning',
        category: 'logic',
        title: 'Potential Infinite Loop',
        description: `Cycle detected: ${cycle.map(id => {
          const node = nodes.find(n => n.id === id)
          return (node?.data as any)?.label || id
        }).join(' → ')}`,
        suggestion: 'Add guards or terminal conditions to prevent infinite loops'
      })
    })
    
    return issues
  }
  
  private static validateConfiguration(nodes: Node[], edges: Edge[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    
    nodes.forEach(node => {
      if (node.type === 'step') {
        const stepData = node.data as StepNodeData
        
        // Check for empty step type
        if (!stepData.type || stepData.type.trim() === '') {
          issues.push({
            id: `empty-step-type-${node.id}`,
            type: 'error',
            category: 'configuration',
            title: 'Empty Step Type',
            description: `Step "${stepData.label || node.id}" has no type specified`,
            nodeId: node.id,
            suggestion: 'Specify a step type (e.g., "ValidateOrderStep")'
          })
        }
        
        // Check for invalid JSON config
        if (stepData.config) {
          try {
            JSON.stringify(stepData.config)
          } catch (error) {
            issues.push({
              id: `invalid-config-${node.id}`,
              type: 'error',
              category: 'configuration',
              title: 'Invalid Configuration',
              description: `Step "${stepData.label || node.id}" has invalid JSON configuration`,
              nodeId: node.id,
              suggestion: 'Fix the JSON syntax in the configuration'
            })
          }
        }
        
        // Check retry configuration
        if (stepData.retryCount && stepData.retryCount > 0) {
          if (stepData.retryCount > 10) {
            issues.push({
              id: `high-retry-count-${node.id}`,
              type: 'warning',
              category: 'performance',
              title: 'High Retry Count',
              description: `Step "${stepData.label || node.id}" has ${stepData.retryCount} retries`,
              nodeId: node.id,
              suggestion: 'Consider reducing retry count to avoid long delays'
            })
          }
          
          if (!stepData.retryGuard) {
            issues.push({
              id: `retry-without-guard-${node.id}`,
              type: 'info',
              category: 'configuration',
              title: 'Retry Without Guard',
              description: `Step "${stepData.label || node.id}" has retries but no retry guard`,
              nodeId: node.id,
              suggestion: 'Consider adding a retry guard to control when retries should happen'
            })
          }
        }
        
      } else if (node.type === 'guard') {
        const guardData = node.data as GuardNodeData
        
        // Check for empty condition
        if (!guardData.condition || guardData.condition.trim() === '') {
          issues.push({
            id: `empty-guard-condition-${node.id}`,
            type: 'error',
            category: 'configuration',
            title: 'Empty Guard Condition',
            description: `Guard "${guardData.label || node.id}" has no condition specified`,
            nodeId: node.id,
            suggestion: 'Specify a guard condition class name'
          })
        }
      }
    })
    
    return issues
  }
  
  private static validateLogic(nodes: Node[], edges: Edge[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    
    // Check guard nodes for proper branching
    const guardNodes = nodes.filter(n => n.type === 'guard')
    guardNodes.forEach(guardNode => {
      const outgoingEdges = edges.filter(e => e.source === guardNode.id)
      const successEdges = outgoingEdges.filter(e => 
        e.className?.includes('edge-guard-success') || 
        (typeof e.label === 'string' && e.label.toUpperCase().includes('TRUE'))
      )
      const failureEdges = outgoingEdges.filter(e => 
        e.className?.includes('edge-guard-failure') || 
        (typeof e.label === 'string' && e.label.toUpperCase().includes('FALSE'))
      )
      
      if (successEdges.length === 0) {
        issues.push({
          id: `guard-missing-success-${guardNode.id}`,
          type: 'error',
          category: 'logic',
          title: 'Missing Success Branch',
          description: `Guard "${(guardNode.data as GuardNodeData).label || guardNode.id}" has no TRUE branch`,
          nodeId: guardNode.id,
          suggestion: 'Connect the green handle to define the success path'
        })
      }
      
      if (failureEdges.length === 0) {
        issues.push({
          id: `guard-missing-failure-${guardNode.id}`,
          type: 'error',
          category: 'logic',
          title: 'Missing Failure Branch',
          description: `Guard "${(guardNode.data as GuardNodeData).label || guardNode.id}" has no FALSE branch`,
          nodeId: guardNode.id,
          suggestion: 'Connect the red handle to define the failure path'
        })
      }
      
      if (successEdges.length > 1) {
        issues.push({
          id: `guard-multiple-success-${guardNode.id}`,
          type: 'warning',
          category: 'logic',
          title: 'Multiple Success Branches',
          description: `Guard "${(guardNode.data as GuardNodeData).label || guardNode.id}" has ${successEdges.length} TRUE branches`,
          nodeId: guardNode.id,
          suggestion: 'Consider using only one success branch for clarity'
        })
      }
    })
    
    // Check for terminal paths
    const terminalSteps = nodes.filter(n => n.type === 'step' && (n.data as StepNodeData).isTerminal)
    if (terminalSteps.length === 0) {
      const stepNodes = nodes.filter(n => n.type === 'step')
      const nodesWithoutOutgoing = stepNodes.filter(node => 
        !edges.some(e => e.source === node.id)
      )
      
      if (nodesWithoutOutgoing.length === 0) {
        issues.push({
          id: 'no-terminal-path',
          type: 'warning',
          category: 'logic',
          title: 'No Terminal Path',
          description: 'Workflow has no clear termination points',
          suggestion: 'Mark final steps as terminal or ensure paths lead to SUCCESS/FAILED'
        })
      }
    }
    
    return issues
  }
  
  private static validatePerformance(nodes: Node[], edges: Edge[]): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    
    // Check workflow complexity
    const complexity = this.calculateComplexity(nodes, edges)
    if (complexity.depth > 10) {
      issues.push({
        id: 'high-depth',
        type: 'info',
        category: 'performance',
        title: 'Deep Workflow',
        description: `Workflow has ${complexity.depth} levels deep`,
        suggestion: 'Consider breaking into smaller sub-workflows for better maintainability'
      })
    }
    
    if (complexity.branches > 20) {
      issues.push({
        id: 'high-branching',
        type: 'info',
        category: 'performance',
        title: 'Highly Branched Workflow',
        description: `Workflow has ${complexity.branches} decision points`,
        suggestion: 'Consider simplifying logic or using lookup tables'
      })
    }
    
    // Check for unused configurations
    nodes.forEach(node => {
      if (node.type === 'step') {
        const stepData = node.data as StepNodeData
        if (stepData.config && Object.keys(stepData.config).length > 10) {
          issues.push({
            id: `complex-config-${node.id}`,
            type: 'info',
            category: 'performance',
            title: 'Complex Configuration',
            description: `Step "${stepData.label || node.id}" has ${Object.keys(stepData.config).length} config properties`,
            nodeId: node.id,
            suggestion: 'Consider moving complex configuration to external files'
          })
        }
      }
    })
    
    return issues
  }
  
  private static getReachableNodes(nodes: Node[], edges: Edge[]): Set<string> {
    const reachable = new Set<string>()
    const rootSteps = nodes.filter(n => n.type === 'step' && (n.data as StepNodeData).isRoot)
    
    if (rootSteps.length === 0) return reachable
    
    const queue = [rootSteps[0].id]
    reachable.add(rootSteps[0].id)
    
    while (queue.length > 0) {
      const current = queue.shift()!
      const outgoingEdges = edges.filter(e => e.source === current)
      
      outgoingEdges.forEach(edge => {
        if (!reachable.has(edge.target)) {
          reachable.add(edge.target)
          queue.push(edge.target)
        }
      })
    }
    
    return reachable
  }
  
  private static detectCycles(nodes: Node[], edges: Edge[]): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []
    
    const nodeIds = nodes.map(n => n.id)
    
    const dfs = (nodeId: string) => {
      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)
      
      const outgoingEdges = edges.filter(e => e.source === nodeId)
      
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          dfs(edge.target)
        } else if (recursionStack.has(edge.target)) {
          // Found a cycle
          const cycleStart = path.indexOf(edge.target)
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), edge.target])
          }
        }
      }
      
      recursionStack.delete(nodeId)
      path.pop()
    }
    
    nodeIds.forEach(nodeId => {
      if (!visited.has(nodeId)) {
        dfs(nodeId)
      }
    })
    
    return cycles
  }
  
  private static calculateComplexity(nodes: Node[], edges: Edge[]): { depth: number, branches: number } {
    const guardNodes = nodes.filter(n => n.type === 'guard')
    const rootSteps = nodes.filter(n => n.type === 'step' && (n.data as StepNodeData).isRoot)
    
    if (rootSteps.length === 0) return { depth: 0, branches: 0 }
    
    // Calculate maximum depth using BFS
    let maxDepth = 0
    const queue: { nodeId: string, depth: number }[] = [{ nodeId: rootSteps[0].id, depth: 0 }]
    const visited = new Set<string>()
    
    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!
      
      if (visited.has(nodeId)) continue
      visited.add(nodeId)
      
      maxDepth = Math.max(maxDepth, depth)
      
      const outgoingEdges = edges.filter(e => e.source === nodeId)
      outgoingEdges.forEach(edge => {
        queue.push({ nodeId: edge.target, depth: depth + 1 })
      })
    }
    
    return {
      depth: maxDepth,
      branches: guardNodes.length
    }
  }
  
  static getValidationSummary(result: ValidationResult): string {
    const { issues, score } = result
    const errors = issues.filter(i => i.type === 'error').length
    const warnings = issues.filter(i => i.type === 'warning').length
    const infos = issues.filter(i => i.type === 'info').length
    
    if (errors > 0) {
      return `${errors} error${errors > 1 ? 's' : ''}, ${warnings} warning${warnings > 1 ? 's' : ''}`
    } else if (warnings > 0) {
      return `${warnings} warning${warnings > 1 ? 's' : ''}, ${infos} suggestion${infos > 1 ? 's' : ''}`
    } else if (infos > 0) {
      return `${infos} suggestion${infos > 1 ? 's' : ''}`
    } else {
      return 'No issues found'
    }
  }
  
  static getScoreColor(score: number): string {
    if (score >= 90) return 'text-green-600 dark:text-green-400'
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 50) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }
}