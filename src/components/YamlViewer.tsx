import React, { useState, useCallback, useMemo } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { 
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload,
  RotateCcw,
  FileText,
  CheckCircle,
  AlertTriangle,
  Code,
  List,
  FileCode
} from 'lucide-react'
import { StepFlowConfig } from '../types/stepflow'
import { cn } from '../lib/utils'
import YAML from 'yaml'
import YamlTreeView from './YamlTreeView'

interface YamlViewerProps {
  config: StepFlowConfig
  onConfigChange: (config: StepFlowConfig) => void
  className?: string
}

const YamlViewer: React.FC<YamlViewerProps> = ({
  config,
  onConfigChange,
  className
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState('')
  const [isCompact, setIsCompact] = useState(false)
  const [viewMode, setViewMode] = useState<'yaml' | 'tree'>('yaml')
  
  // Transform config for YAML output (rename retryAttempts to attempts, retryDelay to delay)
  const transformConfigForYaml = useCallback((config: StepFlowConfig): StepFlowConfig => {
    const transformedConfig = JSON.parse(JSON.stringify(config)) // Deep clone
    
    // Transform edges in workflows
    if (transformedConfig.workflows) {
      Object.values(transformedConfig.workflows).forEach((workflow: any) => {
        if (workflow.edges) {
          workflow.edges.forEach((edge: any) => {
            if (edge.onFailure && edge.onFailure.strategy === 'RETRY') {
              if (edge.onFailure.retryAttempts !== undefined) {
                edge.onFailure.attempts = edge.onFailure.retryAttempts
                delete edge.onFailure.retryAttempts
              }
              if (edge.onFailure.retryDelay !== undefined) {
                edge.onFailure.delay = edge.onFailure.retryDelay
                delete edge.onFailure.retryDelay
              }
            }
          })
        }
      })
    }
    
    return transformedConfig
  }, [])

  // Generate YAML string from config
  const yamlString = useMemo(() => {
    try {
      const transformedConfig = transformConfigForYaml(config)
      return YAML.stringify(transformedConfig, {
        indent: isCompact ? 1 : 2,
        lineWidth: isCompact ? 120 : 80,
        minContentWidth: isCompact ? 20 : 40
      })
    } catch (err) {
      console.error('Failed to stringify YAML:', err)
      return '# Error generating YAML\n# ' + String(err)
    }
  }, [config, isCompact, transformConfigForYaml])
  
  // Start editing
  const startEdit = useCallback(() => {
    setEditValue(yamlString)
    setIsEditing(true)
    setError('')
  }, [yamlString])
  
  // Cancel editing
  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue('')
    setError('')
  }, [])
  
  // Transform config from YAML input (rename attempts to retryAttempts, delay to retryDelay)
  const transformConfigFromYaml = useCallback((config: StepFlowConfig): StepFlowConfig => {
    const transformedConfig = JSON.parse(JSON.stringify(config)) // Deep clone
    
    // Transform edges in workflows
    if (transformedConfig.workflows) {
      Object.values(transformedConfig.workflows).forEach((workflow: any) => {
        if (workflow.edges) {
          workflow.edges.forEach((edge: any) => {
            if (edge.onFailure && edge.onFailure.strategy === 'RETRY') {
              if (edge.onFailure.attempts !== undefined) {
                edge.onFailure.retryAttempts = edge.onFailure.attempts
                delete edge.onFailure.attempts
              }
              if (edge.onFailure.delay !== undefined) {
                edge.onFailure.retryDelay = edge.onFailure.delay
                delete edge.onFailure.delay
              }
            }
          })
        }
      })
    }
    
    return transformedConfig
  }, [])

  // Apply changes
  const applyChanges = useCallback(() => {
    try {
      const parsed = YAML.parse(editValue) as StepFlowConfig
      
      // Basic validation
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Configuration must be an object')
      }
      // Restriction: require at least one workflow for steps/settings/defaults changes
      const hasWorkflows = Object.keys(parsed.workflows || {}).length > 0
      const hasRestrictedSections =
        (parsed.steps && Object.keys(parsed.steps).length > 0) ||
        (parsed.settings && Object.keys(parsed.settings).length > 0) ||
        (parsed.defaults && Object.keys(parsed.defaults).length > 0)
      if (!hasWorkflows && hasRestrictedSections) {
        throw new Error('At least one workflow is required to create or update steps, settings, or defaults. Add a workflow under "workflows" and try again.')
      }
      
      // Transform YAML property names back to internal representation
      const transformedConfig = transformConfigFromYaml(parsed)
      
      onConfigChange(transformedConfig)
      setIsEditing(false)
      setEditValue('')
      setError('')
    } catch (err) {
      setError(String(err))
    }
  }, [editValue, onConfigChange, transformConfigFromYaml])
  
  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(yamlString)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = yamlString
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }, [yamlString])
  
  // Download YAML file
  const downloadYaml = useCallback(() => {
    const blob = new Blob([yamlString], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stepflow-config.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }, [yamlString])
  
  // Import YAML file
  const importYaml = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const yaml = e.target?.result as string
            const parsed = YAML.parse(yaml) as StepFlowConfig
            const hasWorkflows = Object.keys(parsed.workflows || {}).length > 0
            const hasRestrictedSections =
              (parsed.steps && Object.keys(parsed.steps).length > 0) ||
              (parsed.settings && Object.keys(parsed.settings).length > 0) ||
              (parsed.defaults && Object.keys(parsed.defaults).length > 0)
            if (!hasWorkflows && hasRestrictedSections) {
              alert('Import blocked: add at least one workflow to create or update steps, settings, or defaults.')
              return
            }
            // Transform YAML property names back to internal representation
            const transformedConfig = transformConfigFromYaml(parsed)
            onConfigChange(transformedConfig)
            // notify host to rebuild tabs with imported config
            window.dispatchEvent(new CustomEvent('stepflow-config-imported', { detail: { config: transformedConfig, source: 'yaml-viewer' } }))
          } catch (error) {
            alert('Failed to parse YAML file: ' + String(error))
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [onConfigChange, transformConfigFromYaml])
  
  // Get config statistics
  const stats = useMemo(() => {
    const steps = Object.keys(config.steps || {}).length
    const workflows = Object.keys(config.workflows || {}).length
    const settings = Object.keys(config.settings || {}).length
    const defaults = Object.keys(config.defaults || {}).length
    
    return { steps, workflows, settings, defaults }
  }, [config])
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Live YAML</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{stats.steps} steps</span>
            <span>•</span>
            <span>{stats.workflows} workflows</span>
            {!isEditing && (
              <>
                <span>•</span>
                <span className="text-primary font-medium">
                  {viewMode === 'tree' ? '🌳 Tree View' : '📄 YAML View'}
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <Button
                size="sm"
                variant={viewMode === 'tree' ? 'default' : 'outline'}
                onClick={() => setViewMode('tree')}
                title="Tree view"
                className="h-7"
              >
                <List className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'yaml' ? 'default' : 'outline'}
                onClick={() => setViewMode('yaml')}
                title="YAML view"
                className="h-7"
              >
                <FileCode className="w-3 h-3" />
              </Button>
              {viewMode === 'yaml' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCompact(!isCompact)}
                  title={isCompact ? 'Expand format' : 'Compact format'}
                  className="h-7"
                >
                  {isCompact ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={copyToClipboard}
            title="Copy to clipboard"
            className="h-7"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadYaml}
            title="Download YAML"
            className="h-7"
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={importYaml}
            title="Import YAML"
            className="h-7"
          >
            <Upload className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant={isEditing ? "destructive" : "default"}
            onClick={isEditing ? cancelEdit : startEdit}
            className="h-7"
          >
            {isEditing ? (
              <>
                <RotateCcw className="w-3 h-3 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <Code className="w-3 h-3 mr-1" />
                Edit
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="border rounded-lg">
        {isEditing ? (
          <div className="space-y-3 p-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[400px] font-mono text-sm resize-none"
              placeholder="Enter YAML configuration..."
            />
            
            {error && (
              <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">YAML Parse Error</div>
                  <div className="text-xs mt-1">{error}</div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Make changes to the YAML above and apply to update the configuration
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={applyChanges}
                  disabled={!editValue.trim() || !!error}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Apply Changes
                </Button>
              </div>
            </div>
          </div>
        ) : viewMode === 'tree' ? (
          <YamlTreeView 
            data={transformConfigForYaml(config)}
            yamlString={yamlString}
            className="bg-muted/30 rounded-lg"
          />
        ) : (
          <div className="relative">
            <pre className="p-4 text-sm font-mono bg-muted/30 rounded-lg overflow-auto max-h-[500px] text-foreground">
              <code>{yamlString}</code>
            </pre>
            
            {/* Overlay for read-only mode */}
            <div className="absolute top-2 right-2">
              <div className="bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground border">
                Read-only • Click Edit to modify
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Statistics */}
      {!isEditing && (
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-blue-600">{stats.steps}</div>
            <div className="text-xs text-muted-foreground">Steps</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-purple-600">{stats.workflows}</div>
            <div className="text-xs text-muted-foreground">Workflows</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-600">{stats.settings}</div>
            <div className="text-xs text-muted-foreground">Settings</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-orange-600">{stats.defaults}</div>
            <div className="text-xs text-muted-foreground">Defaults</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default YamlViewer
