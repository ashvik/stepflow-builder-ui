import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import { Node, Edge } from 'reactflow'

// Debounce hook for expensive operations
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [delay]) as T
}

// Throttle hook for high-frequency events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: any[]) => {
    const now = Date.now()
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now
      callback(...args)
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now()
        callback(...args)
      }, delay - (now - lastCall.current))
    }
  }, [callback, delay]) as T
}

// Memoize expensive node/edge calculations
export function useNodeMemo(
  nodes: Node[], 
  dependencies: any[]
): Node[] {
  return useMemo(() => {
    // Perform expensive node calculations here
    return nodes.map(node => ({
      ...node,
      // Add computed properties if needed
      measured: {
        width: node.measured?.width || 200,
        height: node.measured?.height || 100
      }
    }))
  }, [nodes, ...dependencies])
}

// Virtualization helper for large datasets
export interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
}

export function useVirtualization<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: Omit<VirtualizedListProps<T>, 'renderItem'>) {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const totalHeight = items.length * itemHeight
    
    return {
      totalHeight,
      visibleCount,
      getVisibleRange: (scrollTop: number) => {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
        const endIndex = Math.min(
          items.length - 1,
          startIndex + visibleCount + overscan * 2
        )
        
        return {
          startIndex,
          endIndex,
          visibleItems: items.slice(startIndex, endIndex + 1),
          offsetY: startIndex * itemHeight
        }
      }
    }
  }, [items, itemHeight, containerHeight, overscan])
}

// Memory management for large workflows
export class WorkflowCache {
  private cache = new Map<string, any>()
  private maxSize = 100
  private accessCount = new Map<string, number>()

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used items
      const sortedByAccess = Array.from(this.accessCount.entries())
        .sort(([,a], [,b]) => a - b)
        .slice(0, Math.floor(this.maxSize * 0.3)) // Remove 30%
      
      sortedByAccess.forEach(([key]) => {
        this.cache.delete(key)
        this.accessCount.delete(key)
      })
    }

    this.cache.set(key, value)
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1)
  }

  get(key: string): any {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1)
    }
    return value
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
    this.accessCount.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>()
  private isEnabled = process.env.NODE_ENV === 'development'

  startTiming(label: string): () => void {
    if (!this.isEnabled) return () => {}
    
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      if (!this.metrics.has(label)) {
        this.metrics.set(label, [])
      }
      
      const measurements = this.metrics.get(label)!
      measurements.push(duration)
      
      // Keep only last 100 measurements
      if (measurements.length > 100) {
        measurements.shift()
      }
      
      // Log slow operations
      if (duration > 16) { // > 16ms (1 frame at 60fps)
        console.warn(`Slow operation: ${label} took ${duration.toFixed(2)}ms`)
      }
    }
  }

  getMetrics(label: string): { avg: number; max: number; min: number; count: number } | null {
    const measurements = this.metrics.get(label)
    if (!measurements || measurements.length === 0) return null

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length
    const max = Math.max(...measurements)
    const min = Math.min(...measurements)
    
    return { avg, max, min, count: measurements.length }
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {}
    
    for (const [label] of this.metrics) {
      result[label] = this.getMetrics(label)
    }
    
    return result
  }

  clear(): void {
    this.metrics.clear()
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Bundle size optimization helpers
export const lazyLoad = (importFunc: () => Promise<any>) => {
  return React.lazy(importFunc)
}

// Memory usage monitoring
export function useMemoryMonitor(interval: number = 30000): {
  memoryUsage: number | null
  isSupported: boolean
} {
  const [memoryUsage, setMemoryUsage] = React.useState<number | null>(null)
  
  // Check if memory API is supported
  const isSupported = 'memory' in performance

  useEffect(() => {
    if (!isSupported) return

    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        setMemoryUsage(memory.usedJSHeapSize)
      }
    }

    updateMemoryUsage()
    const intervalId = setInterval(updateMemoryUsage, interval)

    return () => clearInterval(intervalId)
  }, [interval, isSupported])

  return { memoryUsage, isSupported }
}

// React performance optimizations
export function areEqual<T>(prevProps: T, nextProps: T, keys?: (keyof T)[]): boolean {
  if (keys) {
    return keys.every(key => prevProps[key] === nextProps[key])
  }
  
  return Object.keys(prevProps as any).every(
    key => (prevProps as any)[key] === (nextProps as any)[key]
  )
}

// Optimized edge calculations
export function calculateVisibleEdges(
  edges: Edge[],
  viewport: { x: number; y: number; zoom: number },
  canvasSize: { width: number; height: number }
): Edge[] {
  // Only return edges that are potentially visible in the current viewport
  const buffer = 100 // Buffer around viewport
  const visibleArea = {
    left: viewport.x - buffer,
    right: viewport.x + canvasSize.width / viewport.zoom + buffer,
    top: viewport.y - buffer,
    bottom: viewport.y + canvasSize.height / viewport.zoom + buffer
  }

  return edges.filter(edge => {
    // Simple bounding box check - in a real implementation,
    // you'd get actual node positions
    return true // For now, show all edges
  })
}

// Optimized node visibility
export function calculateVisibleNodes(
  nodes: Node[],
  viewport: { x: number; y: number; zoom: number },
  canvasSize: { width: number; height: number }
): Node[] {
  const buffer = 200 // Buffer around viewport
  const visibleArea = {
    left: viewport.x - buffer,
    right: viewport.x + canvasSize.width / viewport.zoom + buffer,
    top: viewport.y - buffer,
    bottom: viewport.y + canvasSize.height / viewport.zoom + buffer
  }

  return nodes.filter(node => {
    const nodeRight = node.position.x + (node.measured?.width || 200)
    const nodeBottom = node.position.y + (node.measured?.height || 100)
    
    return !(
      node.position.x > visibleArea.right ||
      nodeRight < visibleArea.left ||
      node.position.y > visibleArea.bottom ||
      nodeBottom < visibleArea.top
    )
  })
}