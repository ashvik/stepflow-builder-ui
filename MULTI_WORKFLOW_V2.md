# StepFlow Builder V2 - Multi-Workflow Support

## Overview

StepFlow Builder V2 introduces a comprehensive solution for visualizing and managing multiple workflows without visual confusion. This implementation uses a tab-based approach where each workflow gets its own dedicated canvas.

## Key Features

### 🗂️ **Tab-Based Canvas System**
- Each workflow opens in its own tab
- Clean visual separation with no overlap
- Easy navigation between workflows
- Closeable tabs with confirmation for unsaved changes

### 📊 **Enhanced Workflow Management**  
- Improved workflow sidebar with detailed stats
- Validation status indicators (✅ ❌ ⚠️)
- Quick workflow creation and deletion
- "Open in Tab" functionality

### 🎯 **Individual Workflow Context**
- Each tab maintains its own:
  - Node positions and layout
  - Selection state
  - Viewport position and zoom level
  - Undo/redo history

### 🔄 **State Management**
- Centralized configuration shared across all tabs
- Per-tab visual state isolation
- Automatic sync when workflow structure changes

## Architecture Changes

### New State Structure
```typescript
interface AppStateV2 {
  config: StepFlowConfig           // Shared configuration
  workflowTabs: WorkflowTabState[] // Individual tab states
  activeTabIndex: number           // Currently active tab
  ui: {
    panels: { ... }
    showAllWorkflows: boolean      // Future: overview mode
  }
}

interface WorkflowTabState {
  workflowName: string
  nodes: Node[]
  edges: Edge[]
  selectedNodes: string[]
  selectedEdges: string[]
  viewport: { x: number; y: number; zoom: number }
}
```

### Component Hierarchy
```
AppV2.tsx
├── WorkflowManagerV2.tsx     // Enhanced sidebar
├── Tabs System               // Tab navigation
│   ├── TabsList
│   └── TabsContent
│       └── ReactFlow Canvas  // Individual workflow canvas
└── PropertiesPanel           // Shared properties panel
```

## Files Created

### Core Components
- **`src/AppV2.tsx`** - Main application with tab system
- **`src/components/WorkflowManagerV2.tsx`** - Enhanced workflow sidebar
- **`src/components/ui/badge.tsx`** - Badge component for status indicators

### Utilities
- **`src/main-v2.tsx`** - Version switcher for easy testing
- **`MULTI_WORKFLOW_V2.md`** - This documentation

## How to Test

### Option 1: URL Parameter
```bash
# Run V2 version
http://localhost:5173/?version=v2

# Run original V1 version  
http://localhost:5173/?version=v1
```

### Option 2: Environment Variable
```bash
# In .env file
VITE_APP_VERSION=v2

# Then run normally
npm run dev
```

### Option 3: Manual Switch
Replace the import in `src/main.tsx`:
```typescript
// Original
import App from './App.tsx'

// V2 Version  
import App from './AppV2.tsx'
```

## Usage Guide

### Creating Workflows
1. Click "New" in the Workflows sidebar
2. Enter workflow name and press Enter
3. Workflow automatically opens in new tab

### Managing Tabs
- **Open workflow**: Click workflow name in sidebar or use "Open" button
- **Close tab**: Click X button on tab (with confirmation)
- **Switch tabs**: Click on tab headers
- **Multiple workflows**: Open multiple tabs simultaneously

### Visual Indicators
- **Active tab**: Highlighted with blue ring
- **Open workflows**: Show "Open" badge in sidebar
- **Validation status**: Color-coded icons (green=valid, red=errors, orange=warnings)
- **Tab stats**: Shows step and edge count per workflow

## Benefits Over Single Canvas

### ✅ **Advantages**
- **No visual confusion** - Each workflow isolated
- **Better performance** - Only render active workflow
- **Cleaner UX** - Tab metaphor familiar to users
- **Scalable** - Can handle many workflows
- **Context preservation** - Each tab remembers its state

### 🔄 **Trade-offs**
- **No cross-workflow view** - Can't see relationships between workflows
- **Memory usage** - Multiple tab states in memory
- **Complexity** - More complex state management

## Future Enhancements

### Phase 2 Features (Not Yet Implemented)
- **Overview Mode**: Toggle to see all workflows simultaneously with zoom-out
- **Cross-Workflow References**: Visual indicators for shared steps
- **Drag & Drop**: Move steps between workflows
- **Tab Groups**: Organize related workflows
- **Workflow Templates**: Create workflows from templates

### Phase 3 Features
- **Mini-map**: Overview of all open workflows
- **Workflow Comparison**: Side-by-side diff view
- **Shared Step Library**: Reusable step components
- **Export/Import**: Individual workflow import/export

## Implementation Details

### State Synchronization
```typescript
// When config changes, all relevant tabs update automatically
useEffect(() => {
  if (activeTab && appState.config.workflows?.[activeTab.workflowName]) {
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges
    updateActiveTab({ nodes: newNodes, edges: newEdges })
  }
}, [generateNodesAndEdges])
```

### Tab Management
```typescript
// Create tab for new workflow
const createWorkflowTab = (workflowName: string) => {
  const newTab: WorkflowTabState = {
    workflowName,
    nodes: [],
    edges: [],
    selectedNodes: [],
    selectedEdges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
  // Add to tabs array and set as active
}
```

### Performance Optimizations
- Only active tab renders ReactFlow canvas
- Lazy loading of tab content
- Debounced state updates
- Memoized node/edge generation

## Fallback Strategy

If V2 has issues, easily fallback to V1:
1. Change URL parameter: `?version=v1`
2. Or revert main.tsx import
3. Original files remain untouched

## Testing Checklist

- [ ] Create multiple workflows
- [ ] Open workflows in separate tabs  
- [ ] Edit workflows independently
- [ ] Close tabs without affecting others
- [ ] Validate tab state preservation
- [ ] Test workflow deletion with open tabs
- [ ] Verify configuration sync across tabs
- [ ] Check undo/redo per tab
- [ ] Test performance with many tabs

## Known Limitations

1. **Incomplete Implementation**: Some handlers (onUpdateNode, onDeleteNode, etc.) are placeholder TODOs
2. **No Cross-Workflow Features**: Can't visualize relationships between workflows
3. **Memory Usage**: All tab states kept in memory
4. **No Persistence**: Tab state lost on page refresh

## Next Steps

1. Complete the TODO handlers for node/edge CRUD operations
2. Add tab state persistence to localStorage
3. Implement cross-workflow reference detection
4. Add overview/minimap mode
5. Performance testing with large workflows

This V2 implementation provides a solid foundation for multi-workflow visualization while maintaining the ability to fallback to the proven V1 system.