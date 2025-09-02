import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { AlertTriangle, CheckCircle, Info, XCircle, Filter } from 'lucide-react'
import { ValidationIssue } from '../types/stepflow'

export interface IssuesPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stepIssues: Record<string, ValidationIssue[]>
  workflowIssues?: Array<{ workflow: string; issues: ValidationIssue[] }>
}

type Severity = 'all' | 'error' | 'warning' | 'info'

export const IssuesPanel: React.FC<IssuesPanelProps> = ({ open, onOpenChange, stepIssues, workflowIssues = [] }) => {
  const [filter, setFilter] = useState<Severity>('all')
  const [showWorkflows, setShowWorkflows] = useState(true)
  const [showSteps, setShowSteps] = useState(true)

  const allStepEntries = useMemo(() => Object.entries(stepIssues), [stepIssues])
  const flatStepIssues = useMemo(() => allStepEntries.flatMap(([id, issues]) => issues.map(i => ({ id, issue: i }))), [allStepEntries])
  const flatWorkflowIssues = useMemo(() => workflowIssues.flatMap(wf => wf.issues.map(i => ({ workflow: wf.workflow, issue: i }))), [workflowIssues])

  const filterMatch = (t: string) => filter === 'all' || t === filter

  const counts = useMemo(() => {
    const all = [...flatStepIssues.map(x => x.issue), ...flatWorkflowIssues.map(x => x.issue)]
    return {
      error: all.filter(i => i.type === 'error').length,
      warning: all.filter(i => i.type === 'warning').length,
      info: all.filter(i => i.type === 'info').length,
    }
  }, [flatStepIssues, flatWorkflowIssues])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Issues
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs">
            <Button size="sm" variant={filter==='all' ? 'default' : 'outline'} className="h-7" onClick={() => setFilter('all')}>
              <Filter className="w-3 h-3 mr-1" /> All
            </Button>
            <Button size="sm" variant={filter==='error' ? 'default' : 'outline'} className="h-7" onClick={() => setFilter('error')}>
              <XCircle className="w-3 h-3 mr-1 text-red-600" /> {counts.error}
            </Button>
            <Button size="sm" variant={filter==='warning' ? 'default' : 'outline'} className="h-7" onClick={() => setFilter('warning')}>
              <AlertTriangle className="w-3 h-3 mr-1 text-yellow-600" /> {counts.warning}
            </Button>
            <Button size="sm" variant={filter==='info' ? 'default' : 'outline'} className="h-7" onClick={() => setFilter('info')}>
              <Info className="w-3 h-3 mr-1 text-blue-600" /> {counts.info}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showWorkflows} onChange={e => setShowWorkflows(e.target.checked)} /> Workflows
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showSteps} onChange={e => setShowSteps(e.target.checked)} /> Steps
            </label>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto space-y-4">
          {showWorkflows && (
            <div>
              <div className="text-sm font-medium mb-2">Workflow Issues</div>
              {workflowIssues.length === 0 && <div className="text-xs text-muted-foreground">No workflow issues</div>}
              <div className="space-y-2">
                {workflowIssues.map(group => (
                  <div key={group.workflow} className="border rounded p-2">
                    <div className="text-sm font-medium mb-1">{group.workflow}</div>
                    {group.issues.filter(i => filterMatch(i.type)).map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                        {issue.type === 'error' && <XCircle className="w-3 h-3 text-red-600 mt-0.5" />}
                        {issue.type === 'warning' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5" />}
                        {issue.type === 'info' && <Info className="w-3 h-3 text-blue-600 mt-0.5" />}
                        <div>
                          <div className="font-medium capitalize">{issue.type}</div>
                          <div>{issue.message}</div>
                          {issue.location && <div className="font-mono opacity-70">{issue.location}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showSteps && (
            <div>
              <div className="text-sm font-medium mb-2">Step Issues</div>
              {allStepEntries.length === 0 && <div className="text-xs text-muted-foreground">No step issues</div>}
              <div className="space-y-2">
                {allStepEntries.map(([stepId, issues]) => (
                  <div key={stepId} className="border rounded p-2">
                    <div className="text-sm font-medium mb-1">{stepId}</div>
                    {issues.filter(i => filterMatch(i.type)).map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                        {issue.type === 'error' && <XCircle className="w-3 h-3 text-red-600 mt-0.5" />}
                        {issue.type === 'warning' && <AlertTriangle className="w-3 h-3 text-yellow-600 mt-0.5" />}
                        {issue.type === 'info' && <Info className="w-3 h-3 text-blue-600 mt-0.5" />}
                        <div>
                          <div className="font-medium capitalize">{issue.type}</div>
                          <div>{issue.message}</div>
                          {issue.location && <div className="font-mono opacity-70">{issue.location}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default IssuesPanel

