import React, { useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Settings, Shield, RotateCcw, CheckCircle, XCircle, Edit3, AlertTriangle, Clock, Zap, ChevronDown, ChevronRight } from 'lucide-react'
import { StepNodeData, ValidationIssue } from '../../types/stepflow'
import { cn } from '../../lib/utils'

const StepNode: React.FC<NodeProps<StepNodeData>> = ({ data, selected }) => {
  const isRoot = data.isRoot
  const isTerminal = data.isTerminal
  const hasRetry = data.retry && data.retry.maxAttempts > 1
  const hasGuards = data.guards && data.guards.length > 0
  const hasConfig = data.config && Object.keys(data.config).length > 0
  const hasIssues = data.issues && data.issues.length > 0
  const errorCount = data.issues?.filter(issue => issue.type === 'error').length || 0
  const warningCount = data.issues?.filter(issue => issue.type === 'warning').length || 0
  
  // Single collapsible details state
  const [showDetails, setShowDetails] = useState(false)
  
  const toggleDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDetails(prev => !prev)
  }

  const accent = (data as any).reqColor as string | undefined
  const getNodeStyle = () => {
    if (hasIssues && errorCount > 0) {
      return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
    }
    if (hasIssues && warningCount > 0) {
      return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
    }
    if (isTerminal) {
      const isSuccess = data.label?.toUpperCase().includes('SUCCESS')
      return isSuccess 
        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
    }
    if (isRoot) {
      return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
    }
    return 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-600'
  }

  const getIconColor = () => {
    if (hasIssues && errorCount > 0) return 'text-red-600 dark:text-red-400'
    if (hasIssues && warningCount > 0) return 'text-yellow-600 dark:text-yellow-400'
    if (isTerminal) {
      const isSuccess = data.label?.toUpperCase().includes('SUCCESS')
      return isSuccess 
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400'
    }
    if (isRoot) return 'text-blue-600 dark:text-blue-400'
    return 'text-gray-600 dark:text-gray-400'
  }
  
  const getMainIcon = () => {
    if (hasIssues && errorCount > 0) return <XCircle className={cn('w-5 h-5', getIconColor())} />
    if (hasIssues && warningCount > 0) return <AlertTriangle className={cn('w-5 h-5', getIconColor())} />
    if (isTerminal) {
      const isSuccess = data.label?.toUpperCase().includes('SUCCESS')
      return isSuccess 
        ? <CheckCircle className={cn('w-5 h-5', getIconColor())} />
        : <XCircle className={cn('w-5 h-5', getIconColor())} />
    }
    if (isRoot) return <Zap className={cn('w-5 h-5', getIconColor())} />
    return <Settings className={cn('w-4 h-4', getIconColor())} />
  }

  const traceHighlight = (data as any).traceHighlight as boolean | undefined
  const traceDim = (data as any).traceDim as boolean | undefined
  const traceRole = (data as any).traceRole as ('source' | 'target') | undefined

  const getTraceClass = () => {
    if (!traceHighlight) return ''
    if (traceRole === 'source') return 'ring-2 ring-blue-500 ring-opacity-70 scale-[1.02] z-10'
    if (traceRole === 'target') return 'ring-2 ring-green-500 ring-opacity-70 scale-[1.02] z-10'
    return 'ring-2 ring-amber-500 ring-opacity-60 scale-[1.02] z-10'
  }

  return (
    <div
      style={accent ? { borderColor: accent } : undefined}
      className={cn(
        'relative min-w-[220px] rounded-lg border-2 shadow-sm transition-all duration-200',
        getNodeStyle(),
        selected ? 'ring-2 ring-blue-500 ring-opacity-50' : '',
        getTraceClass(),
        traceDim ? 'opacity-40 grayscale-[25%]' : '',
        'hover:shadow-md'
      )}
    >
      {/* Trace role badges */}
      {traceRole === 'source' && (
        <div className="absolute left-1 top-1 rounded px-1 py-0.5 text-[10px] font-bold bg-blue-600 text-white shadow">FROM</div>
      )}
      {traceRole === 'target' && (
        <div className="absolute left-1 top-1 rounded px-1 py-0.5 text-[10px] font-bold bg-green-600 text-white shadow">TO</div>
      )}
      {accent && <div className="absolute left-0 top-0 h-1 w-full rounded-t" style={{ background: accent }} />}
      {/* Edit Button Overlay */}
      <button
        className="absolute -right-2 -top-2 z-10 h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-card shadow hover:bg-accent"
        title="Edit"
        onClick={(e) => { e.stopPropagation(); data.onEdit?.(data.id) }}
      >
        <Edit3 className="w-4 h-4" />
      </button>
      {/* Input Handle */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-gray-400 border-2 border-white"
        />
      )}

      {/* Node Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getMainIcon()}
            <div className="flex flex-col">
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {data.label || data.id}
              </span>
              {(isRoot || isTerminal) && (
                <span className="text-xs text-muted-foreground">
                  {isRoot && 'Root Step'}
                  {isTerminal && 'Terminal'}
                </span>
              )}
            </div>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center gap-1">
            {hasGuards && (
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-orange-500" title={`Guards: ${data.guards!.join(', ')}`} />
                <span className="text-xs text-orange-600 dark:text-orange-400">
                  {data.guards!.length}
                </span>
              </div>
            )}
            {hasRetry && (
              <div className="flex items-center gap-1">
                <RotateCcw 
                  className="w-4 h-4 text-blue-500" 
                  title={`Retry: ${data.retry!.maxAttempts}x, ${data.retry!.delay}ms${data.retry!.guard ? ` (Guard: ${data.retry!.guard})` : ''}`} 
                />
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {data.retry!.maxAttempts}x
                </span>
              </div>
            )}
            {hasConfig && (
              <div className="flex items-center gap-1">
                <Settings className="w-4 h-4 text-gray-500" title="Has configuration" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {Object.keys(data.config!).length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Type and Component Info */}
        <div className="mb-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Type: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">{data.type}</code>
          </div>
          {data.workflow && (
            <div className="text-xs text-purple-600 dark:text-purple-400">
              Workflow: {data.workflow}
            </div>
          )}
        </div>

        {/* Single Collapsible Details Section */}
        {(hasGuards || hasRetry || hasConfig || hasIssues) && (
          <div className="border-t border-border/50">
            <button 
              className="w-full py-2 flex items-center justify-between hover:bg-accent/50 rounded transition-colors"
              onClick={toggleDetails}
            >
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Settings className="w-3 h-3" />
                Details
              </div>
              {showDetails ? 
                <ChevronDown className="w-3 h-3 text-muted-foreground" /> : 
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              }
            </button>
            
            {showDetails && (
              <div className="space-y-2 pb-2">
                {/* Guards Detail */}
                {hasGuards && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded p-2">
                    <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Step Guards ({data.guards!.length})
                    </div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">
                      {data.guards!.map((guard, i) => (
                        <div key={i} className="font-mono">{guard}</div>
                      ))}
                    </div>
                    <div className="text-xs text-orange-500 dark:text-orange-500 mt-1">
                      All must pass (AND logic)
                    </div>
                  </div>
                )}
      
                {/* Retry Detail */}
                {hasRetry && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      Retry Policy
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Max Attempts:</span>
                        <span className="font-mono">{data.retry!.maxAttempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delay:</span>
                        <span className="font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {data.retry!.delay}ms
                        </span>
                      </div>
                      {data.retry!.guard && (
                        <div className="flex justify-between">
                          <span>Guard:</span>
                          <span className="font-mono">{data.retry!.guard}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
      
                {/* Config Preview */}
                {hasConfig && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-2">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                      <Settings className="w-3 h-3" />
                      Configuration ({Object.keys(data.config!).length})
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      {Object.entries(data.config!).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-mono">{key}:</span>
                          <span className="font-mono text-gray-500 truncate max-w-20">
                            {JSON.stringify(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
      
                {/* Validation Issues */}
                {hasIssues && (
                  <div className={cn(
                    'rounded p-2',
                    errorCount > 0 
                      ? 'bg-red-50 dark:bg-red-900/20' 
                      : 'bg-yellow-50 dark:bg-yellow-900/20'
                  )}>
                    <div className={cn(
                      'text-xs font-medium mb-1 flex items-center gap-1',
                      errorCount > 0
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-yellow-700 dark:text-yellow-300'
                    )}>
                      {errorCount > 0 ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      Issues ({data.issues!.length})
                    </div>
                    <div className="space-y-1">
                      {data.issues!.map((issue, i) => (
                        <div key={i} className={cn(
                          'text-xs',
                          issue.type === 'error' 
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        )}>
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output Handle */}
      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-gray-400 border-2 border-white hover:bg-gray-600"
        />
      )}
    </div>
  )
}

export default StepNode
