import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Shield, CheckCircle, XCircle, Edit3, AlertTriangle } from 'lucide-react'
import { GuardNodeData } from '../../types/stepflow'
import { cn } from '../../lib/utils'

const GuardNode: React.FC<NodeProps<GuardNodeData>> = ({ data, selected }) => {
  const hasIssues = data.issues && data.issues.length > 0
  const errorCount = data.issues?.filter(issue => issue.type === 'error').length || 0
  const warningCount = data.issues?.filter(issue => issue.type === 'warning').length || 0
  const accent = (data as any).reqColor as string | undefined
  return (
    <div
      style={accent ? { borderColor: accent } : undefined}
      className={cn(
        'relative min-w-[180px] rounded-lg border-2 shadow-sm transition-all duration-200',
        hasIssues && errorCount > 0 
          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
          : hasIssues && warningCount > 0
          ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
          : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700',
        selected ? 'ring-2 ring-orange-500 ring-opacity-50' : '',
        'hover:shadow-md'
      )}
    >
      {accent && <div className="absolute left-0 top-0 h-1 w-full rounded-t" style={{ background: accent }} />}
      {/* Edit Button Overlay */}
      <button
        className="absolute -right-2 -top-2 z-10 h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-card shadow hover:bg-accent"
        title="Edit"
        onClick={(e) => { e.stopPropagation(); (data as any)?.onEdit?.(data.id) }}
      >
        <Edit3 className="w-4 h-4" />
      </button>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-400 border-2 border-white"
      />

      {/* Node Content */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
            {data.label || data.id}
          </span>
          {hasIssues && errorCount > 0 && (
            <XCircle className="w-4 h-4 text-red-500" title="Guard has validation errors" />
          )}
        </div>

        {/* Condition */}
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          <code className="bg-orange-100 dark:bg-orange-800/30 px-1 rounded text-orange-700 dark:text-orange-300">
            {data.condition}
          </code>
        </div>

        <div className="text-xs text-orange-600 dark:text-orange-400">
          Guard Condition
        </div>

        {/* Validation Issues */}
        {hasIssues && (
          <div className={cn(
            'mt-2 rounded p-2',
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
              {data.issues!.slice(0, 2).map((issue, i) => (
                <div key={i} className={cn(
                  'text-xs',
                  issue.type === 'error' 
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                )}>
                  {issue.message}
                </div>
              ))}
              {data.issues!.length > 2 && (
                <div className="text-xs text-gray-500">+{data.issues!.length - 2} more issues</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Output Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={{ top: '30%' }}
        className="w-3 h-3 bg-green-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="failure"
        style={{ top: '70%' }}
        className="w-3 h-3 bg-red-400 border-2 border-white"
      />

      {/* Handle Labels */}
      <div className="absolute -right-12 top-[25%] text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        True
      </div>
      <div className="absolute -right-12 top-[65%] text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        False
      </div>
    </div>
  )
}

export default GuardNode
