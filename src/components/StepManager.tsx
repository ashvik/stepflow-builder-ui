import React, { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Plus,
  Minus,
  Settings,
  Shield,
  Copy,
  Trash2,
  Boxes
} from 'lucide-react'
import { StepFlowConfig, StepDef, ComponentInfo } from '../types/stepflow'
import { cn } from '../lib/utils'

interface StepManagerProps {
  config: StepFlowConfig
  components: ComponentInfo[]
  onConfigChange: (config: StepFlowConfig) => void
  onSelectStep?: (stepId: string) => void
  selectedStepId?: string
  editable?: boolean
}

const StepManager: React.FC<StepManagerProps> = ({
  config,
  components,
  onConfigChange,
  onSelectStep,
  selectedStepId,
  editable = true,
}) => {
  // Add-step UI removed as per V3 request
  
  const steps = config.steps || {}
  const stepComponents = components.filter(c => c.type === 'step')
  const guardComponents = components.filter(c => c.type === 'guard')
  const hasWorkflow = Object.keys(config.workflows || {}).length > 0
  const canEdit = editable && hasWorkflow
  
  // Creation removed
  
  const deleteStep = useCallback((stepName: string) => {
    if (!canEdit) return
    if (!confirm(`Delete step "${stepName}"?`)) return
    
    const newSteps = { ...steps }
    delete newSteps[stepName]
    
    // Also remove references from workflows
    const updatedWorkflows = { ...config.workflows }
    Object.entries(updatedWorkflows).forEach(([workflowName, workflow]) => {
      // Update root if it references deleted step
      if (workflow.root === stepName) {
        workflow.root = ''
      }
      
      // Remove edges that reference deleted step
      workflow.edges = workflow.edges.filter(
        edge => edge.from !== stepName && edge.to !== stepName
      )
    })
    
    onConfigChange({
      ...config,
      steps: newSteps,
      workflows: updatedWorkflows
    })
  }, [steps, config, onConfigChange, canEdit])
  
  const updateStep = useCallback((stepName: string, updates: Partial<StepDef>) => {
    if (!canEdit) return
    const currentStep = steps[stepName]
    if (!currentStep) return
    
    const updatedStep = { ...currentStep, ...updates }
    
    onConfigChange({
      ...config,
      steps: {
        ...steps,
        [stepName]: updatedStep
      }
    })
  }, [steps, config, onConfigChange, canEdit])
  
  const cloneStep = useCallback((stepName: string) => {
    if (!canEdit) return
    const sourceStep = steps[stepName]
    if (!sourceStep) return
    
    let cloneName = `${stepName}_copy`
    let counter = 1
    while (steps[cloneName]) {
      cloneName = `${stepName}_copy_${counter}`
      counter++
    }
    
    onConfigChange({
      ...config,
      steps: {
        ...steps,
        [cloneName]: { ...sourceStep }
      }
    })
  }, [steps, config, onConfigChange, canEdit])
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Boxes className="w-5 h-5" />
          Steps ({Object.keys(steps).length})
        </h3>
        {!canEdit && (
          <span className="text-xs text-muted-foreground">Create a workflow to edit</span>
        )}
      </div>
      
      {/* Add Step UI intentionally removed in V3 */}
      
      {/* Steps List */}
      {Object.keys(steps).length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No steps defined</p>
          <p className="text-xs">Create your first step above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(steps).map(([name, step]) => {
            const isSelected = selectedStepId === name
            const component = components.find(c => c.name === step.type)
            const hasConfig = step.config && Object.keys(step.config).length > 0
            const hasGuards = step.guards && step.guards.length > 0
            const hasRetry = step.retry && step.retry.maxAttempts > 1
            
            return (
              <Card
                key={name}
                className={cn(
                  'p-3 cursor-pointer transition-colors hover:bg-accent',
                  isSelected && 'ring-2 ring-blue-500 ring-opacity-50 bg-accent'
                )}
                onClick={() => onSelectStep?.(name)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">{name}</span>
                    
                    {/* Status indicators */}
                    <div className="flex gap-1">
                      {hasConfig && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Has configuration" />
                      )}
                      {hasGuards && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full" title="Has guards" />
                      )}
                      {hasRetry && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" title="Has retry policy" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        cloneStep(name)
                      }}
                      className="h-6 w-6 p-0"
                      disabled={!canEdit}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStep(name)
                      }}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      disabled={!canEdit}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className={cn(
                      "font-mono",
                      step.type ? "text-foreground" : "text-red-500"
                    )}>
                      {step.type || 'Not set'}
                    </span>
                  </div>
                  
                  
                  <div className="flex justify-between">
                    <span>Guards:</span>
                    <span>{hasGuards ? step.guards!.length : 0}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>Retry:</span>
                    <span>{hasRetry ? `${step.retry!.maxAttempts}x` : 'None'}</span>
                  </div>
                </div>
                
                {/* Quick Edit */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Type</label>
                      <Input
                        value={step.type || ''}
                        onChange={(e) => updateStep(name, { type: e.target.value })}
                        placeholder="Enter step type (e.g., ValidateOrderStep)"
                        className="h-7 text-xs font-mono"
                        disabled={!canEdit}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Component will be resolved at runtime
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default StepManager
