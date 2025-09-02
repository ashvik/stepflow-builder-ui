import React, { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Card } from './ui/card'
import { 
  Settings, 
  FileText, 
  Layers,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Database,
  Cog,
  Package,
  Boxes
} from 'lucide-react'
import { StepFlowConfig, ComponentInfo } from '../types/stepflow'
import StepManager from './StepManager'
import YamlViewer from './YamlViewer'

interface ConfigurationSidebarProps {
  config: StepFlowConfig
  selectedStepId?: string
  onConfigChange: (config: StepFlowConfig) => void
  onSelectStep?: (stepId: string) => void
  embedded?: boolean
  onAddStep?: () => void
}

interface KeyValueEditorProps {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
  placeholder?: string
  disabled?: boolean
}

const KeyValueEditor: React.FC<KeyValueEditorProps> = ({ data, onChange, placeholder, disabled }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  
  const addProperty = useCallback((path: string[] = []) => {
    if (disabled) return
    const newData = { ...data }
    let current = newData
    
    // Navigate to the correct nested object
    for (let i = 0; i < path.length; i++) {
      if (!current[path[i]]) current[path[i]] = {}
      current = current[path[i]]
    }
    
    // Add new property
    let counter = 1
    while (current[`newProperty${counter}`] !== undefined) {
      counter++
    }
    current[`newProperty${counter}`] = ''
    
    onChange(newData)
  }, [data, onChange])
  
  const removeProperty = useCallback((path: string[]) => {
    if (disabled) return
    const newData = { ...data }
    let current = newData
    
    // Navigate to parent
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]]
    }
    
    delete current[path[path.length - 1]]
    onChange(newData)
  }, [data, onChange])
  
  const updateProperty = useCallback((path: string[], value: any) => {
    if (disabled) return
    const newData = { ...data }
    let current = newData
    
    // Navigate to parent
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {}
      current = current[path[i]]
    }
    
    current[path[path.length - 1]] = value
    onChange(newData)
  }, [data, onChange])
  
  const renderValue = (value: any, path: string[]): React.ReactNode => {
    if (value === null || value === undefined) {
      return (
        <Input
          value=""
          onChange={(e) => updateProperty(path, e.target.value)}
          placeholder="Enter value"
          className="h-8 text-sm"
          disabled={disabled}
        />
      )
    }
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      const isCollapsed = collapsed.has(path.join('.'))
      return (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const key = path.join('.')
              const newCollapsed = new Set(collapsed)
              if (isCollapsed) {
                newCollapsed.delete(key)
              } else {
                newCollapsed.add(key)
              }
              setCollapsed(newCollapsed)
            }}
            className="h-6 p-0 text-xs"
            disabled={disabled}
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Object ({Object.keys(value).length} properties)
          </Button>
          {!isCollapsed && (
            <div className="ml-4 space-y-2">
              {Object.entries(value).map(([key, val]) =>
                renderProperty(key, val, [...path, key])
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addProperty(path)}
                className="h-6 text-xs"
                disabled={disabled}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Property
              </Button>
            </div>
          )}
        </div>
      )
    }
    
    if (Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={String(item)}
                onChange={(e) => {
                  const newArray = [...value]
                  newArray[index] = e.target.value
                  updateProperty(path, newArray)
                }}
                className="h-7 text-sm flex-1"
                disabled={disabled}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newArray = value.filter((_, i) => i !== index)
                  updateProperty(path, newArray)
                }}
                className="h-7 w-7 p-0"
                disabled={disabled}
              >
                <Minus className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateProperty(path, [...value, ''])}
            className="h-6 text-xs"
            disabled={disabled}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Item
          </Button>
        </div>
      )
    }
    
    // Primitive values
    return (
      <Input
        value={String(value)}
        onChange={(e) => {
          let newValue: any = e.target.value
          // Try to parse as number or boolean
          if (!isNaN(Number(newValue)) && newValue.trim() !== '') {
            newValue = Number(newValue)
          } else if (newValue === 'true') {
            newValue = true
          } else if (newValue === 'false') {
            newValue = false
          }
          updateProperty(path, newValue)
        }}
        className="h-8 text-sm"
        disabled={disabled}
      />
    )
  }
  
  const renderProperty = (key: string, value: any, path: string[]): React.ReactNode => (
    <div key={path.join('.')} className="flex gap-2 items-start">
      <div className="flex-1 space-y-1">
        <div className="flex gap-2">
          <Input
            value={key}
            onChange={(e) => {
              const newData = { ...data }
              let current = newData
              
              // Navigate to parent
              for (let i = 0; i < path.length - 1; i++) {
                current = current[path[i]]
              }
              
              // Rename property
              const oldKey = path[path.length - 1]
              current[e.target.value] = current[oldKey]
              delete current[oldKey]
              
              onChange(newData)
            }}
            placeholder="Property name"
            className="h-8 text-sm w-32"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeProperty(path)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
          >
            <Minus className="w-3 h-3" />
          </Button>
        </div>
        <div className="ml-2">
          {renderValue(value, path)}
        </div>
      </div>
    </div>
  )
  
  return (
    <div className="space-y-3">
      {Object.keys(data).length === 0 ? (
        <div className="text-center text-muted-foreground py-4">
          <p className="text-sm">{placeholder || 'No properties defined'}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addProperty()}
            className="mt-2"
            disabled={disabled}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add First Property
          </Button>
        </div>
      ) : (
        <>
          {Object.entries(data).map(([key, value]) =>
            renderProperty(key, value, [key])
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => addProperty()}
            className="w-full"
            disabled={disabled}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Property
          </Button>
        </>
      )}
    </div>
  )
}

const ConfigurationSidebar: React.FC<ConfigurationSidebarProps> = ({
  config,
  selectedStepId,
  onConfigChange,
  onSelectStep,
  embedded = false,
  onAddStep,
}) => {
  const [activeTab, setActiveTab] = useState('steps')
  const hasWorkflow = Object.keys(config.workflows || {}).length > 0
  
  const updateSettings = useCallback((settings: Record<string, any>) => {
    onConfigChange({ ...config, settings })
  }, [config, onConfigChange])
  
  const updateDefaults = useCallback((defaults: StepFlowConfig['defaults']) => {
    onConfigChange({ ...config, defaults })
  }, [config, onConfigChange])
  
  
  return (
    <div className={embedded ? "w-full bg-card flex flex-col" : "w-80 border-r border-border bg-card flex flex-col"}>
      <div className="p-3 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Cog className="w-5 h-5" />
          Configuration
        </h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 mx-3 mt-3">
          <TabsTrigger value="steps" className="text-xs">
            <Boxes className="w-3 h-3 mr-1" />
            Steps
          </TabsTrigger>
          <TabsTrigger value="yaml" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            YAML
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">
            <Settings className="w-3 h-3 mr-1" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="defaults" className="text-xs">
            <Layers className="w-3 h-3 mr-1" />
            Defaults
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="steps" className="flex-1 p-3 overflow-auto">
          <div className="mb-2 flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {!hasWorkflow && 'Add a workflow to enable step edits'}
            </div>
            <Button size="sm" onClick={onAddStep} className="h-7" disabled={!hasWorkflow} title={hasWorkflow ? 'Add a new step (Ctrl/Cmd+S)' : 'Create a workflow first'}>
              <Plus className="w-4 h-4 mr-1" />
              Add Step
            </Button>
          </div>
          <StepManager
            config={config}
            components={[]}
            onConfigChange={onConfigChange}
            selectedStepId={selectedStepId}
            onSelectStep={onSelectStep}
            editable={hasWorkflow}
          />
        </TabsContent>
        
        <TabsContent value="yaml" className="flex-1 p-3 overflow-auto">
          <YamlViewer
            config={config}
            onConfigChange={onConfigChange}
          />
        </TabsContent>
        
        <TabsContent value="settings" className="flex-1 p-3 space-y-4 overflow-auto">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4" />
              <h3 className="font-medium">Global Settings</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Global key/value pairs accessible via @ConfigValue(globalPath) in components
            </p>
            <KeyValueEditor
              data={config.settings || {}}
              onChange={updateSettings}
              placeholder="Add global settings for your components"
              disabled={!hasWorkflow}
            />
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4" />
              <h3 className="font-medium">Configuration Info</h3>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>• Settings are merged with step configs during injection</p>
              <p>• Use dot notation for nested paths (e.g., "payment.gateway")</p>
              <p>• Values are converted to field types automatically</p>
              <p>• Required=false fields use defaultValue if not found</p>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="defaults" className="flex-1 p-3 space-y-4 overflow-auto">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4" />
              <h3 className="font-medium">Step Defaults</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Default configuration applied to all steps
            </p>
            <KeyValueEditor
              data={config.defaults?.step || {}}
              onChange={(step) => updateDefaults({ ...config.defaults, step })}
              placeholder="Add default configuration for all steps"
              disabled={!hasWorkflow}
            />
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4" />
              <h3 className="font-medium">Guard Defaults</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Default configuration applied to all guards
            </p>
            <KeyValueEditor
              data={config.defaults?.guard || {}}
              onChange={(guard) => updateDefaults({ ...config.defaults, guard })}
              placeholder="Add default configuration for all guards"
              disabled={!hasWorkflow}
            />
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4" />
              <h3 className="font-medium">Named Defaults</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Component-specific defaults by step name or guard type
            </p>
            <KeyValueEditor
              data={Object.fromEntries(
                Object.entries(config.defaults || {}).filter(([key]) => 
                  key !== 'step' && key !== 'guard'
                )
              )}
              onChange={(namedDefaults) => {
                const { step, guard } = config.defaults || {}
                updateDefaults({ step, guard, ...namedDefaults })
              }}
              placeholder="Add named defaults (key = component name)"
              disabled={!hasWorkflow}
            />
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4" />
              <h3 className="font-medium">Merge Order</h3>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>1. Category defaults (step/guard)</p>
              <p>2. Named defaults (component name)</p>
              <p>3. Individual config (wins last)</p>
            </div>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  )
}

export default ConfigurationSidebar
