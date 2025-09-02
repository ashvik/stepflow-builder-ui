import YAML from 'yaml'
import { FlowConfig, WorkflowFormat, StepDef, RequestDef, EdgeDef, YamlFormat } from '../types/stepflow'

export class YamlConverter {
  
  static parseYaml(yamlString: string): FlowConfig | WorkflowFormat {
    try {
      const parsed = YAML.parse(yamlString)
      
      // Detect format by checking for 'workflows' vs 'steps'/'requests'
      if (parsed.workflows) {
        return parsed as WorkflowFormat
      } else if (parsed.steps || parsed.requests) {
        return parsed as FlowConfig
      } else {
        throw new Error('Invalid YAML format: missing workflows, steps, or requests section')
      }
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static workflowToFlowConfig(workflow: WorkflowFormat): FlowConfig {
    const flowConfig: FlowConfig = {
      steps: {},
      requests: {}
    }

    // Process defaults into steps
    if (workflow.defaults) {
      Object.entries(workflow.defaults).forEach(([stepName, config]) => {
        flowConfig.steps[stepName] = {
          type: stepName,
          config
        }
      })
    }

    // Process workflows into requests
    if (workflow.workflows) {
      Object.entries(workflow.workflows).forEach(([workflowName, workflowDef]) => {
        let steps: any[]
        
        if (Array.isArray(workflowDef)) {
          steps = workflowDef
        } else if (workflowDef.steps && Array.isArray(workflowDef.steps)) {
          steps = workflowDef.steps
        } else {
          throw new Error(`Invalid workflow format for ${workflowName}`)
        }

        if (steps.length === 0) return

        // Create step definitions
        steps.forEach((step, index) => {
          let stepName: string
          let stepConfig: any = {}

          if (typeof step === 'string') {
            stepName = step
          } else if (typeof step === 'object') {
            stepName = Object.keys(step)[0]
            stepConfig = step[stepName] || {}
          } else {
            throw new Error(`Invalid step format at index ${index} in workflow ${workflowName}`)
          }

          if (!flowConfig.steps[stepName]) {
            flowConfig.steps[stepName] = {
              type: stepName,
              config: stepConfig
            }
          }
        })

        // Create edges for linear workflow
        const edges: EdgeDef[] = []
        let rootStep: string = ''

        steps.forEach((step, index) => {
          let stepName: string
          let stepConfig: any = {}

          if (typeof step === 'string') {
            stepName = step
          } else {
            stepName = Object.keys(step)[0]
            stepConfig = step[stepName] || {}
          }

          if (index === 0) {
            rootStep = stepName
          }

          if (index < steps.length - 1) {
            const nextStep = typeof steps[index + 1] === 'string' 
              ? steps[index + 1] 
              : Object.keys(steps[index + 1])[0]
            
            edges.push({
              from: stepName,
              to: nextStep
            })

            // Handle retry logic
            if (stepConfig.retry && stepConfig.retry > 0) {
              edges.push({
                from: stepName,
                to: stepName,
                policy: {
                  maxIterations: stepConfig.retry,
                  delayMs: stepConfig.delay_ms || stepConfig.delayMs,
                  whileGuard: stepConfig.retry_guard || stepConfig.retryGuard
                }
              })
            }
          } // Do not auto-append terminal SUCCESS edge for the last step
        })

        flowConfig.requests[workflowName] = {
          root: rootStep,
          edges
        }
      })
    }

    return flowConfig
  }

  static flowConfigToYaml(flowConfig: FlowConfig, format: YamlFormat = 'TRADITIONAL'): string {
    if (format === 'WORKFLOW') {
      return this.flowConfigToWorkflowYaml(flowConfig)
    } else {
      return this.flowConfigToTraditionalYaml(flowConfig)
    }
  }

  private static flowConfigToTraditionalYaml(flowConfig: FlowConfig): string {
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

    return YAML.stringify(yamlObj, { indent: 2 })
  }

  private static flowConfigToWorkflowYaml(flowConfig: FlowConfig): string {
    // Build workflow format without global defaults; inline config per step for clarity
    const workflowFormat: WorkflowFormat = {
      workflows: {},
    }

    // Convert requests to workflows (simplified linear only)
    if (flowConfig.requests) {
      Object.entries(flowConfig.requests).forEach(([name, request]) => {
        try {
          const stepSequence = this.requestToWorkflowSteps(request, flowConfig.steps)
          workflowFormat.workflows[name] = stepSequence
        } catch (error) {
          // If conversion fails, skip this workflow
          console.warn(`Skipping workflow ${name}: ${error}`)
        }
      })
    }

    return YAML.stringify(workflowFormat, { indent: 2 })
  }

  private static requestToWorkflowSteps(
    request: RequestDef,
    steps: Record<string, StepDef>
  ): (string | Record<string, any>)[] {
    if (!request.edges || request.edges.length === 0) {
      // Gracefully handle single-step workflows by emitting the root step type/name
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
      const inner: any = {}
      if (stepDef?.guard) inner.guard = stepDef.guard
      if (stepDef?.config && Object.keys(stepDef.config).length > 0) {
        // Inline config keys directly under the step entry (Workflow style)
        Object.assign(inner, stepDef.config)
      }

      if (Object.keys(inner).length > 0) {
        sequence.push({ [stepType]: inner })
      } else {
        sequence.push(stepType)
      }

      // Next step (only simple linear flow supported)
      let nextStep: string | null = null
      let edgeCount = 0
      for (const edge of request.edges) {
        if (edge.from === currentStep) {
          // Ignore retry/policy self-loops for linear workflow detection
          if (edge.policy) {
            continue
          }
          edgeCount++
          if (!edge.guard && edge.kind !== 'terminal') {
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

  private static requestToStepSequence(request: RequestDef, steps: Record<string, StepDef>): string[] {
    if (!request.edges || request.edges.length === 0) {
      throw new Error('No edges defined')
    }

    const sequence: string[] = []
    let currentStep = request.root
    const visited = new Set<string>()

    while (currentStep && currentStep !== 'SUCCESS' && currentStep !== 'FAILED') {
      if (visited.has(currentStep)) {
        throw new Error('Complex workflow with loops detected')
      }
      
      visited.add(currentStep)
      
      // Use step names for WORKFLOW format sequences
      sequence.push(currentStep)

      // Find next step (only simple linear flow supported)
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
}
