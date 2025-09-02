import { StepFlowConfig, WorkflowDef, EdgeDef, StepDef } from '../types/stepflow'

export interface DslParseResult {
  config?: StepFlowConfig
  errors: { line: number; message: string }[]
}

const trim = (s: string) => s.trim()

function parseScalar(raw: string): any {
  const s = raw.trim()
  if (s === 'true') return true
  if (s === 'false') return false
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  if (!isNaN(Number(s))) return Number(s)
  return s
}

function parseDuration(raw?: string): number | undefined {
  if (!raw) return undefined
  const m = raw.trim().match(/^(\d+)(ms|s|m)$/)
  if (!m) return undefined
  const n = parseInt(m[1], 10)
  const unit = m[2]
  if (unit === 'ms') return n
  if (unit === 's') return n * 1000
  if (unit === 'm') return n * 60_000
  return undefined
}

function setPath(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  cur[parts[parts.length - 1]] = value
}

function flatten(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const out: Record<string, any> = {}
  Object.entries(obj || {}).forEach(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = v
    }
  })
  return out
}

export function parseDSL(text: string): DslParseResult {
  console.log('DSL Parser - Starting to parse:', text.substring(0, 100) + '...')
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const cfg: StepFlowConfig = { settings: {}, defaults: {}, steps: {}, workflows: {} }
  const errors: { line: number; message: string }[] = []

  type Ctx = { type: 'root' } | { type: 'settings' } | { type: 'defaults' } | { type: 'workflow'; name: string } | { type: 'step'; name: string } | { type: 'step-config'; name: string }
  let ctx: Ctx = { type: 'root' }

  const edgeRe = /^\s*([A-Za-z_][\w]*)\s*->\s*([A-Za-z_][\w]*|SUCCESS|FAILURE)(?:\s*\?\s*([A-Za-z_][\w]*))?(?:\s*(?:fail|on\s+failure)\s*(?:(?:->\s*([A-Za-z_][\w]*))|(?:retry\s+(\d+)x(?:\s*\/\s*([0-9]+(?:ms|s|m)))?)|skip|stop|continue))?\s*$/i
  const kvRe = /^\s*([A-Za-z_][\w\.]*?)\s*=\s*(.+?)\s*$/
  const requiresRe = /^\s*requires:\s*(.+)\s*$/i
  const retryRe = /^\s*retry:\s*(\d+)x(?:\s*\/\s*([0-9]+(?:ms|s|m)))?(?:\s*\?\s*([A-Za-z_][\w]*))?\s*$/i

  const indentOf = (line: string) => line.match(/^\s*/)?.[0].length ?? 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    // section headers
    if (/^settings:\s*$/i.test(line)) { ctx = { type: 'settings' }; continue }
    if (/^defaults:\s*$/i.test(line)) { ctx = { type: 'defaults' }; continue }
    const wfMatch = line.match(/^workflow\s+([A-Za-z_][\w]*)\s*:\s*$/i)
    if (wfMatch) { ctx = { type: 'workflow', name: wfMatch[1] }; if (!cfg.workflows![wfMatch[1]]) cfg.workflows![wfMatch[1]] = { root: '', edges: [] }; continue }
    const stepMatch = line.match(/^step\s+([A-Za-z_][\w]*)\s*:\s*([A-Za-z_][\w\.]*)\s*$/i)
    if (stepMatch) {
      const [, name, type] = stepMatch
      if (!cfg.steps![name]) cfg.steps![name] = { type } as StepDef
      else cfg.steps![name].type = type
      ctx = { type: 'step', name }
      continue
    }

    // within contexts
    if (ctx.type === 'settings') {
      const m = raw.match(kvRe)
      if (!m) { errors.push({ line: i + 1, message: 'Expected key = value in settings' }); continue }
      const [, key, value] = m
      setPath(cfg.settings!, key, parseScalar(value))
      continue
    }

    if (ctx.type === 'defaults') {
      const m = raw.match(kvRe)
      if (!m) { errors.push({ line: i + 1, message: 'Expected key = value in defaults' }); continue }
      const [, key, value] = m
      // key can be step.timeout_ms or guard.log or ComponentName.key
      const [first, ...rest] = key.split('.')
      if (first === 'step' || first === 'guard') {
        cfg.defaults![first] = cfg.defaults![first] || {}
        setPath(cfg.defaults![first]!, rest.join('.'), parseScalar(value))
      } else {
        cfg.defaults![first] = (cfg.defaults![first] as any) || {}
        if (rest.length) setPath(cfg.defaults![first] as any, rest.join('.'), parseScalar(value))
        else (cfg.defaults as any)[first] = parseScalar(value)
      }
      continue
    }

    if (ctx.type === 'workflow') {
      if (/^root\s*:\s*[A-Za-z_][\w]*\s*$/i.test(line)) {
        const root = line.split(':')[1].trim()
        ;(cfg.workflows![ctx.name] as WorkflowDef).root = root
        continue
      }
      const m = raw.match(edgeRe)
      if (!m) { errors.push({ line: i + 1, message: 'Invalid edge syntax' }); continue }
      const [, from, to, guard, altTarget, retryCount, retryDelay] = m
      console.log('DSL Parser - Edge match:', { line: raw.trim(), groups: { from, to, guard, altTarget, retryCount, retryDelay } })
      const edge: EdgeDef = { from, to, guard: guard || undefined }
      const tail = line.replace(/^.*?(\?|$)/, '').trim() // after '?' or nothing
      console.log('DSL Parser - Checking failure condition:', { line: raw.trim(), hasFailure: /\b(on\s+failure|fail)\b/i.test(line) })
      if (/\b(on\s+failure|fail)\b/i.test(line)) {
        console.log('DSL Parser - Inside failure block, checking arrow:', { line: raw.trim(), hasArrow: /\b->\b/i.test(line) })
        if (/(?:fail|on\s+failure)\s*->/i.test(line)) {
          // Extract alternative target from the line after "fail ->"
          const altMatch = line.match(/(?:fail|on\s+failure)\s*->\s*([A-Za-z_][\w]*)/i)
          const alternativeTarget = altMatch ? altMatch[1] : altTarget
          console.log('DSL Parser - Alternative failure detected:', { line, altMatch, alternativeTarget, altTarget })
          edge.onFailure = { strategy: 'ALTERNATIVE', alternativeTarget }
        } else if (/\bretry\b/i.test(line)) {
          edge.onFailure = { strategy: 'RETRY', retryAttempts: retryCount ? parseInt(retryCount, 10) : 1, retryDelay: parseDuration(retryDelay) }
        } else if (/\bskip\b/i.test(line)) {
          edge.onFailure = { strategy: 'SKIP' }
        } else if (/\bstop\b/i.test(line)) {
          edge.onFailure = { strategy: 'STOP' }
        } else if (/\bcontinue\b/i.test(line)) {
          edge.onFailure = { strategy: 'CONTINUE' }
        }
      }
      ;(cfg.workflows![ctx.name] as WorkflowDef).edges.push(edge)
      console.log('DSL Parser - Final edge added:', edge)
      continue
    }

    if (ctx.type === 'step') {
      if (/^config:\s*$/i.test(line)) { ctx = { type: 'step-config', name: ctx.name }; continue }
      const rm = raw.match(requiresRe)
      if (rm) {
        const parts = rm[1].split(',').map(s => s.trim()).filter(Boolean)
        cfg.steps![ctx.name] = cfg.steps![ctx.name] || { type: '' }
        ;(cfg.steps![ctx.name] as StepDef).guards = parts
        continue
      }
      const rtm = raw.match(retryRe)
      if (rtm) {
        const [, count, delayStr, guard] = rtm
        cfg.steps![ctx.name] = cfg.steps![ctx.name] || { type: '' }
        ;(cfg.steps![ctx.name] as StepDef).retry = { maxAttempts: parseInt(count, 10), delay: parseDuration(delayStr) || 0, guard: guard || undefined }
        continue
      }
      errors.push({ line: i + 1, message: 'Unknown step directive' })
      continue
    }

    if (ctx.type === 'step-config') {
      if (raw.trim().endsWith(':')) { errors.push({ line: i + 1, message: 'Nested blocks not supported in config' }); continue }
      const m = raw.match(kvRe)
      if (!m) { errors.push({ line: i + 1, message: 'Expected key = value in config' }); continue }
      const [, key, value] = m
      cfg.steps![ctx.name] = cfg.steps![ctx.name] || { type: '' }
      const step = cfg.steps![ctx.name] as StepDef
      step.config = step.config || {}
      setPath(step.config, key, parseScalar(value))
      continue
    }

    errors.push({ line: i + 1, message: 'Unknown syntax' })
  }

  // Post-process: ensure steps exist for any referenced names in workflows
  try {
    const referenced = new Set<string>()
    const workflows = cfg.workflows || {}
    for (const wf of Object.values(workflows)) {
      const w = wf as WorkflowDef
      if (w?.root && w.root !== 'SUCCESS' && w.root !== 'FAILURE') referenced.add(w.root)
      for (const e of (w?.edges || [])) {
        if (e.from && e.from !== 'SUCCESS' && e.from !== 'FAILURE') referenced.add(e.from)
        if (e.to && e.to !== 'SUCCESS' && e.to !== 'FAILURE') referenced.add(e.to)
        if (e.onFailure?.strategy === 'ALTERNATIVE' && e.onFailure.alternativeTarget) {
          const t = e.onFailure.alternativeTarget
          if (t !== 'SUCCESS' && t !== 'FAILURE') referenced.add(t)
        }
      }
    }
    cfg.steps = cfg.steps || {}
    for (const name of referenced) {
      if (!cfg.steps[name]) cfg.steps[name] = { type: name } as StepDef
    }
  } catch {
    // best-effort; ignore
  }

  return { config: cfg, errors }
}

export function stringifyDSL(config: StepFlowConfig): string {
  const result: string[] = []
  const push = (s: string) => { result.push(s) }
  const { settings = {}, defaults = {}, steps = {}, workflows = {} } = config || {}

  // settings
  if (Object.keys(settings).length > 0) {
    push('settings:')
    const flatSettings = flatten(settings)
    for (const [k, v] of Object.entries(flatSettings)) push(`  ${k} = ${formatScalar(v)}`)
    push('')
  }

  // defaults
  if (Object.keys(defaults).length > 0) {
    push('defaults:')
    const { step = {}, guard = {}, ...named } = defaults
    const flatStep = flatten(step)
    const flatGuard = flatten(guard)
    for (const [k, v] of Object.entries(flatStep)) push(`  step.${k} = ${formatScalar(v)}`)
    for (const [k, v] of Object.entries(flatGuard)) push(`  guard.${k} = ${formatScalar(v)}`)
    for (const [name, obj] of Object.entries(named)) {
      const flat = flatten(obj as any)
      for (const [k, v] of Object.entries(flat)) push(`  ${name}.${k} = ${formatScalar(v)}`)
    }
    push('')
  }

  // workflows
  for (const [wfName, wf] of Object.entries(workflows)) {
    push(`workflow ${wfName}:`)
    if ((wf as any)?.root) push(`  root: ${(wf as any).root}`)
    for (const edge of ((wf as any)?.edges || [])) push(`  ${formatEdge(edge)}`)
    push('')
  }

  // steps
  for (const [name, step] of Object.entries(steps)) {
    push(`step ${name}: ${(step as any)?.type}`)
    const guards = (step as any)?.guards as string[] | undefined
    if (guards && guards.length > 0) push(`  requires: ${guards.join(', ')}`)
    const retry = (step as any)?.retry
    if (retry) {
      const d = retry.delay || 0
      const dur = d % 60000 === 0 ? `${d / 60000}m` : d % 1000 === 0 ? `${d / 1000}s` : `${d}ms`
      push(`  retry: ${retry.maxAttempts}x / ${dur}${retry.guard ? ` ? ${retry.guard}` : ''}`)
    }
    const cfg = (step as any)?.config || {}
    if (cfg && Object.keys(cfg).length > 0) {
      push('  config:')
      const flatCfg = flatten(cfg)
      for (const [k, v] of Object.entries(flatCfg)) push(`    ${k} = ${formatScalar(v)}`)
    }
    push('')
  }

  return result.join('\n').trim() + '\n'
}

function formatScalar(v: any): string {
  if (typeof v === 'string') {
    if (/^[-A-Za-z0-9_.]+$/.test(v)) return v
    return JSON.stringify(v)
  }
  return String(v)
}

function formatEdge(edge: EdgeDef): string {
  const base = `${edge.from} -> ${edge.to}`
  const guard = edge.guard ? ` ? ${edge.guard}` : ''
  let fail = ''
  const of = edge.onFailure
  if (of) {
    if (of.strategy === 'ALTERNATIVE') fail = ` fail -> ${of.alternativeTarget}`
    else if (of.strategy === 'RETRY') {
      const d = of.retryDelay || 0
      const dur = d ? (d % 60000 === 0 ? `${d / 60000}m` : d % 1000 === 0 ? `${d / 1000}s` : `${d}ms`) : ''
      fail = ` fail retry ${of.retryAttempts || 1}x${dur ? ` / ${dur}` : ''}`
    } else if (of.strategy === 'SKIP') fail = ' fail skip'
    else if (of.strategy === 'STOP') fail = ' fail stop'
    else if (of.strategy === 'CONTINUE') fail = ' fail continue'
  }
  return `${base}${guard}${fail}`
}
