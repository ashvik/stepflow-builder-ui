import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
// Replaced textarea with custom editor
import { FileText, Code, RotateCcw, Upload, Download, Copy, AlertTriangle } from 'lucide-react'
import { StepFlowConfig, ComponentInfo } from '../types/stepflow'
import { parseDSL, stringifyDSL } from '../lib/dsl-converter'
import DslEditor from './DslEditor'
import { DslHighlighter } from '../lib/dsl-highlighter'

interface DslViewerProps {
  config: StepFlowConfig
  onConfigChange: (config: StepFlowConfig) => void
  className?: string
  components?: ComponentInfo[]
}

const DslViewer: React.FC<DslViewerProps> = ({ config, onConfigChange, className, components = [] }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState('')
  const [parseErrors, setParseErrors] = useState<Array<{ line: number; message: string; severity?: 'error' | 'warning' | 'info' }>>([])

  const dsl = useMemo(() => stringifyDSL(config), [config])
  const highlightedDsl = useMemo(() => {
    const highlighted = DslHighlighter.highlight(dsl)
    console.log('Original DSL:', dsl.substring(0, 100))
    console.log('Highlighted DSL:', highlighted.substring(0, 200))
    return highlighted
  }, [dsl])

  // CSS for DSL syntax highlighting is now included in styles.css

  const startEdit = useCallback(() => {
    setEditValue(dsl)
    setIsEditing(true)
    setError('')
    setParseErrors([])
  }, [dsl])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditValue('')
    setError('')
    setParseErrors([])
  }, [])

  const apply = useCallback(() => {
    console.log('DslViewer - Apply clicked, parsing DSL:', editValue.substring(0, 50) + '...')
    const res = parseDSL(editValue)
    if (res.errors.length > 0) {
      const formattedErrors = res.errors.map(e => ({ 
        line: e.line, 
        message: e.message, 
        severity: 'error' as const 
      }))
      setParseErrors(formattedErrors)
      setError(res.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n'))
      return
    }
    const parsed = res.config as StepFlowConfig
    // Restriction: require at least one workflow if steps/settings/defaults present
    const hasWorkflows = Object.keys(parsed.workflows || {}).length > 0
    const hasRestricted = !!(Object.keys(parsed.steps || {}).length || Object.keys(parsed.settings || {}).length || Object.keys(parsed.defaults || {}).length)
    if (!hasWorkflows && hasRestricted) {
      setError('At least one workflow is required to create or update steps, settings, or defaults.')
      return
    }
    onConfigChange(parsed)
    setIsEditing(false)
    setEditValue('')
    setError('')
    setParseErrors([])
    window.dispatchEvent(new CustomEvent('stepflow-config-imported', { detail: { config: parsed, source: 'dsl-viewer' } }))
  }, [editValue, onConfigChange])

  const copyToClipboard = useCallback(async () => {
    try { await navigator.clipboard.writeText(dsl) } catch {}
  }, [dsl])

  const downloadDsl = useCallback(() => {
    const blob = new Blob([dsl], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflow.dsl'
    a.click()
    URL.revokeObjectURL(url)
  }, [dsl])

  const importDsl = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.dsl,.txt,.flow'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        setIsEditing(true)
        setEditValue(String(ev.target?.result || ''))
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          <h3 className="text-lg font-semibold">DSL</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={copyToClipboard} className="h-7" title="Copy DSL to clipboard"><Copy className="w-3 h-3" /></Button>
          <Button size="sm" variant="outline" onClick={downloadDsl} className="h-7" title="Download DSL file"><Download className="w-3 h-3" /></Button>
          <Button size="sm" variant="outline" onClick={importDsl} className="h-7" title="Import DSL file"><Upload className="w-3 h-3" /></Button>
          <Button size="sm" variant={isEditing ? 'destructive' : 'default'} onClick={isEditing ? cancelEdit : startEdit} className="h-7" title={isEditing ? 'Cancel editing' : 'Edit DSL'}>
            {isEditing ? (<><RotateCcw className="w-3 h-3 mr-1"/>Cancel</>) : (<><Code className="w-3 h-3 mr-1"/>Edit</>)}
          </Button>
        </div>
      </div>
      <div className="border rounded-lg">
        {isEditing ? (
          <div className="space-y-3 p-3">
            <DslEditor
              value={editValue}
              onChange={(val) => {
                setEditValue(val)
                // Clear errors when user starts typing
                if (parseErrors.length > 0) {
                  setParseErrors([])
                  setError('')
                }
              }}
              getSuggestions={(ctx) => getDslSuggestions(ctx, config, components)}
              errors={parseErrors}
              height="h-80"
placeholder="# Example DSL syntax:\n\nsettings:\n  timeout = 30000\n\nworkflow OrderProcess:\n  root: ValidateOrder\n  ValidateOrder -> ProcessPayment\n  ProcessPayment -> SUCCESS\n\nstep ValidateOrder: ValidationStep\n  config:\n    strict = true"
            />
            {error && (
              <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Parse Error</div>
                  <div className="text-xs mt-1">{error}</div>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>💡 <strong>Tips:</strong> Tab/Space/: to complete • Ctrl+/ to comment • Ctrl+Shift+F to format</div>
                <div>🚀 <strong>Shortcuts:</strong> ↑↓ navigate suggestions • Enter to apply • Esc to close</div>
              </div>
              <Button size="sm" onClick={apply} disabled={!editValue.trim()}>Apply Changes</Button>
            </div>
          </div>
        ) : (
          <pre className="p-4 text-sm font-mono bg-muted/30 rounded-lg overflow-auto max-h-[500px] text-foreground">
            <code dangerouslySetInnerHTML={{ __html: highlightedDsl }} />
          </pre>
        )}
      </div>
    </div>
  )
}

export default DslViewer

function getDslSuggestions(ctx: { line: string; before: string; after: string }, config: StepFlowConfig, components: ComponentInfo[]): string[] {
  const { line, before } = ctx
  const trimmed = line.trim()
  const m = line.match(/(^|\s)([^\s]*)$/)
  const prefix = (m ? m[2] : '').toLowerCase()
  
  // Don't show suggestions if line already has an assignment
  if (line.includes('=') && !line.endsWith('=')) {
    return []
  }
  
  const stepNames = Object.keys(config.steps || {})
  const workflowNames = Object.keys(config.workflows || {})
  const guardNames = components.filter(c => c.type === 'guard').map(c => c.name)
  const stepTypes = components.filter(c => c.type === 'step').map(c => c.name)
  
  // Determine current context from the text before cursor
  const lines = before.split('\n')
  const currentSection = detectCurrentSection(lines)
  
  const suggestions: string[] = []
  
  // Section-specific suggestions with better grammar
  if (currentSection === 'settings') {
    const settingsKeys = ['timeout', 'debug', 'environment', 'maxRetries', 'defaultDelay', 'logLevel', 'tracing']
    if (trimmed.length === 0) {
      suggestions.push(...settingsKeys.slice(0, 4))
    } else {
      const matches = settingsKeys.filter(k => k.toLowerCase().startsWith(prefix))
      suggestions.push(...matches)
      
      // Add value suggestions for known settings
      if (prefix === 'debug') {
        suggestions.push('true', 'false')
      } else if (prefix === 'environment') {
        suggestions.push('development', 'production', 'test')
      } else if (prefix === 'logLevel') {
        suggestions.push('DEBUG', 'INFO', 'WARN', 'ERROR')
      }
    }
  } else if (currentSection === 'defaults') {
    const defaultsKeys = ['step.timeout', 'step.retries', 'guard.enabled', 'step.debug']
    if (trimmed.length === 0) {
      suggestions.push(...defaultsKeys.slice(0, 3))
    } else {
      suggestions.push(...defaultsKeys.filter(k => k.toLowerCase().startsWith(prefix)))
    }
  } else if (currentSection.startsWith('workflow:')) {
    // Inside workflow context
    if (trimmed.length === 0) {
      if (!before.includes('root:')) {
        suggestions.push('root')
      }
      // Suggest step names for edges
      suggestions.push(...stepNames.slice(0, 4))
    } else if (prefix === 'root' || (trimmed.startsWith('root') && !trimmed.includes(':'))) {
      suggestions.push('root')
    } else if (trimmed.includes('->')) {
      if (trimmed.endsWith('?')) {
        // After ? - suggest guard names
        suggestions.push(...guardNames.slice(0, 5))
      } else if (trimmed.includes('fail') || trimmed.includes('failure')) {
        // After fail keyword
        suggestions.push('skip', 'stop', 'continue', 'retry', '-> FAILURE', ...stepNames.slice(0, 2))
      } else {
        // After -> suggest targets
        suggestions.push('SUCCESS', 'FAILURE', ...stepNames.slice(0, 3))
      }
    } else if (['fail', 'failure', 'on'].some(kw => kw.startsWith(prefix))) {
      // Failure handling keywords
      suggestions.push('fail', 'on failure')
    } else if (['skip', 'stop', 'continue', 'retry'].some(kw => kw.startsWith(prefix))) {
      // Control flow keywords
      suggestions.push(...['skip', 'stop', 'continue', 'retry'].filter(kw => kw.startsWith(prefix)))
    } else if (['SUCCESS', 'FAILURE'].some(kw => kw.toLowerCase().startsWith(prefix))) {
      // Terminal states
      suggestions.push(...['SUCCESS', 'FAILURE'].filter(kw => kw.toLowerCase().startsWith(prefix)))
    } else {
      // Suggest step names that match prefix
      suggestions.push(...stepNames.filter(name => name.toLowerCase().startsWith(prefix)).slice(0, 5))
    }
  } else if (currentSection.startsWith('step:')) {
    // Inside step definition context
    const isInConfig = detectConfigContext(lines)
    
    if (isInConfig) {
      // We're in a config block - suggest common config keys
      const stepConfigSuggestions = getStepConfigSuggestions(prefix, components)
      suggestions.push(...stepConfigSuggestions)
    } else {
      // Step-level properties
      const stepProps = ['requires', 'retry', 'config']
      
      if (trimmed.length === 0) {
        suggestions.push(...stepProps)
      } else if (trimmed.startsWith('requires:') || trimmed.startsWith('requires ')) {
        // After 'requires:' suggest guard names
        suggestions.push(...guardNames.slice(0, 5))
      } else if (trimmed.startsWith('retry:') || trimmed.startsWith('retry ')) {
        // After 'retry:' suggest retry patterns
        suggestions.push('3x', '5x', '3x / 1000ms', '2x / 500ms', '10x / 2000ms')
      } else if (prefix === 'requires' || prefix.startsWith('req')) {
        suggestions.push('requires')
      } else if (prefix === 'retry' || prefix.startsWith('ret')) {
        suggestions.push('retry')
      } else if (prefix === 'config' || prefix.startsWith('con')) {
        suggestions.push('config')
      } else {
        // Match any step property that starts with prefix
        suggestions.push(...stepProps.filter(p => p.toLowerCase().startsWith(prefix)))
        
        // Also suggest common step keywords
        const stepKeywords = ['timeout', 'enabled', 'debug', 'strict']
        suggestions.push(...stepKeywords.filter(k => k.toLowerCase().startsWith(prefix)))
      }
    }
  } else {
    // Top level - suggest main sections and keywords
    const topLevelKeywords = ['workflow', 'step', 'settings', 'defaults']
    const allKeywords = [
      ...topLevelKeywords,
      'root', 'requires', 'retry', 'config',
      'SUCCESS', 'FAILURE', 'skip', 'stop', 'continue'
    ]
    
    if (trimmed.length === 0) {
      suggestions.push(...topLevelKeywords)
    } else {
      // Match any keyword that starts with the prefix
      const matchingKeywords = allKeywords.filter(k => k.toLowerCase().startsWith(prefix))
      suggestions.push(...matchingKeywords)
      
      // Also suggest step types if we have components
      const matchingStepTypes = stepTypes.filter(t => t.toLowerCase().startsWith(prefix))
      suggestions.push(...matchingStepTypes.slice(0, 3))
    }
  }
  
  // Clean and filter suggestions
  const cleanSuggestions = suggestions
    .filter(s => typeof s === 'string' && s.trim().length > 0)
    .map(s => s.trim())
    .filter(s => s.toLowerCase().startsWith(prefix) || prefix.length === 0)
    .filter(s => !s.includes('\n'))
  
  return Array.from(new Set(cleanSuggestions)).slice(0, 8)
}

function detectCurrentSection(lines: string[]): string {
  let currentSection = 'top-level'
  
  // Look backwards through lines to find current context
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue
    
    // Check for main sections
    if (line.match(/^settings:\s*$/i)) {
      currentSection = 'settings'
      break
    } else if (line.match(/^defaults:\s*$/i)) {
      currentSection = 'defaults'
      break
    } else if (line.match(/^workflow\s+([A-Za-z_][\w]*)\s*:\s*$/i)) {
      const match = line.match(/^workflow\s+([A-Za-z_][\w]*)\s*:\s*$/i)
      currentSection = `workflow:${match?.[1] || 'unknown'}`
      break
    } else if (line.match(/^step\s+([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w\.]*)\s*$/i)) {
      const match = line.match(/^step\s+([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w\.]*)\s*$/i)
      currentSection = `step:${match?.[1] || 'unknown'}`
      break
    }
    
    // If we hit an indented line, continue looking for parent section
    if (line.match(/^\s+/)) {
      continue
    }
    
    // If we hit another top-level declaration, stop
    if (line.length > 0) {
      break
    }
  }
  
  return currentSection
}

function detectConfigContext(lines: string[]): boolean {
  // Look for 'config:' in recent lines and check if we're still in that context
  let foundConfig = false
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    
    if (line.toLowerCase() === 'config:') {
      foundConfig = true
      break
    }
    
    // If we hit another section or step declaration, we're not in config
    if (line.match(/^(step|workflow|settings|defaults|requires|retry)\s*[:]/i)) {
      break
    }
    
    // If we hit a non-indented line that's not config-related, we're not in config
    if (!line.match(/^\s/) && !line.includes('=')) {
      break
    }
  }
  return foundConfig
}

function getStepConfigSuggestions(prefix: string, components: ComponentInfo[]): string[] {
  // Common step configuration keys with suggested values
  const configSuggestions = [
    // Common boolean configs
    'enabled',
    'debug', 
    'strict',
    'async',
    'parallel',
    // Common numeric configs
    'timeout',
    'retries', 
    'delay',
    'batchSize',
    'maxItems',
    // Common string configs
    'validationMode',
    'logLevel',
    'environment',
    'format',
    'encoding'
  ]
  
  if (prefix.length === 0) {
    return configSuggestions.slice(0, 6)
  }
  
  // Filter by prefix match
  const matches = configSuggestions.filter(key => key.toLowerCase().startsWith(prefix.toLowerCase()))
  
  // Add specific value suggestions for known keys
  const valueSpecificSuggestions: string[] = []
  if (prefix === 'enabled' || prefix === 'debug' || prefix === 'strict') {
    valueSpecificSuggestions.push('true', 'false')
  } else if (prefix === 'timeout') {
    valueSpecificSuggestions.push('5000', '10000', '30000')
  } else if (prefix === 'logLevel') {
    valueSpecificSuggestions.push('DEBUG', 'INFO', 'WARN', 'ERROR')
  } else if (prefix === 'validationMode') {
    valueSpecificSuggestions.push('strict', 'lenient', 'disabled')
  }
  
  return [...matches, ...valueSpecificSuggestions].slice(0, 8)
}
