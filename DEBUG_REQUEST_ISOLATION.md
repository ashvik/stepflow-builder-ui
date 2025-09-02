# Request Isolation Implementation

## Problem Identified
The original code was sharing node instances between multiple requests, causing modifications in one request to impact others.

## Root Causes
1. **Shared References**: `allNodes` contained shared node objects
2. **No Request Tagging**: Nodes weren't properly tagged with their owning request
3. **Unsafe Updates**: `updateNode` modified shared instances without checking isolation
4. **Cross-Request Pollution**: Creating new requests reused existing node instances

## Solution Implemented

### 1. Request Tagging (`request` property)
- All nodes now have a `request` field in their data
- New nodes are tagged with `activeRequest` when created
- Import process tags nodes with their request name

### 2. Node Cloning (`cloneNodeForRequest`)
```typescript
const cloneNodeForRequest = (sourceNode: Node, targetRequest: string): Node => {
  const newId = generateId(sourceNode.type || 'node')
  return {
    ...sourceNode,
    id: newId,
    position: { ...sourceNode.position },
    data: {
      ...(sourceNode.data as any),
      id: newId,
      request: targetRequest, // Tag with target request
      label: (sourceNode.data as any)?.label
    }
  }
}
```

### 3. Request-Specific Node Filtering (`getRequestNodes`)
```typescript
const getRequestNodes = (requestName: string): Node[] => {
  const request = requestsMap[requestName]
  if (!request || !request.edges) return []
  
  const nodeIds = new Set<string>()
  request.edges.forEach(edge => {
    nodeIds.add(edge.source)
    nodeIds.add(edge.target)
  })
  
  return allNodes.filter(node => {
    const nodeRequest = (node.data as any)?.request
    return nodeRequest === requestName || nodeIds.has(node.id)
  })
}
```

### 4. Safe Node Updates
- `updateNode` now checks if a node is used in other requests
- If shared, it clones the node for the current request
- Updates only affect the requesting context

### 5. Isolated Request Creation
- New requests get completely new root nodes
- Root nodes are tagged with the request name
- No sharing of instances between requests

## Testing the Fix

### Test Case 1: Create Two Requests
1. Create Request A with a step "ProcessOrder"
2. Modify the step label to "ProcessOrder_A" 
3. Create Request B 
4. Switch back to Request A
5. **Expected**: Request A should still show "ProcessOrder_A"
6. **Previous Bug**: Request A would be affected by Request B creation

### Test Case 2: Cross-Request Node Sharing
1. Create Request A with steps A1 → A2
2. Create Request B 
3. Connect B1 → A2 (reusing A2 from Request A)
4. Modify A2 properties in Request B
5. Switch back to Request A
6. **Expected**: A2 in Request A should be unmodified
7. **Previous Bug**: A2 would be modified in both requests

### Test Case 3: Request Switching
1. Create multiple requests with different workflows
2. Switch between requests rapidly
3. **Expected**: Each request maintains its own state
4. **Previous Bug**: Requests would interfere with each other

## Code Changes Made

### App-old.tsx Changes:
1. **Added Request Tagging**: All new nodes get `request: activeRequest`
2. **Enhanced Request Creation**: Creates isolated root nodes
3. **Improved Request Switching**: Uses `getRequestNodes()` for filtering
4. **Safe Node Updates**: Clones nodes when shared across requests
5. **Request Isolation Function**: `ensureRequestIsolation()` for explicit isolation

### Types Changes:
1. **Extended Interfaces**: Added `request?: string` to `StepNodeData` and `GuardNodeData`

## Key Benefits
1. **True Isolation**: Each request maintains independent node instances
2. **Shared Nodes When Appropriate**: Nodes can be shared until modified
3. **Automatic Cloning**: System automatically clones when needed
4. **Clear Ownership**: Every node knows which request it belongs to
5. **Backward Compatible**: Existing workflows continue to work

## How to Verify the Fix
1. Open the application
2. Create multiple requests
3. Add nodes and modify them in different requests
4. Switch between requests to verify isolation
5. Check console for any sharing conflicts (should be none)

The fix ensures that each request maintains its own isolated workspace while still allowing efficient sharing of unchanged nodes.