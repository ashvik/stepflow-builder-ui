# StepFlow Builder UI

Visual workflow builder for the StepFlow engine with YAML and DSL authoring, validation, auto-layout, and advanced editing tools.

## Overview

- Build workflows visually with React Flow nodes and edges
- Author in multiple formats: simplified WORKFLOW YAML, full TRADITIONAL FlowConfig YAML, and a concise StepFlow DSL (V4)
- Validate, simulate, and export/import configurations with rich tooling

## Key Features

- **Visual Designer**: Drag-and-drop steps, guards, terminals; zoom/pan; improved edge handling
- **Multi-format I/O**: Import/export WORKFLOW YAML, TRADITIONAL YAML, and DSL with validation and helpful errors
- **Request Manager**: Manage multiple requests, search/filter, drag-and-drop reordering, bulk export/delete, metadata and templates
- **Validation Engine**: Real-time issues (errors/warnings/suggestions), clickable navigation, quality score, auto-fix suggestions
- **Auto Layouts**: Hierarchical, Force-Directed, Circular, Tree, and Grid with recommendations and auto-fit
- **Undo/Redo**: Full history with keyboard shortcuts and action descriptions; optional persistence
- **Themes**: Dark/Light with system preference detection
- **Export/Import**: Download/upload YAML or DSL files directly from the UI
- **Extras**: Yaml tree viewer, DSL syntax highlighting, basic simulation tools, optional collaboration panel

## Node Types

- **Root/Regular/Terminal Steps**: Configurable nodes with types, config, guards, and retry policies
- **Guard Nodes**: Conditional evaluation (success/failure branches)

## YAML & DSL Formats

### WORKFLOW (Simplified YAML)
```yaml
workflows:
  simple-process:
    - validate
    - processPayment
    - sendNotification

defaults:
  processPayment:
    gateway: "stripe"
    timeout_ms: 5000
```

### TRADITIONAL (Full FlowConfig YAML)
```yaml
steps:
  validate:
    type: "ValidateStep"
    config:
      timeout_ms: 5000

requests:
  simple-process:
    root: "validate"
    edges:
      - from: "validate"
        to: "processPayment"
      - from: "processPayment"
        to: "SUCCESS"
        kind: "terminal"
```

### StepFlow DSL (V4)
```text
settings:
  timeout = 30000

workflow OrderProcess:
  root: ValidateOrder
  ValidateOrder -> ProcessPayment
  ProcessPayment -> SUCCESS

step ValidateOrder: ValidationStep
  config:
    strict = true
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm (or yarn/pnpm)

### Install & Run
```bash
npm install
npm run dev     # start Vite dev server
npm run build   # type-check + production build
npm run preview # preview production build
```

## Versions / Editions

- **V1 (Original)**: Baseline workflow builder
- **V2 (Multi-Tab)**: Multiple workflow tabs and requests
- **V3 (Ultimate)**: Enhanced panels, YAML tools, more controls
- **V4 (DSL Edition)**: Adds DSL authoring, advanced validation/layouts, and improved UX

Current default render is V4 (see `src/main.tsx`). The URL parameter `?version=` is parsed but the automatic switcher and version banner are commented out and the app mounts `AppV4` directly. To enable runtime switching:
- Uncomment `VersionBanner` and conditional rendering in `src/main.tsx`
- Or replace the hardcoded `<AppV4 />` with logic using `currentVersion`

## App Structure

```
src/
├── App.tsx            # V1
├── AppV2.tsx          # V2
├── AppV3.tsx          # V3
├── AppV4.tsx          # V4 (DSL Edition)
├── components/
│   ├── DslEditor.tsx, DslViewer.tsx, DslQuickStart.tsx
│   ├── YamlViewer.tsx, YamlTreeView.tsx
│   ├── RequestManager.tsx, WorkflowManager.tsx
│   ├── ValidationPanel.tsx, IssuesPanel.tsx, DebugPanel.tsx
│   ├── SimulationPanel.tsx, CollaborationPanel.tsx
│   └── ui/ ...
├── lib/
│   ├── dsl-converter.ts, dsl-highlighter.ts
│   ├── yaml-converter.ts, enhanced-yaml-converter.ts, yaml-highlighter.ts
│   ├── validation-engine.ts, layout-algorithms.ts, performance.ts
│   ├── workflow-simulator.ts, collaboration.ts, zip.ts, codegen.ts
│   └── utils.ts
├── types/stepflow.ts
├── main.tsx           # Version switcher & bootstrapping
└── styles.css
```

## Advanced Capabilities

- **Retry Policies**: Attempts, delays, and guards with visual indicators
- **Validation**: Structural issues (orphans, unreachable), config problems, logic errors, performance hints; with summary and score
- **Auto Layout**: Picks algorithms and offers recommendations based on complexity
- **Undo/Redo**: Keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Y) and grouped history
- **Conversion Help**: Enhanced YAML converter checks compatibility and explains limitations
- **DSL Tools**: Syntax highlighting, in-place editing, suggestions, and file import/export
- **Simulation & Debug**: Lightweight panels to simulate flows and inspect state

## Known Limitations

- Very large workflows (>100 nodes) may impact performance; consider splitting or using hierarchical/force-directed layouts
- Some complex patterns may not round-trip between all formats; the enhanced converter surfaces compatibility
- Modern browsers required (Chrome 90+, Firefox 88+, Safari 14+)

## StepFlow Engine Compatibility

- Output aligns with StepFlow `FlowConfig`
- Works with `SimpleEngine.fromSimpleYaml()` and `SimpleWorkflowBuilder`
- Naming and structure follow StepFlow conventions

## Scripts

- `dev`: Vite dev server
- `build`: Type-check and production bundle
- `preview`: Preview the production build
- `lint`: ESLint for TS/TSX

## License

MIT — use freely in your projects.
