# StepFlow Builder UI

A visual workflow builder for the StepFlow engine that supports both WORKFLOW and TRADITIONAL YAML formats.

## Features

- **Visual Workflow Designer**: Drag-and-drop interface built with React Flow
- **Dual YAML Format Support**: Import and export both simplified WORKFLOW and detailed TRADITIONAL formats
- **Step Management**: Visual step nodes with configuration, guards, and retry policies
- **Guard Support**: Conditional branching with guard nodes
- **Retry Logic**: Built-in retry mechanism with configurable policies
- **Terminal Steps**: Support for workflow completion states
- **Dark/Light Theme**: Toggle between themes with system preference detection
- **Import/Export**: Load workflows from YAML files and export generated configurations

## Node Types

### Step Nodes
- **Root Steps**: Entry points for workflows (blue styling)
- **Regular Steps**: Processing units with configuration options
- **Terminal Steps**: End points for workflows (green styling)
- **Features**:
  - Guard conditions
  - Retry policies with custom guards
  - Configuration parameters
  - Type definitions

### Guard Nodes
- **Conditional Logic**: Boolean evaluation nodes (orange styling)
- **Dual Output**: Success/failure paths
- **Custom Conditions**: Configurable evaluation logic

## YAML Format Support

### Workflow Format (Simplified)
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

### Traditional Format (Full FlowConfig)
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

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Usage

1. **Creating Workflows**:
   - Use "Add Step" to create new step nodes
   - Use "Add Guard" to add conditional branching
   - Connect nodes by dragging between handles
   - Configure nodes by selecting them (future feature)

2. **Importing Workflows**:
   - Use the Import tab to load YAML files
   - Paste YAML content directly
   - Supports both WORKFLOW and TRADITIONAL formats

3. **Exporting Workflows**:
   - Choose between WORKFLOW and TRADITIONAL formats
   - Generate YAML from current canvas
   - Download as .yaml files

### Versions
- Default: `V3 (Ultimate)` loads by default.
- Switch via URL: append `?version=v1`, `?version=v2`, or `?version=v3`.
- In-app: use the banner buttons to toggle versions at runtime.

## Architecture

### Components
- `StepNode`: Visual representation of workflow steps
- `GuardNode`: Conditional branching nodes
- `YamlConverter`: Bidirectional YAML format conversion
- `App`: Main application with React Flow canvas

### Type System
- Full TypeScript support
- Matches Java FlowConfig structure
- Type-safe YAML parsing and generation

## Advanced Features

### Retry Policies
- Maximum iteration limits
- Delay between retries
- Conditional retry guards
- Visual indicators on nodes

### Guards
- Step-level guards for conditional execution
- Edge-level guards for conditional transitions
- Retry guards for intelligent retry logic
- Visual guard nodes for complex branching

### Terminal Handling
- SUCCESS/FAILED terminal states
- Visual indicators for terminal steps
- Proper edge styling for completion paths

## Integration with StepFlow Engine

This UI generates YAML that is fully compatible with the StepFlow engine:
- Matches `FlowConfig` structure
- Supports `SimpleEngine.fromSimpleYaml()` import
- Compatible with `SimpleWorkflowBuilder`
- Follows StepFlow naming conventions

## Development

### Project Structure
```
src/
├── components/
│   ├── nodes/          # React Flow node components
│   └── ui/             # Reusable UI components
├── lib/
│   ├── utils.ts        # Utility functions
│   └── yaml-converter.ts # YAML format conversion
├── types/
│   └── stepflow.ts     # TypeScript type definitions
└── App-old.tsx            # Main application
```

### Key Dependencies
- **React Flow**: Canvas and node management
- **YAML**: Parsing and stringifying YAML
- **Tailwind CSS**: Styling framework
- **Lucide React**: Icon library

## Future Enhancements

- [ ] Node property editing panel
- [ ] Workflow validation
- [ ] Auto-layout algorithms
- [ ] Undo/redo functionality
- [ ] Workflow templates
- [ ] Real-time collaboration
- [ ] Workflow execution preview
- [ ] Advanced guard configuration UI
- [ ] Custom node types
- [ ] Workflow versioning

## License

MIT License - feel free to use in your projects!
