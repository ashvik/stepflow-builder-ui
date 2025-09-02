import React, { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'
import { Textarea } from './ui/textarea'
import { 
  Shield, 
  GitBranch,
  Type,
  FileText,
  AlertCircle,
  Trash2,
  Save,
  RotateCcw,
  SkipForward,
  ArrowRight,
  StopCircle,
  Clock
} from 'lucide-react'
import { EdgeData, StepFlowConfig, EdgeFailureStrategy } from '../types/stepflow'
import { Edge } from 'reactflow'

interface EdgePropertiesPanelProps {
  selectedEdgeId: string
  edgeData: EdgeData
  edge: Edge
  config: StepFlowConfig
  onUpdateEdge: (edgeId: string, updates: Partial<EdgeData>) => void
  onDeleteEdge: (edgeId: string) => void
}

const EdgePropertiesPanel: React.FC<EdgePropertiesPanelProps> = ({
  selectedEdgeId,
  edgeData,
  edge,
  config,
  onUpdateEdge,
  onDeleteEdge
}) => {
  const [localGuard, setLocalGuard] = useState(edgeData.guard || '')
  const [localCondition, setLocalCondition] = useState(edgeData.condition || '')
  const [localLabel, setLocalLabel] = useState(edgeData.label || '')
  const [failureStrategy, setFailureStrategy] = useState<EdgeFailureStrategy>(edgeData.onFailure?.strategy || 'STOP')
  const [alternativeTarget, setAlternativeTarget] = useState(edgeData.onFailure?.alternativeTarget || '')
  const [retryAttempts, setRetryAttempts] = useState(edgeData.onFailure?.retryAttempts?.toString() || '3')
  const [retryDelay, setRetryDelay] = useState(edgeData.onFailure?.retryDelay?.toString() || '1000')

  const handleSave = useCallback(() => {
    const onFailure = failureStrategy === 'STOP' ? undefined : {
      strategy: failureStrategy,
      alternativeTarget: failureStrategy === 'ALTERNATIVE' ? (alternativeTarget.trim() || undefined) : undefined,
      retryAttempts: failureStrategy === 'RETRY' ? parseInt(retryAttempts) || 3 : undefined,
      retryDelay: failureStrategy === 'RETRY' ? parseInt(retryDelay) || 1000 : undefined
    }
    
    onUpdateEdge(selectedEdgeId, {
      guard: localGuard.trim() || undefined,
      condition: localCondition.trim() || undefined,
      label: localLabel.trim() || undefined,
      onFailure
    })
  }, [selectedEdgeId, localGuard, localCondition, localLabel, failureStrategy, alternativeTarget, retryAttempts, retryDelay, onUpdateEdge])

  const handleDelete = useCallback(() => {
    if (confirm('Delete this edge connection?')) {
      onDeleteEdge(selectedEdgeId)
    }
  }, [selectedEdgeId, onDeleteEdge])

  // Get available guard components
  const availableGuards = Object.keys(config.steps || {}).filter(stepName => {
    const step = config.steps![stepName]
    return step.type && (
      step.type.toLowerCase().includes('guard') || 
      step.type.toLowerCase().includes('condition')
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Edge Properties
        </h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} title="Save Changes">
            <Save className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} title="Delete Edge">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Edge Info */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-blue-500" />
          <h4 className="font-medium">Connection Info</h4>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">From:</span>
            <span className="font-mono">{edge.source}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">To:</span>
            <span className="font-mono">{edge.target}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-mono">{edgeData.kind || 'normal'}</span>
          </div>
        </div>
      </Card>

      {/* Edge Label */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Type className="w-4 h-4 text-gray-500" />
          <h4 className="font-medium">Edge Label</h4>
        </div>
        <Input
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          placeholder="Optional display label for edge"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Display name shown on the edge connection
        </p>
      </Card>

      {/* Edge Guard */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-orange-500" />
          <h4 className="font-medium">Edge Guard</h4>
        </div>
        <div className="space-y-3">
          <div>
            <Input
              value={localGuard}
              onChange={(e) => setLocalGuard(e.target.value)}
              placeholder="Guard component name (e.g., PaymentSuccessGuard)"
              list="available-guards"
              className="text-sm font-mono"
            />
            <datalist id="available-guards">
              {availableGuards.map(guard => (
                <option key={guard} value={guard} />
              ))}
            </datalist>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                Edge Guard Behavior
              </span>
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
              <p>• Guard must pass for edge transition to occur</p>
              <p>• If guard fails, flow stops or tries alternative edges</p>
              <p>• Leave empty for unconditional transition</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Edge Condition */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-blue-500" />
          <h4 className="font-medium">Edge Condition</h4>
        </div>
        <div className="space-y-3">
          <Textarea
            value={localCondition}
            onChange={(e) => setLocalCondition(e.target.value)}
            placeholder="Optional condition description or expression"
            rows={3}
            className="text-sm"
          />
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Condition Notes
              </span>
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <p>• Descriptive text for documentation purposes</p>
              <p>• Not evaluated by engine (use guards for logic)</p>
              <p>• Helps with workflow understanding and maintenance</p>
            </div>
          </div>
        </div>
      </Card>


      {/* Guard Failure Handling */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <h4 className="font-medium">Guard Failure Handling</h4>
        </div>
        <div className="space-y-4">
          {/* Strategy Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Failure Strategy</label>
            <select 
              value={failureStrategy}
              onChange={(e) => setFailureStrategy(e.target.value as EdgeFailureStrategy)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="STOP">🛑 STOP - Halt workflow execution</option>
              <option value="SKIP">⏭️ SKIP - Skip target step, continue workflow</option>
              <option value="ALTERNATIVE">🔄 ALTERNATIVE - Go to different step</option>
              <option value="RETRY">♻️ RETRY - Retry this edge after delay</option>
              <option value="CONTINUE">➡️ CONTINUE - Continue despite failure</option>
            </select>
          </div>

          {/* Alternative Target (only for ALTERNATIVE strategy) */}
          {failureStrategy === 'ALTERNATIVE' && (
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <ArrowRight className="w-3 h-3" />
                Alternative Target Step
              </label>
              <Input
                value={alternativeTarget}
                onChange={(e) => setAlternativeTarget(e.target.value)}
                placeholder="Step name to redirect to on guard failure"
                list="available-steps-alt"
                className="text-sm font-mono"
              />
              <datalist id="available-steps-alt">
                {Object.keys(config.steps || {}).map(stepName => (
                  <option key={stepName} value={stepName} />
                ))}
              </datalist>
            </div>
          )}

          {/* Retry Configuration (only for RETRY strategy) */}
          {failureStrategy === 'RETRY' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <RotateCcw className="w-3 h-3" />
                  Retry Attempts
                </label>
                <Input
                  type="number"
                  value={retryAttempts}
                  onChange={(e) => setRetryAttempts(e.target.value)}
                  placeholder="3"
                  min="1"
                  max="10"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Retry Delay (ms)
                </label>
                <Input
                  type="number"
                  value={retryDelay}
                  onChange={(e) => setRetryDelay(e.target.value)}
                  placeholder="1000"
                  min="100"
                  max="30000"
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Strategy Explanation */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {failureStrategy === 'STOP' && 'Stop Strategy'}
                {failureStrategy === 'SKIP' && 'Skip Strategy'}
                {failureStrategy === 'ALTERNATIVE' && 'Alternative Strategy'}
                {failureStrategy === 'RETRY' && 'Retry Strategy'}
                {failureStrategy === 'CONTINUE' && 'Continue Strategy'}
              </span>
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
              {failureStrategy === 'STOP' && (
                <>
                  <p>• Workflow execution halts immediately</p>
                  <p>• No further steps are executed</p>
                  <p>• Use for critical guard failures</p>
                </>
              )}
              {failureStrategy === 'SKIP' && (
                <>
                  <p>• Target step is bypassed completely</p>
                  <p>• Workflow continues from next logical step</p>
                  <p>• Use for optional steps that can be skipped</p>
                </>
              )}
              {failureStrategy === 'ALTERNATIVE' && (
                <>
                  <p>• Flow redirects to specified alternative step</p>
                  <p>• Use for error handling or fallback logic</p>
                  <p>• Alternative step should handle the failure case</p>
                </>
              )}
              {failureStrategy === 'RETRY' && (
                <>
                  <p>• Same edge is retried after specified delay</p>
                  <p>• Useful for transient failures or rate limits</p>
                  <p>• After max attempts, falls back to STOP behavior</p>
                </>
              )}
              {failureStrategy === 'CONTINUE' && (
                <>
                  <p>• Guard failure is ignored, target step executes anyway</p>
                  <p>• Use when guard is advisory/logging only</p>
                  <p>• Workflow continues normally regardless</p>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default EdgePropertiesPanel