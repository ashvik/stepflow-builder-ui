import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { FormField, Input, Textarea, Select, Checkbox } from './ui/form'
import { Button } from './ui/button'
import { StepNodeData } from '../types/stepflow'
import { Plus, Minus } from 'lucide-react'

export interface AddStepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (stepData: Omit<StepNodeData, 'id' | 'onEdit'>) => void
  existingSteps?: string[]
}

export function AddStepDialog({ open, onOpenChange, onSave, existingSteps = [] }: AddStepDialogProps) {
  const [formData, setFormData] = useState({
    label: '',
    type: '',
    isRoot: false,
    isTerminal: false,
    guard: '',
    retryCount: 0,
    retryGuard: '',
    config: {} as Record<string, any>
  })

  const [configEntries, setConfigEntries] = useState<Array<{ key: string; value: string; type: 'string' | 'number' | 'boolean' }>>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        label: '',
        type: '',
        isRoot: false,
        isTerminal: false,
        guard: '',
        retryCount: 0,
        retryGuard: '',
        config: {}
      })
      setConfigEntries([])
      setErrors({})
    }
  }, [open])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.label.trim()) {
      newErrors.label = 'Label is required'
    } else if (existingSteps.includes(formData.label.trim())) {
      newErrors.label = 'A step with this label already exists'
    }
    
    if (!formData.type.trim()) {
      newErrors.type = 'Type is required'
    }

    // Validate config entries
    configEntries.forEach((entry, index) => {
      if (!entry.key.trim()) {
        newErrors[`config_key_${index}`] = 'Config key cannot be empty'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildConfigObject = () => {
    const config: Record<string, any> = {}
    configEntries.forEach(entry => {
      if (entry.key.trim()) {
        let value: any = entry.value
        if (entry.type === 'number') {
          value = parseFloat(entry.value) || 0
        } else if (entry.type === 'boolean') {
          value = entry.value.toLowerCase() === 'true'
        }
        config[entry.key.trim()] = value
      }
    })
    return config
  }

  const handleSave = () => {
    if (!validateForm()) return

    const config = buildConfigObject()
    
    const stepData: Omit<StepNodeData, 'id' | 'onEdit'> = {
      label: formData.label.trim(),
      type: formData.type.trim(),
      isRoot: formData.isRoot,
      isTerminal: formData.isTerminal,
      config: Object.keys(config).length > 0 ? config : undefined,
      guard: formData.guard.trim() || undefined,
      retryCount: formData.retryCount > 0 ? formData.retryCount : undefined,
      retryGuard: formData.retryGuard.trim() || undefined
    }

    onSave(stepData)
    onOpenChange(false)
  }

  const addConfigEntry = () => {
    setConfigEntries(prev => [...prev, { key: '', value: '', type: 'string' }])
  }

  const removeConfigEntry = (index: number) => {
    setConfigEntries(prev => prev.filter((_, i) => i !== index))
  }

  const updateConfigEntry = (index: number, field: 'key' | 'value' | 'type', value: string) => {
    setConfigEntries(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ))
  }

  // Common step types for suggestions
  const commonStepTypes = [
    'ValidationStep',
    'ProcessorStep', 
    'NotificationStep',
    'DataTransformStep',
    'ServiceCallStep',
    'DecisionStep',
    'TerminalStep'
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader onClose={() => onOpenChange(false)}>
          <DialogTitle>Add New Step</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Step Label" required error={errors.label}>
              <Input
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., ValidateOrder"
                error={!!errors.label}
              />
            </FormField>

            <FormField label="Step Type" required error={errors.type}>
              <Input
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                placeholder="e.g., ValidationStep"
                list="step-types"
                error={!!errors.type}
              />
              <datalist id="step-types">
                {commonStepTypes.map(type => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </FormField>
          </div>

          {/* Step Properties */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Guard (optional)">
              <Input
                value={formData.guard}
                onChange={(e) => setFormData(prev => ({ ...prev, guard: e.target.value }))}
                placeholder="e.g., isValidUser"
              />
            </FormField>

            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.isRoot}
                    onChange={(e) => setFormData(prev => ({ ...prev, isRoot: e.target.checked }))}
                  />
                  <span className="text-sm">Root Step</span>
                </label>
                <label className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.isTerminal}
                    onChange={(e) => setFormData(prev => ({ ...prev, isTerminal: e.target.checked }))}
                  />
                  <span className="text-sm">Terminal Step</span>
                </label>
              </div>
            </div>
          </div>

          {/* Retry Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Retry Count">
              <Input
                type="number"
                min="0"
                value={formData.retryCount}
                onChange={(e) => setFormData(prev => ({ ...prev, retryCount: parseInt(e.target.value) || 0 }))}
                placeholder="0"
              />
            </FormField>

            <FormField label="Retry Guard">
              <Input
                value={formData.retryGuard}
                onChange={(e) => setFormData(prev => ({ ...prev, retryGuard: e.target.value }))}
                placeholder="e.g., shouldRetry"
                disabled={formData.retryCount === 0}
              />
            </FormField>
          </div>

          {/* Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Configuration</label>
              <Button 
                type="button" 
                size="sm" 
                variant="outline" 
                onClick={addConfigEntry}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Config
              </Button>
            </div>
            
            {configEntries.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded p-2">
                {configEntries.map((entry, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={entry.key}
                      onChange={(e) => updateConfigEntry(index, 'key', e.target.value)}
                      className="flex-1"
                      error={!!errors[`config_key_${index}`]}
                    />
                    <Select
                      value={entry.type}
                      onChange={(e) => updateConfigEntry(index, 'type', e.target.value)}
                      className="w-20"
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </Select>
                    <Input
                      placeholder={entry.type === 'boolean' ? 'true/false' : 'Value'}
                      value={entry.value}
                      onChange={(e) => updateConfigEntry(index, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeConfigEntry(index)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}