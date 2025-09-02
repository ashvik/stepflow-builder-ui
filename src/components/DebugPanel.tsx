import React from 'react'
import { Node, Edge } from 'reactflow'

interface DebugPanelProps {
  nodes: Node[]
  edges: Edge[]
  allNodes: Node[]
  activeRequest: string
  requestsMap: Record<string, any>
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  nodes,
  edges,
  allNodes,
  activeRequest,
  requestsMap
}) => {
  try {
    // Group nodes by request safely
    const nodesByRequest = allNodes.reduce((acc, node) => {
      const request = (node.data as any)?.request || 'untagged'
      if (!acc[request]) acc[request] = []
      acc[request].push(node)
      return acc
    }, {} as Record<string, Node[]>)

    return (
      <div className="fixed bottom-4 right-4 w-80 max-h-96 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 text-xs overflow-auto z-50">
        <div className="font-bold mb-2 text-gray-900 dark:text-gray-100">🐛 Debug Panel</div>
        
        <div className="mb-2 text-gray-700 dark:text-gray-300">
          <strong>Active Request:</strong> {activeRequest}
        </div>
        
        <div className="mb-2 text-gray-700 dark:text-gray-300">
          <strong>Canvas Nodes ({nodes.length}):</strong>
          {nodes.map(n => (
            <div key={n.id} className="ml-2">
              • {n.id}: {(n.data as any)?.label || 'No Label'} 
              <span className="text-blue-600"> [{(n.data as any)?.request || 'untagged'}]</span>
            </div>
          ))}
        </div>
        
        <div className="mb-2 text-gray-700 dark:text-gray-300">
          <strong>All Nodes by Request:</strong>
          {Object.entries(nodesByRequest).map(([req, reqNodes]) => (
            <div key={req} className="ml-2">
              <div className="font-medium">{req} ({reqNodes.length}):</div>
              {reqNodes.map(n => (
                <div key={n.id} className="ml-4">
                  • {n.id}: {(n.data as any)?.label || 'No Label'}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className="mb-2 text-gray-700 dark:text-gray-300">
          <strong>Requests Map:</strong>
          {Object.entries(requestsMap).map(([req, info]) => (
            <div key={req} className="ml-2">
              <div className="font-medium">{req}:</div>
              <div className="ml-4">Edges: {(info as any)?.edges?.length || 0}</div>
              <div className="ml-4">Root: {(info as any)?.rootId || 'none'}</div>
            </div>
          ))}
        </div>
        
        <div className="text-xs text-gray-500 mt-2">
          This debug panel helps identify node sharing issues
        </div>
      </div>
    )
  } catch (error) {
    return (
      <div className="fixed bottom-4 right-4 w-80 bg-red-100 border border-red-300 rounded-lg shadow-lg p-3 text-xs z-50">
        <div className="font-bold text-red-800">Debug Panel Error:</div>
        <div className="text-red-600">{String(error)}</div>
      </div>
    )
  }
}

export default DebugPanel