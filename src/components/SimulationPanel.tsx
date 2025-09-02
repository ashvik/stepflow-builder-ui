import React, { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Play, Pause, Square, RotateCcw, Clock, CheckCircle, XCircle, AlertCircle, Settings } from 'lucide-react'
import { WorkflowSimulator, ExecutionTrace, ExecutionStep, SimulationOptions } from '../lib/workflow-simulator'
import { cn } from '../lib/utils'

interface SimulationPanelProps {
  simulator: WorkflowSimulator
  onStepHighlight?: (nodeId: string | null) => void
  isVisible: boolean
  onClose: () => void
}

export function SimulationPanel({ simulator, onStepHighlight, isVisible, onClose }: SimulationPanelProps) {
  const [currentTrace, setCurrentTrace] = useState<ExecutionTrace | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(-1)
  const [simulationOptions, setSimulationOptions] = useState<SimulationOptions>({
    stepDelay: 1000,
    enableRetries: true,
    enableGuards: true,
    mockStepBehavior: {},
    maxExecutionTime: 30000
  })
  const [showSettings, setShowSettings] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Update current trace
  useEffect(() => {
    const traces = simulator.getAllTraces()
    if (traces.length > 0) {
      setCurrentTrace(traces[traces.length - 1])
    }
  }, [simulator])

  // Auto-refresh during simulation
  useEffect(() => {
    if (isRunning && currentTrace) {
      intervalRef.current = setInterval(() => {
        const updatedTrace = simulator.getTrace(currentTrace.id)
        if (updatedTrace) {
          setCurrentTrace({ ...updatedTrace })
          
          // Highlight current step
          if (updatedTrace.currentStepIndex >= 0) {
            const currentStep = updatedTrace.steps[updatedTrace.currentStepIndex]
            onStepHighlight?.(currentStep?.nodeId || null)
          }
          
          // Check if simulation completed
          if (updatedTrace.status !== 'running') {
            setIsRunning(false)
            onStepHighlight?.(null)
          }
        }
      }, 500)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, currentTrace, simulator, onStepHighlight])

  const handlePause = () => {
    simulator.pauseSimulation()
    setIsRunning(false)
    onStepHighlight?.(null)
  }

  const handleResume = () => {
    simulator.resumeSimulation()
    setIsRunning(true)
  }

  const handleStop = () => {
    simulator.stopSimulation()
    setIsRunning(false)
    onStepHighlight?.(null)
  }

  const handleReset = () => {
    simulator.clearAllTraces()
    setCurrentTrace(null)
    setIsRunning(false)
    setSelectedStepIndex(-1)
    onStepHighlight?.(null)
  }

  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (!isVisible) return null

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 bg-card border-l border-border flex flex-col shadow-lg z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-medium">Simulation</h3>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onClose}
          >
            ×
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 border-b border-border bg-accent/50">
          <div className="space-y-2">
            <label className="block text-xs">
              Step Delay (ms)
              <input
                type="number"
                value={simulationOptions.stepDelay}
                onChange={(e) => setSimulationOptions(prev => ({
                  ...prev,
                  stepDelay: parseInt(e.target.value) || 1000
                }))}
                className="mt-1 w-full h-6 text-xs rounded border border-input bg-background px-1"
                min="0"
                max="5000"
              />
            </label>
            
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={simulationOptions.enableRetries}
                  onChange={(e) => setSimulationOptions(prev => ({
                    ...prev,
                    enableRetries: e.target.checked
                  }))}
                  className="w-3 h-3"
                />
                Enable Retries
              </label>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={simulationOptions.enableGuards}
                  onChange={(e) => setSimulationOptions(prev => ({
                    ...prev,
                    enableGuards: e.target.checked
                  }))}
                  className="w-3 h-3"
                />
                Enable Guards
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1 p-2 border-b border-border">
        {!isRunning ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResume}
            disabled={!currentTrace || currentTrace.status === 'success'}
            className="flex-1"
          >
            <Play className="w-3 h-3 mr-1" />
            {currentTrace?.status === 'paused' ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePause}
            className="flex-1"
          >
            <Pause className="w-3 h-3 mr-1" />
            Pause
          </Button>
        )}
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleStop}
          disabled={!isRunning}
        >
          <Square className="w-3 h-3" />
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>

      {/* Trace Info */}
      {currentTrace && (
        <div className="p-3 border-b border-border bg-accent/20">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Workflow:</span>
              <span className="font-mono">{currentTrace.workflowName}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={cn(
                'capitalize font-medium',
                currentTrace.status === 'success' && 'text-green-600',
                currentTrace.status === 'failed' && 'text-red-600',
                currentTrace.status === 'running' && 'text-blue-600',
                currentTrace.status === 'paused' && 'text-yellow-600'
              )}>
                {currentTrace.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Progress:</span>
              <span>
                {currentTrace.steps.filter(s => s.status === 'success' || s.status === 'failed').length}/{currentTrace.steps.length}
              </span>
            </div>
            {currentTrace.endTime && (
              <div className="flex justify-between">
                <span>Duration:</span>
                <span>{formatDuration(currentTrace.endTime - currentTrace.startTime)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto">
        {currentTrace ? (
          <div className="p-2 space-y-1">
            {currentTrace.steps.map((step, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 p-2 rounded text-xs cursor-pointer transition-colors',
                  index === selectedStepIndex && 'bg-primary/10 border border-primary/20',
                  index === currentTrace.currentStepIndex && 'bg-blue-50 dark:bg-blue-900/20',
                  'hover:bg-accent/50'
                )}
                onClick={() => {
                  setSelectedStepIndex(index)
                  onStepHighlight?.(step.nodeId)
                }}
              >
                <div className="flex-shrink-0">
                  {getStatusIcon(step.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{step.stepName}</div>
                  <div className="text-muted-foreground text-xs">{step.stepType}</div>
                </div>
                
                <div className="text-right text-muted-foreground">
                  {formatDuration(step.duration)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No simulation running</p>
            <p className="text-xs">Start a workflow to begin simulation</p>
          </div>
        )}
      </div>

      {/* Step Details */}
      {currentTrace && selectedStepIndex >= 0 && selectedStepIndex < currentTrace.steps.length && (
        <div className="border-t border-border p-3 bg-accent/10">
          <div className="text-xs space-y-2">
            {(() => {
              const step = currentTrace.steps[selectedStepIndex]
              return (
                <>
                  <div className="font-medium">Step Details</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="font-mono">{step.stepName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-mono">{step.stepType}</span>
                    </div>
                    {step.error && (
                      <div className="mt-1">
                        <span className="text-red-600">Error:</span>
                        <div className="font-mono text-red-600 text-xs bg-red-50 dark:bg-red-900/20 p-1 rounded mt-1">
                          {step.error}
                        </div>
                      </div>
                    )}
                    {step.output && (
                      <div className="mt-1">
                        <span>Output:</span>
                        <div className="font-mono text-xs bg-gray-50 dark:bg-gray-800 p-1 rounded mt-1">
                          {JSON.stringify(step.output, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}