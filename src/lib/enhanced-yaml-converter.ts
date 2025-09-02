import YAML from 'yaml'
import { FlowConfig, WorkflowFormat, StepDef, RequestDef, EdgeDef, YamlFormat } from '../types/stepflow'

export interface ConversionValidation {
  isValid: boolean
  warnings: string[]
  errors: string[]
  suggestions: string[]
  compatibility: {
    workflowFormat: boolean
    traditionalFormat: boolean
    reason?: string
  }
}

export interface ConversionOptions {
  validateBeforeConvert?: boolean
  includeComments?: boolean
  preserveOrder?: boolean
  formatStyle?: 'compact' | 'expanded'
  errorHandling?: 'strict' | 'lenient'
}

export class EnhancedYamlConverter {
  
  static parseYamlWithValidation(yamlString: string, options: ConversionOptions = {}): {
    result?: FlowConfig | WorkflowFormat
    validation: ConversionValidation
  } {
    const validation: ConversionValidation = {
      isValid: true,
      warnings: [],
      errors: [],
      suggestions: [],
      compatibility: {
        workflowFormat: true,
        traditionalFormat: true
      }
    }
    
    try {
      // Parse YAML with better error handling
      const parsed = YAML.parse(yamlString, {
        prettyErrors: true,
        lineCounter: true
      })
      
      if (!parsed || typeof parsed !== 'object') {
        validation.errors.push('Invalid YAML structure: expected object')
        validation.isValid = false
        return { validation }
      }
      
      // Validate structure
      const structureValidation = this.validateYamlStructure(parsed)
      validation.warnings.push(...structureValidation.warnings)
      validation.errors.push(...structureValidation.errors)
      validation.suggestions.push(...structureValidation.suggestions)
      
      if (structureValidation.errors.length > 0) {
        validation.isValid = false
        return { validation }
      }
      
      // Determine format and convert
      let result: FlowConfig | WorkflowFormat
      
      if (parsed.workflows) {
        result = parsed as WorkflowFormat
        validation.compatibility.traditionalFormat = this.canConvertToTraditional(result)
        
        if (!validation.compatibility.traditionalFormat) {
          validation.compatibility.reason = 'Complex workflow features not supported in traditional format'
        }
      } else if (parsed.steps || parsed.requests) {
        result = parsed as FlowConfig
        validation.compatibility.workflowFormat = this.canConvertToWorkflow(result)
        
        if (!validation.compatibility.workflowFormat) {
          validation.compatibility.reason = 'Complex branching not supported in workflow format'
        }
      } else {
        validation.errors.push('Invalid YAML format: missing workflows, steps, or requests section')
        validation.isValid = false
        return { validation }
      }
      
      return { result, validation }
      
    } catch (error) {
      let errorMessage = 'Failed to parse YAML'
      
      if (error instanceof Error) {
        // Enhanced error messages for common issues
        if (error.message.includes('tab character')) {
          errorMessage = 'Invalid indentation: use spaces instead of tabs'
        } else if (error.message.includes('expected')) {
          errorMessage = `Syntax error: ${error.message}`
        } else if (error.message.includes('duplicate key')) {
          errorMessage = `Duplicate key found: ${error.message}`
        } else {
          errorMessage = error.message
        }
      }
      
      validation.errors.push(errorMessage)
      validation.isValid = false
      return { validation }
    }
  }
  
  static flowConfigToYamlWithValidation(
    flowConfig: FlowConfig, 
    format: YamlFormat = 'TRADITIONAL',
    options: ConversionOptions = {}
  ): {
    yaml?: string
    validation: ConversionValidation
  } {
    const validation: ConversionValidation = {
      isValid: true,
      warnings: [],
      errors: [],
      suggestions: [],
      compatibility: {
        workflowFormat: true,
        traditionalFormat: true
      }
    }
    
    try {
      // Validate FlowConfig before conversion
      if (options.validateBeforeConvert !== false) {
        const configValidation = this.validateFlowConfig(flowConfig)
        validation.warnings.push(...configValidation.warnings)
        validation.errors.push(...configValidation.errors)
        validation.suggestions.push(...configValidation.suggestions)
        
        if (configValidation.errors.length > 0 && options.errorHandling === 'strict') {
          validation.isValid = false
          return { validation }
        }
      }
      
      // Check compatibility with target format
      if (format === 'WORKFLOW') {
        validation.compatibility.workflowFormat = this.canConvertToWorkflow(flowConfig)
        if (!validation.compatibility.workflowFormat) {
          validation.errors.push('Cannot convert to workflow format: complex branching detected')
          validation.isValid = false
          return { validation }
        }
      }
      
      // Convert based on format
      let yaml: string
      if (format === 'WORKFLOW') {
        yaml = this.flowConfigToWorkflowYaml(flowConfig, options)
      } else {
        yaml = this.flowConfigToTraditionalYaml(flowConfig, options)
      }
      
      // Add metadata comments if requested
      if (options.includeComments) {
        yaml = this.addMetadataComments(yaml, flowConfig, format)
      }
      
      return { yaml, validation }
      
    } catch (error) {
      validation.errors.push(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      validation.isValid = false
      return { validation }
    }
  }
  
  private static validateYamlStructure(parsed: any): Omit<ConversionValidation, 'isValid' | 'compatibility'> {
    const warnings: string[] = []
    const errors: string[] = []
    const suggestions: string[] = []
    
    if (parsed.workflows) {
      // Validate workflow format
      if (typeof parsed.workflows !== 'object') {
        errors.push('workflows section must be an object')
      } else {
        Object.entries(parsed.workflows).forEach(([name, workflow]) => {
          if (typeof workflow !== 'object' && !Array.isArray(workflow)) {
            errors.push(`Workflow "${name}" must be an object or array`)
          }
          
          if (Array.isArray(workflow)) {
            workflow.forEach((step, index) => {
              if (typeof step !== 'string' && typeof step !== 'object') {
                errors.push(`Step ${index} in workflow "${name}" must be a string or object`)
              }
            })
          }
        })
      }
      
      // Check for defaults section
      if (parsed.defaults && typeof parsed.defaults !== 'object') {
        errors.push('defaults section must be an object')
      }
      
    } else if (parsed.steps || parsed.requests) {
      // Validate traditional format
      if (parsed.steps && typeof parsed.steps !== 'object') {
        errors.push('steps section must be an object')
      }
      
      if (parsed.requests && typeof parsed.requests !== 'object') {
        errors.push('requests section must be an object')
      }
      
      // Validate step definitions
      if (parsed.steps) {
        Object.entries(parsed.steps).forEach(([name, step]: [string, any]) => {
          if (!step.type) {
            errors.push(`Step "${name}" is missing required "type" field`)
          }
          
          if (step.config && typeof step.config !== 'object') {
            warnings.push(`Step "${name}" config should be an object`)
          }
        })
      }
      
      // Validate request definitions
      if (parsed.requests) {
        Object.entries(parsed.requests).forEach(([name, request]: [string, any]) => {
          if (!request.root) {
            errors.push(`Request "${name}" is missing required "root" field`)
          }
          
          if (!request.edges || !Array.isArray(request.edges)) {
            errors.push(`Request "${name}" must have an "edges" array`)
          } else {
            request.edges.forEach((edge: any, index: number) => {
              if (!edge.from || !edge.to) {
                errors.push(`Edge ${index} in request "${name}" is missing "from" or "to" field`)
              }
            })
          }
        })
      }
    }
    
    // General structure suggestions
    if (Object.keys(parsed).length > 5) {
      suggestions.push('Consider organizing complex configurations using multiple files')
    }
    
    return { warnings, errors, suggestions }
  }
  
  private static validateFlowConfig(flowConfig: FlowConfig): Omit<ConversionValidation, 'isValid' | 'compatibility'> {
    const warnings: string[] = []
    const errors: string[] = []
    const suggestions: string[] = []
    
    // Validate steps
    const stepNames = Object.keys(flowConfig.steps || {})
    if (stepNames.length === 0) {
      warnings.push('No steps defined in workflow')
    }
    
    stepNames.forEach(stepName => {
      const step = flowConfig.steps[stepName]
      if (!step.type) {
        errors.push(`Step "${stepName}" missing type`)
      }
      
      // Check for common step type naming conventions
      if (step.type && !step.type.endsWith('Step') && !step.type.includes('step')) {
        suggestions.push(`Consider adding "Step" suffix to type "${step.type}" for clarity`)
      }
    })
    
    // Validate requests
    const requestNames = Object.keys(flowConfig.requests || {})
    if (requestNames.length === 0) {
      warnings.push('No requests defined in workflow')
    }
    
    requestNames.forEach(requestName => {
      const request = flowConfig.requests[requestName]
      
      // Check root step exists
      if (request.root && !flowConfig.steps[request.root]) {
        errors.push(`Request "${requestName}" references undefined root step "${request.root}"`)
      }
      
      // Validate edges
      request.edges.forEach((edge, index) => {
        // Check if referenced steps exist
        if (edge.from !== 'SUCCESS' && edge.from !== 'FAILED' && !flowConfig.steps[edge.from]) {
          errors.push(`Request "${requestName}" edge ${index} references undefined step "${edge.from}"`)
        }
        
        if (edge.to !== 'SUCCESS' && edge.to !== 'FAILED' && !flowConfig.steps[edge.to]) {
          errors.push(`Request "${requestName}" edge ${index} references undefined step "${edge.to}"`)
        }
        
        // Check for potential circular references
        if (edge.from === edge.to) {
          warnings.push(`Request "${requestName}" edge ${index} is self-referencing (${edge.from} → ${edge.to})`)
        }
      })
      
      // Check for unreachable steps
      const reachableSteps = new Set([request.root])
      const queue = [request.root]
      
      while (queue.length > 0) {
        const current = queue.shift()!
        request.edges.forEach(edge => {
          if (edge.from === current && edge.to !== 'SUCCESS' && edge.to !== 'FAILED') {
            if (!reachableSteps.has(edge.to)) {
              reachableSteps.add(edge.to)
              queue.push(edge.to)
            }
          }
        })
      }
      
      const allStepsInRequest = new Set<string>()
      request.edges.forEach(edge => {
        if (edge.from !== 'SUCCESS' && edge.from !== 'FAILED') allStepsInRequest.add(edge.from)
        if (edge.to !== 'SUCCESS' && edge.to !== 'FAILED') allStepsInRequest.add(edge.to)
      })
      
      allStepsInRequest.forEach(stepName => {
        if (!reachableSteps.has(stepName)) {
          warnings.push(`Step "${stepName}" in request "${requestName}" is not reachable from root`)
        }
      })
    })
    
    return { warnings, errors, suggestions }
  }
  
  private static canConvertToWorkflow(flowConfig: FlowConfig): boolean {
    // Check each request for workflow format compatibility
    return Object.values(flowConfig.requests).every(request => {
      // Must be linear flow (no branching)
      const stepCounts = new Map<string, number>()
      
      request.edges.forEach(edge => {
        const count = stepCounts.get(edge.from) || 0
        stepCounts.set(edge.from, count + 1)
      })
      
      // Check for steps with multiple outgoing edges (branching)
      const hasBranching = Array.from(stepCounts.values()).some(count => count > 1)
      
      // Check for complex edge conditions
      const hasComplexConditions = request.edges.some(edge => 
        edge.guard && edge.guard.includes('||') || 
        edge.guard && edge.guard.includes('&&') ||
        edge.policy && edge.policy.whileGuard
      )
      
      return !hasBranching && !hasComplexConditions
    })
  }
  
  private static canConvertToTraditional(workflowFormat: WorkflowFormat): boolean {
    // Workflow format can always be converted to traditional
    return true
  }
  
  private static flowConfigToTraditionalYaml(flowConfig: FlowConfig, options: ConversionOptions): string {
    const yamlObj: any = {}
    
    if (flowConfig.steps && Object.keys(flowConfig.steps).length > 0) {
      yamlObj.steps = {}
      Object.entries(flowConfig.steps).forEach(([name, step]) => {
        const stepObj: any = { type: step.type }
        if (step.guard) stepObj.guard = step.guard
        if (step.config && Object.keys(step.config).length > 0) {
          stepObj.config = step.config
        }
        yamlObj.steps[name] = stepObj
      })
    }
    
    if (flowConfig.requests && Object.keys(flowConfig.requests).length > 0) {
      yamlObj.requests = {}
      Object.entries(flowConfig.requests).forEach(([name, request]) => {
        const requestObj: any = { root: request.root }
        if (request.edges && request.edges.length > 0) {
          requestObj.edges = request.edges.map(edge => {
            const edgeObj: any = { from: edge.from, to: edge.to }
            if (edge.guard) edgeObj.guard = edge.guard
            if (edge.kind) edgeObj.kind = edge.kind
            if (edge.policy) edgeObj.policy = edge.policy
            return edgeObj
          })
        }
        yamlObj.requests[name] = requestObj
      })
    }
    
    const yamlOptions: YAML.ToStringOptions = {
      indent: options.formatStyle === 'compact' ? 1 : 2,
      lineWidth: options.formatStyle === 'compact' ? 120 : 80,
      minContentWidth: 0,
      doubleQuotedAsJSON: false
    }
    
    return YAML.stringify(yamlObj, yamlOptions)
  }
  
  private static flowConfigToWorkflowYaml(flowConfig: FlowConfig, options: ConversionOptions): string {
    const workflowFormat: WorkflowFormat = {
      workflows: {}
    }
    
    // Convert requests to workflows (linear sequences only)
    if (flowConfig.requests) {
      Object.entries(flowConfig.requests).forEach(([name, request]) => {
        try {
          const stepSequence = this.requestToWorkflowSteps(request, flowConfig.steps)
          workflowFormat.workflows[name] = stepSequence
        } catch (error) {
          // Skip complex workflows that can't be converted
          console.warn(`Skipping workflow ${name}: ${error}`)
        }
      })
    }
    
    const yamlOptions: YAML.ToStringOptions = {
      indent: options.formatStyle === 'compact' ? 1 : 2,
      lineWidth: options.formatStyle === 'compact' ? 120 : 80,
      minContentWidth: 0,
      doubleQuotedAsJSON: false
    }
    
    return YAML.stringify(workflowFormat, yamlOptions)
  }
  
  private static requestToWorkflowSteps(
    request: RequestDef,
    steps: Record<string, StepDef>
  ): (string | Record<string, any>)[] {
    if (!request.edges || request.edges.length === 0) {
      const stepDef = steps[request.root]
      const stepType = stepDef?.type || request.root
      return [stepType]
    }
    
    const sequence: (string | Record<string, any>)[] = []
    let currentStep = request.root
    const visited = new Set<string>()
    
    while (currentStep && currentStep !== 'SUCCESS' && currentStep !== 'FAILED') {
      if (visited.has(currentStep)) {
        throw new Error('Complex workflow with loops detected')
      }
      visited.add(currentStep)
      
      const stepDef = steps[currentStep]
      const stepType = stepDef?.type || currentStep
      const stepConfig: any = {}
      
      if (stepDef?.guard) stepConfig.guard = stepDef.guard
      if (stepDef?.config && Object.keys(stepDef.config).length > 0) {
        Object.assign(stepConfig, stepDef.config)
      }
      
      if (Object.keys(stepConfig).length > 0) {
        sequence.push({ [stepType]: stepConfig })
      } else {
        sequence.push(stepType)
      }
      
      // Find next step (linear flow only)
      let nextStep: string | null = null
      let edgeCount = 0
      
      for (const edge of request.edges) {
        if (edge.from === currentStep) {
          edgeCount++
          if (!edge.guard && !edge.policy && edge.kind !== 'terminal') {
            nextStep = edge.to
          } else if (edge.kind === 'terminal') {
            nextStep = null
            break
          }
        }
      }
      
      if (edgeCount > 1) {
        throw new Error('Complex conditional branching detected')
      }
      
      currentStep = nextStep
    }
    
    if (sequence.length === 0) {
      throw new Error('No valid step sequence found')
    }
    
    return sequence
  }
  
  private static addMetadataComments(yaml: string, flowConfig: FlowConfig, format: YamlFormat): string {
    const timestamp = new Date().toISOString()
    const stepCount = Object.keys(flowConfig.steps || {}).length
    const requestCount = Object.keys(flowConfig.requests || {}).length
    
    const header = [
      `# Generated by StepFlow Builder on ${timestamp}`,
      `# Format: ${format}`,
      `# Steps: ${stepCount}, Requests: ${requestCount}`,
      `# Validation: Passed`,
      ''
    ].join('\n')
    
    return header + yaml
  }
  
  static suggestOptimizations(flowConfig: FlowConfig): string[] {
    const suggestions: string[] = []
    
    // Check for common patterns that could be optimized
    const stepTypes = Object.values(flowConfig.steps).map(s => s.type)
    const typeFrequency = stepTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Suggest defaults for common step types
    const commonTypes = Object.entries(typeFrequency)
      .filter(([_, count]) => count > 3)
      .map(([type]) => type)
    
    if (commonTypes.length > 0) {
      suggestions.push(`Consider using defaults section for common step types: ${commonTypes.join(', ')}`)
    }
    
    // Check for complex configurations
    Object.entries(flowConfig.steps).forEach(([name, step]) => {
      if (step.config && Object.keys(step.config).length > 5) {
        suggestions.push(`Step "${name}" has complex configuration - consider extracting to external file`)
      }
    })
    
    // Check for duplicate edge patterns
    const edgePatterns = new Set<string>()
    const duplicatePatterns = new Set<string>()
    
    Object.values(flowConfig.requests).forEach(request => {
      request.edges.forEach(edge => {
        const pattern = `${edge.from}->${edge.to}${edge.guard ? `[${edge.guard}]` : ''}`
        if (edgePatterns.has(pattern)) {
          duplicatePatterns.add(pattern)
        } else {
          edgePatterns.add(pattern)
        }
      })
    })
    
    if (duplicatePatterns.size > 0) {
      suggestions.push('Duplicate edge patterns detected - consider creating reusable sub-workflows')
    }
    
    return suggestions
  }
}