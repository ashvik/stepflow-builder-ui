import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { StepFlowConfig, StepDef } from '../types/stepflow'
import { Settings, Zap } from 'lucide-react'

export interface QuickAddStepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddStep: (name: string, stepDef: StepDef) => void
  config: StepFlowConfig
}

export function QuickAddStepDialog({ open, onOpenChange, onAddStep, config }: QuickAddStepDialogProps) {
  const [stepName, setStepName] = useState('')
  const [stepType, setStepType] = useState('')
  const [errors, setErrors] = useState<{ stepName?: string; stepType?: string }>({})

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStepName('')
      setStepType('')
      setErrors({})
    }
  }, [open])

  const commonStepTypes = [
    'ValidateOrderStep',
    'ProcessPaymentStep',
    'SendNotificationStep',
    'DataTransformStep',
    'ServiceCallStep',
    'DecisionStep',
    'TerminalStep'
  ]

  const validateForm = () => {
    const newErrors: { stepName?: string; stepType?: string } = {}
    
    if (!stepName.trim()) {
      newErrors.stepName = 'Step name is required'
    } else if (config.steps?.[stepName.trim()]) {
      newErrors.stepName = 'A step with this name already exists'
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(stepName.trim())) {
      newErrors.stepName = 'Step name must start with a letter and contain only letters, numbers, and underscores'
    }
    
    if (!stepType.trim()) {
      newErrors.stepType = 'Step type is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validateForm()) return

    const stepDef: StepDef = {
      type: stepType.trim()
    }

    onAddStep(stepName.trim(), stepDef)
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            Quick Add Step
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create a new step with name and type. You can configure details later.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Step Name</label>
            <Input
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              placeholder="e.g., validateOrder, processPayment"
              className={errors.stepName ? 'border-red-500' : ''}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {errors.stepName && (
              <p className="text-xs text-red-500">{errors.stepName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              This will be the step identifier in your workflow
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Step Type</label>
            <Input
              value={stepType}
              onChange={(e) => setStepType(e.target.value)}
              placeholder="e.g., ValidateOrderStep"
              className={errors.stepType ? 'border-red-500' : ''}
              list="quick-step-types"
              onKeyDown={handleKeyDown}
            />
            <datalist id="quick-step-types">
              {commonStepTypes.map(type => (
                <option key={type} value={type} />
              ))}
            </datalist>
            {errors.stepType && (
              <p className="text-xs text-red-500">{errors.stepType}</p>
            )}
            <p className="text-xs text-muted-foreground">
              The Java class or component name to execute
            </p>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Need more options?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              After creating the step, select it on the canvas to configure guards, retry policies, and other advanced settings.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!stepName.trim() || !stepType.trim()}
          >
            <Zap className="w-4 h-4 mr-1" />
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}