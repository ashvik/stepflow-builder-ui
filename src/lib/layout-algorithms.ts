import { Node, Edge } from 'reactflow'

export interface LayoutOptions {
  spacing: {
    x: number
    y: number
  }
  padding: {
    x: number
    y: number
  }
  algorithm: 'hierarchical' | 'force' | 'circular' | 'tree' | 'grid'
  // Direction for hierarchical/tree layouts
  direction?: 'TB' | 'LR' // Top-to-Bottom (default) or Left-to-Right
}

export interface LayoutResult {
  nodes: Node[]
  bounds: {
    width: number
    height: number
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

export class LayoutAlgorithms {
  
  static applyLayout(
    nodes: Node[], 
    edges: Edge[], 
    algorithm: LayoutOptions['algorithm'] = 'hierarchical',
    options: Partial<LayoutOptions> = {}
  ): LayoutResult {
    const defaultOptions: LayoutOptions = {
      spacing: { x: 280, y: 150 },
      padding: { x: 50, y: 50 },
      algorithm,
      direction: 'TB'
    }
    
    const finalOptions = { ...defaultOptions, ...options }
    
    switch (algorithm) {
      case 'hierarchical':
        return this.applyHierarchicalLayout(nodes, edges, finalOptions)
      case 'force':
        return this.applyForceDirectedLayout(nodes, edges, finalOptions)
      case 'circular':
        return this.applyCircularLayout(nodes, edges, finalOptions)
      case 'tree':
        return this.applyTreeLayout(nodes, edges, finalOptions)
      case 'grid':
        return this.applyGridLayout(nodes, edges, finalOptions)
      default:
        return this.applyHierarchicalLayout(nodes, edges, finalOptions)
    }
  }
  
  private static applyHierarchicalLayout(
    nodes: Node[], 
    edges: Edge[], 
    options: LayoutOptions
  ): LayoutResult {
    const { spacing, padding, direction = 'TB' } = options
    
    // Find root node
    const rootNode = nodes.find(n => 
      n.type === 'step' && (n.data as any).isRoot
    ) || nodes[0]
    
    if (!rootNode) {
      return this.fallbackLayout(nodes, options)
    }
    
    // Build adjacency list
    const adjacencyList = new Map<string, string[]>()
    nodes.forEach(node => adjacencyList.set(node.id, []))
    
    edges.forEach(edge => {
      const targets = adjacencyList.get(edge.source) || []
      targets.push(edge.target)
      adjacencyList.set(edge.source, targets)
    })
    
    // Assign levels using BFS
    const levels = new Map<string, number>()
    const queue = [{ nodeId: rootNode.id, level: 0 }]
    const visited = new Set<string>()
    
    while (queue.length > 0) {
      const { nodeId, level } = queue.shift()!
      
      if (visited.has(nodeId)) continue
      visited.add(nodeId)
      
      levels.set(nodeId, level)
      
      const children = adjacencyList.get(nodeId) || []
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ nodeId: childId, level: level + 1 })
        }
      })
    }
    
    // Group nodes by level
    const levelGroups = new Map<number, Node[]>()
    nodes.forEach(node => {
      const level = levels.get(node.id) ?? 0
      const group = levelGroups.get(level) || []
      group.push(node)
      levelGroups.set(level, group)
    })
    
    // Position nodes
    const updatedNodes: Node[] = []
    let maxX = 0
    let maxY = 0
    
    levelGroups.forEach((levelNodes, level) => {
      if (direction === 'TB') {
        // Top-to-bottom (existing): y grows with level; spread x within level
        const y = padding.y + level * spacing.y
        const totalWidth = Math.max(0, (levelNodes.length - 1) * spacing.x)
        const startX = padding.x - totalWidth / 2
        levelNodes.forEach((node, index) => {
          const x = startX + index * spacing.x
          updatedNodes.push({ ...node, position: { x, y } })
          maxX = Math.max(maxX, x + 200)
          maxY = Math.max(maxY, y + 100)
        })
      } else {
        // Left-to-right: x grows with level; spread y within level
        const x = padding.x + level * spacing.x
        const totalHeight = Math.max(0, (levelNodes.length - 1) * spacing.y)
        const startY = padding.y - totalHeight / 2
        levelNodes.forEach((node, index) => {
          const y = startY + index * spacing.y
          updatedNodes.push({ ...node, position: { x, y } })
          maxX = Math.max(maxX, x + 200)
          maxY = Math.max(maxY, y + 100)
        })
      }
    })
    
    return {
      nodes: updatedNodes,
      bounds: {
        width: maxX + padding.x,
        height: maxY + padding.y,
        minX: 0,
        minY: 0,
        maxX: maxX + padding.x,
        maxY: maxY + padding.y
      }
    }
  }
  
  private static applyForceDirectedLayout(
    nodes: Node[], 
    edges: Edge[], 
    options: LayoutOptions
  ): LayoutResult {
    const { spacing, padding } = options
    
    // Initialize positions randomly if not set
    const updatedNodes = nodes.map(node => ({
      ...node,
      position: node.position || {
        x: Math.random() * 800 + padding.x,
        y: Math.random() * 600 + padding.y
      }
    }))
    
    // Force-directed algorithm parameters
    const iterations = 100
    const repulsionStrength = 5000
    const attractionStrength = 0.1
    const damping = 0.85
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, { x: number, y: number }>()
      
      // Initialize forces
      updatedNodes.forEach(node => {
        forces.set(node.id, { x: 0, y: 0 })
      })
      
      // Repulsion forces (all nodes repel each other)
      for (let i = 0; i < updatedNodes.length; i++) {
        for (let j = i + 1; j < updatedNodes.length; j++) {
          const nodeA = updatedNodes[i]
          const nodeB = updatedNodes[j]
          
          const dx = nodeB.position.x - nodeA.position.x
          const dy = nodeB.position.y - nodeA.position.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          
          const force = repulsionStrength / (distance * distance)
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force
          
          const forceA = forces.get(nodeA.id)!
          const forceB = forces.get(nodeB.id)!
          
          forceA.x -= fx
          forceA.y -= fy
          forceB.x += fx
          forceB.y += fy
        }
      }
      
      // Attraction forces (connected nodes attract each other)
      edges.forEach(edge => {
        const sourceNode = updatedNodes.find(n => n.id === edge.source)
        const targetNode = updatedNodes.find(n => n.id === edge.target)
        
        if (!sourceNode || !targetNode) return
        
        const dx = targetNode.position.x - sourceNode.position.x
        const dy = targetNode.position.y - sourceNode.position.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 1
        
        const force = attractionStrength * (distance - spacing.x)
        const fx = (dx / distance) * force
        const fy = (dy / distance) * force
        
        const sourceForce = forces.get(sourceNode.id)!
        const targetForce = forces.get(targetNode.id)!
        
        sourceForce.x += fx
        sourceForce.y += fy
        targetForce.x -= fx
        targetForce.y -= fy
      })
      
      // Apply forces with damping
      updatedNodes.forEach(node => {
        const force = forces.get(node.id)!
        node.position.x += force.x * damping
        node.position.y += force.y * damping
      })
    }
    
    return this.calculateBounds(updatedNodes)
  }
  
  private static applyCircularLayout(
    nodes: Node[], 
    edges: Edge[], 
    options: LayoutOptions
  ): LayoutResult {
    const { padding } = options
    
    if (nodes.length === 0) return this.fallbackLayout(nodes, options)
    
    const centerX = 400
    const centerY = 300
    const radius = Math.max(200, nodes.length * 30)
    
    const updatedNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      
      return {
        ...node,
        position: { x, y }
      }
    })
    
    return this.calculateBounds(updatedNodes)
  }
  
  private static applyTreeLayout(
    nodes: Node[], 
    edges: Edge[], 
    options: LayoutOptions
  ): LayoutResult {
    const { spacing, padding } = options
    
    // Find root
    const rootNode = nodes.find(n => 
      n.type === 'step' && (n.data as any).isRoot
    ) || nodes[0]
    
    if (!rootNode) return this.fallbackLayout(nodes, options)
    
    // Build tree structure
    const children = new Map<string, string[]>()
    const parents = new Map<string, string>()
    
    nodes.forEach(node => children.set(node.id, []))
    
    edges.forEach(edge => {
      const childList = children.get(edge.source) || []
      childList.push(edge.target)
      children.set(edge.source, childList)
      parents.set(edge.target, edge.source)
    })
    
    // Calculate subtree sizes
    const subtreeSizes = new Map<string, number>()
    
    const calculateSubtreeSize = (nodeId: string): number => {
      const nodeChildren = children.get(nodeId) || []
      let size = 1
      
      nodeChildren.forEach(childId => {
        size += calculateSubtreeSize(childId)
      })
      
      subtreeSizes.set(nodeId, size)
      return size
    }
    
    calculateSubtreeSize(rootNode.id)
    
    // Position nodes
    const positions = new Map<string, { x: number, y: number }>()
    
    const positionNode = (nodeId: string, x: number, y: number, availableWidth: number) => {
      positions.set(nodeId, { x, y })
      
      const nodeChildren = children.get(nodeId) || []
      if (nodeChildren.length === 0) return
      
      let currentX = x - availableWidth / 2
      
      nodeChildren.forEach(childId => {
        const childSubtreeSize = subtreeSizes.get(childId) || 1
        const childWidth = (childSubtreeSize / (subtreeSizes.get(nodeId) || 1)) * availableWidth
        
        positionNode(childId, currentX + childWidth / 2, y + spacing.y, childWidth)
        currentX += childWidth
      })
    }
    
    const totalWidth = (subtreeSizes.get(rootNode.id) || 1) * spacing.x
    positionNode(rootNode.id, totalWidth / 2, padding.y, totalWidth)
    
    const updatedNodes = nodes.map(node => ({
      ...node,
      position: positions.get(node.id) || { x: 0, y: 0 }
    }))
    
    return this.calculateBounds(updatedNodes)
  }
  
  private static applyGridLayout(
    nodes: Node[], 
    edges: Edge[], 
    options: LayoutOptions
  ): LayoutResult {
    const { spacing, padding } = options
    
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const rows = Math.ceil(nodes.length / cols)
    
    const updatedNodes = nodes.map((node, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      
      return {
        ...node,
        position: {
          x: padding.x + col * spacing.x,
          y: padding.y + row * spacing.y
        }
      }
    })
    
    return this.calculateBounds(updatedNodes)
  }
  
  private static calculateBounds(nodes: Node[]): LayoutResult {
    if (nodes.length === 0) {
      return {
        nodes,
        bounds: { width: 100, height: 100, minX: 0, minY: 0, maxX: 100, maxY: 100 }
      }
    }
    
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + 200) // Assume node width
      maxY = Math.max(maxY, node.position.y + 100) // Assume node height
    })
    
    return {
      nodes,
      bounds: {
        width: maxX - minX,
        height: maxY - minY,
        minX,
        minY,
        maxX,
        maxY
      }
    }
  }
  
  private static fallbackLayout(nodes: Node[], options: LayoutOptions): LayoutResult {
    const { spacing, padding } = options
    
    const updatedNodes = nodes.map((node, index) => ({
      ...node,
      position: {
        x: padding.x + (index % 4) * spacing.x,
        y: padding.y + Math.floor(index / 4) * spacing.y
      }
    }))
    
    return this.calculateBounds(updatedNodes)
  }
  
  static optimizeForPerformance(nodes: Node[], edges: Edge[]): {
    shouldVirtualize: boolean
    clusteringRecommended: boolean
    layoutComplexity: 'low' | 'medium' | 'high'
    recommendations: string[]
  } {
    const nodeCount = nodes.length
    const edgeCount = edges.length
    const complexity = edgeCount / Math.max(nodeCount, 1)
    
    const recommendations: string[] = []
    let shouldVirtualize = false
    let clusteringRecommended = false
    let layoutComplexity: 'low' | 'medium' | 'high' = 'low'
    
    // Large workflows
    if (nodeCount > 100) {
      shouldVirtualize = true
      recommendations.push('Enable canvas virtualization for better performance')
    }
    
    if (nodeCount > 50) {
      clusteringRecommended = true
      recommendations.push('Consider grouping related nodes into clusters')
    }
    
    // Complex connectivity
    if (complexity > 3) {
      layoutComplexity = 'high'
      recommendations.push('High connectivity detected - force-directed layout may perform better')
    } else if (complexity > 1.5) {
      layoutComplexity = 'medium'
      recommendations.push('Medium complexity - hierarchical layout recommended')
    }
    
    // Specific optimizations
    if (edgeCount > 200) {
      recommendations.push('Consider edge bundling for better visual clarity')
    }
    
    const guardNodes = nodes.filter(n => n.type === 'guard')
    if (guardNodes.length > 10) {
      recommendations.push('Many decision points detected - consider simplifying logic')
    }
    
    return {
      shouldVirtualize,
      clusteringRecommended,
      layoutComplexity,
      recommendations
    }
  }
}
