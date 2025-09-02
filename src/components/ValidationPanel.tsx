import React, { useState, useEffect } from 'react'
import { Node, Edge } from 'reactflow'
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  TrendingUp,
  Filter,
  Zap,
  Settings,
  X
} from 'lucide-react'
import { Button } from './ui/button'
import { WorkflowValidationEngine, ValidationResult, ValidationIssue } from '../lib/validation-engine'

interface ValidationPanelProps {
  nodes: Node[]
  edges: Edge[]
  activeRequest?: string
  onNodeSelect?: (nodeId: string) => void
  onEdgeSelect?: (edgeId: string) => void
  onAutoFix?: (issue: ValidationIssue) => void
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({
  nodes,
  edges,
  activeRequest,
  onNodeSelect,
  onEdgeSelect,
  onAutoFix
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null)
  const [autoFixInProgress, setAutoFixInProgress] = useState<Set<string>>(new Set())

  // Run validation when nodes or edges change
  useEffect(() => {
    const result = WorkflowValidationEngine.validateWorkflow(nodes, edges, activeRequest)
    setValidationResult(result)
  }, [nodes, edges, activeRequest])

  if (!validationResult) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Settings className="w-6 h-6 mx-auto mb-2 animate-spin" />
        <p>Analyzing workflow...</p>
      </div>
    )
  }

  const { issues, score, isValid } = validationResult

  // Filter issues based on selected filters
  const filteredIssues = issues.filter(issue => {
    if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false
    if (selectedType !== 'all' && issue.type !== selectedType) return false
    return true
  })

  const handleAutoFix = async (issue: ValidationIssue) => {
    if (!issue.autoFix || !onAutoFix) return
    
    setAutoFixInProgress(prev => new Set(prev).add(issue.id))
    
    try {
      await onAutoFix(issue)
      // Issue should be resolved after auto-fix, so it will disappear from the list
    } catch (error) {
      console.error('Auto-fix failed:', error)
    } finally {
      setAutoFixInProgress(prev => {
        const next = new Set(prev)
        next.delete(issue.id)
        return next
      })
    }
  }

  const getIssueIcon = (type: ValidationIssue['type']) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getCategoryIcon = (category: ValidationIssue['category']) => {
    switch (category) {
      case 'structure':
        return '🏗️'
      case 'configuration':
        return '⚙️'
      case 'logic':
        return '🧠'
      case 'performance':
        return '⚡'
      default:
        return '📝'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400'
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 50) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Fair'
    return 'Needs Work'
  }

  const errorCount = issues.filter(i => i.type === 'error').length
  const warningCount = issues.filter(i => i.type === 'warning').length
  const infoCount = issues.filter(i => i.type === 'info').length

  return (
    <div className="h-full flex flex-col bg-card">
      
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            {isValid ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            Workflow Analysis
          </h3>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className={`font-medium ${getScoreColor(score)}`}>
              {score}/100
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${getScoreColor(score)} bg-current bg-opacity-10`}>
              {getScoreBadge(score)}
            </span>
          </div>
        </div>

        {/* Issue Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={`p-2 rounded ${errorCount > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'}`}>
            <div className={`text-lg font-bold ${errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {errorCount}
            </div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          <div className={`p-2 rounded ${warningCount > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-muted'}`}>
            <div className={`text-lg font-bold ${warningCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
              {warningCount}
            </div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
          <div className={`p-2 rounded ${infoCount > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted'}`}>
            <div className={`text-lg font-bold ${infoCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
              {infoCount}
            </div>
            <div className="text-xs text-muted-foreground">Info</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs rounded border border-input bg-background px-2 py-1"
          >
            <option value="all">All Types</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded border border-input bg-background px-2 py-1"
          >
            <option value="all">All Categories</option>
            <option value="structure">Structure</option>
            <option value="configuration">Configuration</option>
            <option value="logic">Logic</option>
            <option value="performance">Performance</option>
          </select>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-auto">
        {filteredIssues.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {issues.length === 0 
                ? "No issues found! Your workflow looks great." 
                : `No issues match the current filters.`
              }
            </p>
            {selectedCategory !== 'all' || selectedType !== 'all' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedCategory('all')
                  setSelectedType('all')
                }}
                className="mt-2"
              >
                Clear Filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className="border border-border rounded-lg overflow-hidden hover:border-border/80 transition-colors"
              >
                <div
                  className="p-3 cursor-pointer flex items-start gap-3"
                  onClick={() => setExpandedIssue(
                    expandedIssue === issue.id ? null : issue.id
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getIssueIcon(issue.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm text-foreground">
                          {issue.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getCategoryIcon(issue.category)} {issue.category}
                          {issue.nodeId && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">
                              Node: {issue.nodeId}
                            </span>
                          )}
                          {issue.edgeId && (
                            <span className="ml-2 text-purple-600 dark:text-purple-400">
                              Edge: {issue.edgeId}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {issue.nodeId && onNodeSelect && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              onNodeSelect(issue.nodeId!)
                            }}
                            className="h-6 w-6 p-0"
                            title="Select node"
                          >
                            <Zap className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {issue.autoFix && onAutoFix && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAutoFix(issue)
                            }}
                            disabled={autoFixInProgress.has(issue.id)}
                            className="h-6 px-2 text-xs"
                            title="Auto-fix issue"
                          >
                            {autoFixInProgress.has(issue.id) ? (
                              <Settings className="w-3 h-3 animate-spin" />
                            ) : (
                              'Fix'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {expandedIssue === issue.id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground mb-2">
                          {issue.description}
                        </p>
                        {issue.suggestion && (
                          <div className="bg-muted rounded p-2">
                            <p className="text-xs font-medium mb-1">💡 Suggestion:</p>
                            <p className="text-xs text-muted-foreground">
                              {issue.suggestion}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button className="text-muted-foreground hover:text-foreground">
                    <X className={`w-4 h-4 transition-transform ${expandedIssue === issue.id ? 'rotate-45' : ''}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground text-center">
          {WorkflowValidationEngine.getValidationSummary(validationResult)}
          {activeRequest && (
            <div className="mt-1">Request: <span className="font-medium">{activeRequest}</span></div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ValidationPanel