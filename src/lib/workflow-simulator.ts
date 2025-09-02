import { Node, Edge } from 'reactflow'
import { StepNodeData, GuardNodeData, FlowConfig } from '../types/stepflow'

export interface ExecutionStep {
  nodeId: string
  stepName: string
  stepType: string
  timestamp: number
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  duration?: number
  input?: any
  output?: any
  error?: string
  retryAttempt?: number
}

export interface ExecutionTrace {
  id: string
  workflowName: string
  startTime: number
  endTime?: number
  status: 'running' | 'success' | 'failed' | 'paused'
  steps: ExecutionStep[]
  currentStepIndex: number
  context: Record<string, any>
}

export interface SimulationOptions {
  stepDelay?: number // ms between steps
  enableRetries?: boolean
  enableGuards?: boolean
  mockStepBehavior?: Record<string, 'success' | 'failure' | 'random'>
  maxExecutionTime?: number // ms
  breakpoints?: string[] // node IDs to pause at
}

export class WorkflowSimulator {
  private traces: Map<string, ExecutionTrace> = new Map()
  private isSimulating: boolean = false
  private currentTraceId: string | null = null
  private eventListeners: Map<string, ((trace: ExecutionTrace, step: ExecutionStep) => void)[]> = new Map()

  // Create a new execution trace
  createTrace(workflowName: string, nodes: Node[], edges: Edge[], options: SimulationOptions = {}): string {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const trace: ExecutionTrace = {
      id: traceId,
      workflowName,
      startTime: Date.now(),
      status: 'running',
      steps: [],
      currentStepIndex: -1,
      context: {}
    }

    this.traces.set(traceId, trace)
    return traceId
  }

  // Start simulation
  async startSimulation(
    traceId: string, 
    flowConfig: FlowConfig, 
    requestName: string,
    options: SimulationOptions = {}
  ): Promise<void> {
    const trace = this.traces.get(traceId)
    if (!trace) throw new Error(`Trace ${traceId} not found`)

    const request = flowConfig.requests?.[requestName]
    if (!request) throw new Error(`Request ${requestName} not found`)

    this.isSimulating = true
    this.currentTraceId = traceId

    try {
      // Build execution plan
      const executionPlan = this.buildExecutionPlan(flowConfig, request)
      trace.steps = executionPlan

      // Execute steps
      for (let i = 0; i < executionPlan.length && this.isSimulating; i++) {
        trace.currentStepIndex = i
        await this.executeStep(trace, executionPlan[i], options)

        // Check for breakpoints
        if (options.breakpoints?.includes(executionPlan[i].nodeId)) {
          trace.status = 'paused'
          this.emit('breakpoint', trace, executionPlan[i])
          break
        }

        // Apply step delay
        if (options.stepDelay) {
          await this.sleep(options.stepDelay)
        }
      }

      if (trace.status !== 'paused') {
        trace.status = trace.steps.some(s => s.status === 'failed') ? 'failed' : 'success'
        trace.endTime = Date.now()
      }

    } catch (error) {
      trace.status = 'failed'
      trace.endTime = Date.now()
      console.error('Simulation failed:', error)
    } finally {
      this.isSimulating = false
    }
  }

  // Build execution plan from workflow configuration
  private buildExecutionPlan(flowConfig: FlowConfig, request: any): ExecutionStep[] {
    const plan: ExecutionStep[] = []
    const visited = new Set<string>()
    
    // Start from root
    let currentStep = request.root
    let stepIndex = 0

    while (currentStep && !visited.has(currentStep) && stepIndex < 100) { // Prevent infinite loops
      visited.add(currentStep)
      
      const stepDef = flowConfig.steps?.[currentStep]
      if (!stepDef) break

      plan.push({
        nodeId: currentStep,
        stepName: currentStep,
        stepType: stepDef.type,
        timestamp: 0,
        status: 'pending'
      })

      // Find next step (simplified linear execution for demo)
      const nextEdge = request.edges?.find((e: any) => e.from === currentStep)
      currentStep = nextEdge?.to
      stepIndex++

      // Stop at terminal steps
      if (currentStep === 'SUCCESS' || currentStep === 'FAILED') {
        break
      }
    }

    return plan
  }

  // Execute a single step
  private async executeStep(
    trace: ExecutionTrace, 
    step: ExecutionStep, 
    options: SimulationOptions
  ): Promise<void> {
    step.status = 'running'
    step.timestamp = Date.now()
    
    this.emit('stepStart', trace, step)

    try {
      // Simulate step execution
      await this.simulateStepBehavior(step, options)
      
      step.status = 'success'
      step.duration = Date.now() - step.timestamp
      
      this.emit('stepComplete', trace, step)
      
    } catch (error) {
      step.status = 'failed'
      step.error = error instanceof Error ? error.message : 'Unknown error'
      step.duration = Date.now() - step.timestamp
      
      this.emit('stepFailed', trace, step)
    }
  }

  // Simulate step behavior
  private async simulateStepBehavior(step: ExecutionStep, options: SimulationOptions): Promise<void> {
    const mockBehavior = options.mockStepBehavior?.[step.nodeId] || 
                        options.mockStepBehavior?.[step.stepType] ||
                        'success'

    // Simulate processing time
    const processingTime = Math.random() * 1000 + 200 // 200-1200ms
    await this.sleep(processingTime)

    // Determine outcome
    let shouldFail = false
    
    if (mockBehavior === 'failure') {
      shouldFail = true
    } else if (mockBehavior === 'random') {
      shouldFail = Math.random() < 0.2 // 20% failure rate
    }

    if (shouldFail) {
      throw new Error(`Step ${step.stepName} failed (simulated)`)
    }

    // Generate mock output
    step.output = {
      success: true,
      data: `Mock output for ${step.stepName}`,
      timestamp: Date.now()
    }
  }

  // Control methods
  pauseSimulation(): void {
    this.isSimulating = false
    if (this.currentTraceId) {
      const trace = this.traces.get(this.currentTraceId)
      if (trace) {
        trace.status = 'paused'
      }
    }
  }

  resumeSimulation(): void {
    if (this.currentTraceId) {
      const trace = this.traces.get(this.currentTraceId)
      if (trace && trace.status === 'paused') {
        trace.status = 'running'
        this.isSimulating = true
        // Continue from current step
        this.continueExecution(trace)
      }
    }
  }

  stopSimulation(): void {
    this.isSimulating = false
    if (this.currentTraceId) {
      const trace = this.traces.get(this.currentTraceId)
      if (trace) {
        trace.status = 'failed'
        trace.endTime = Date.now()
      }
    }
  }

  // Event system
  on(event: string, callback: (trace: ExecutionTrace, step: ExecutionStep) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  private emit(event: string, trace: ExecutionTrace, step: ExecutionStep): void {
    const listeners = this.eventListeners.get(event) || []
    listeners.forEach(callback => {
      try {
        callback(trace, step)
      } catch (error) {
        console.error('Error in event listener:', error)
      }
    })
  }

  // Utility methods
  getTrace(traceId: string): ExecutionTrace | undefined {
    return this.traces.get(traceId)
  }

  getAllTraces(): ExecutionTrace[] {
    return Array.from(this.traces.values())
  }

  clearTrace(traceId: string): void {
    this.traces.delete(traceId)
  }

  clearAllTraces(): void {
    this.traces.clear()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async continueExecution(trace: ExecutionTrace): Promise<void> {
    // Implementation for resuming execution - simplified for demo
    // In a real implementation, this would continue from the current step
    console.log('Continuing execution from step', trace.currentStepIndex)
  }

  // Analysis methods
  getExecutionSummary(traceId: string): {
    totalSteps: number
    successfulSteps: number
    failedSteps: number
    totalDuration: number
    averageStepDuration: number
  } | null {
    const trace = this.traces.get(traceId)
    if (!trace) return null

    const completedSteps = trace.steps.filter(s => s.duration !== undefined)
    const successfulSteps = trace.steps.filter(s => s.status === 'success')
    const failedSteps = trace.steps.filter(s => s.status === 'failed')
    const totalDuration = trace.endTime ? trace.endTime - trace.startTime : Date.now() - trace.startTime

    return {
      totalSteps: trace.steps.length,
      successfulSteps: successfulSteps.length,
      failedSteps: failedSteps.length,
      totalDuration,
      averageStepDuration: completedSteps.length > 0 
        ? completedSteps.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSteps.length
        : 0
    }
  }
}