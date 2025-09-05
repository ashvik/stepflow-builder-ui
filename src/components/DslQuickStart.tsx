import React, { useMemo } from 'react'
import { DslHighlighter } from '../lib/dsl-highlighter'

const example = `# StepFlow DSL Quick Start (comprehensive example)
# Shows DSL syntax (not YAML) for settings, defaults, steps, guards, workflows.

settings:
  env = "dev"
  timeout_ms = 30000
  featureFlags.enableValidation = true

defaults:
  step.retry.maxAttempts = 3
  step.retry.delay = 1000
  guard.caching = true

# Define workflows using edge syntax:
#   from -> to ? Guard  fail -> alternativeTarget
#   from -> to ? Guard  fail retry 2x / 1s
#   from -> to ? Guard  fail skip|stop|continue
workflow orderFlow:
  root: validate
  validate -> processPayment
  processPayment -> allocateInventory ? PaymentAvailable fail -> manualReview
  allocateInventory -> sendConfirmation ? HighOrderValue fail retry 2x / 1000ms
  sendConfirmation -> SUCCESS
  manualReview -> FAILURE

# Second workflow covering remaining failure strategies
workflow refundFlow:
  root: validate
  validate -> processPayment ? PaymentAvailable fail skip
  processPayment -> sendConfirmation ? HighOrderValue fail continue
  sendConfirmation -> SUCCESS

# Steps library with type, step-level guards (requires), retry, and config block
step validate: ValidateOrderStep
  requires: AuthGuard, RateLimitGuard
  retry: 5x / 2000ms ? ShouldRetry
  config:
    strictMode = true
    maxItems = 50

step processPayment: ProcessPaymentStep
  config:
    gateway = stripe
    currency = USD

step allocateInventory: AllocateInventoryStep

step sendConfirmation: SendConfirmationStep
  config:
    template = "order-confirmation"

step manualReview: ManualReviewStep

# Example: step-level retry without retry-guard
step enrichData: EnrichDataStep
  # Retries 3 times with 1.5s delay; no retry guard
  retry: 3x / 1500ms
  config:
    mode = safe

# Referenced guards can be provided as components in your codebase:
#   AuthGuard, RateLimitGuard, ShouldRetry, PaymentAvailable, HighOrderValue

# Notes
# - Step-level guards: \`requires:\` (AND logic).
# - Edge-level guards: after \`?\` on an edge.
# - Failure strategies:
#   STOP | SKIP | CONTINUE | RETRY Nx / <duration> | ALTERNATIVE via \`fail -> target\`.
# - Duration units: ms, s, m (e.g., 500ms, 2s, 1m).
`

const DslQuickStart: React.FC = () => {
  const highlighted = useMemo(() => DslHighlighter.highlight(example), [])
  return (
    <div className="h-full w-full overflow-auto">
      <div className="p-3">
        <div className="mb-2">
          <div className="text-sm text-muted-foreground">Quick Start • DSL reference with comments</div>
          <div className="text-xs text-muted-foreground">Covers settings, defaults, steps, step guards, edge guards, all failure strategies, workflows, terminals.</div>
        </div>
        <pre className="p-3 text-sm font-mono bg-muted/30 rounded-lg overflow-auto border border-border">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  )
}

export default DslQuickStart
