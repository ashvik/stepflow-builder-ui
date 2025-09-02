import { useState, useCallback, useRef, useEffect } from 'react'
import { Node, Edge } from 'reactflow'

export interface HistoryState {
  nodes: Node[]
  edges: Edge[]
  config?: any // Configuration state for YAML sync (any to avoid circular imports)
  timestamp: number
  action?: string // Description of the action that created this state
}

interface UndoRedoOptions {
  maxHistorySize?: number
  debounceMs?: number
  autoSave?: boolean
}

export function useUndoRedo(
  initialState: Omit<HistoryState, 'timestamp' | 'action'>,
  options: UndoRedoOptions = {}
) {
  const {
    maxHistorySize = 50,
    debounceMs = 300,
    autoSave = true
  } = options

  const [history, setHistory] = useState<HistoryState[]>([
    { ...initialState, timestamp: Date.now() }
  ])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isUndoing, setIsUndoing] = useState(false)
  const [isRedoing, setIsRedoing] = useState(false)
  
  const debounceTimer = useRef<NodeJS.Timeout>()
  const lastSavedState = useRef<string>('')

  // Get current state
  const currentState = history[currentIndex]
  
  // Can undo/redo flags
  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1

  // Save state to localStorage
  const saveToStorage = useCallback((state: HistoryState[]) => {
    if (autoSave) {
      try {
        localStorage.setItem('stepflow_history', JSON.stringify({
          history: state.slice(-10), // Keep only last 10 states in storage
          currentIndex: Math.min(currentIndex, 9)
        }))
      } catch (error) {
        console.warn('Failed to save history to localStorage:', error)
      }
    }
  }, [autoSave, currentIndex])

  // Load state from localStorage
  useEffect(() => {
    if (autoSave) {
      try {
        const saved = localStorage.getItem('stepflow_history')
        if (saved) {
          const { history: savedHistory, currentIndex: savedIndex } = JSON.parse(saved)
          if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
            setHistory(savedHistory)
            setCurrentIndex(savedIndex || 0)
          }
        }
      } catch (error) {
        console.warn('Failed to load history from localStorage:', error)
      }
    }
  }, [autoSave])

  // Push new state to history
  const pushState = useCallback((
    newState: Omit<HistoryState, 'timestamp'>,
    immediate = false
  ) => {
    if (isUndoing || isRedoing) return

    const stateString = JSON.stringify({
      nodes: newState.nodes,
      edges: newState.edges,
      config: newState.config
    })

    // Avoid saving identical states
    if (stateString === lastSavedState.current) return
    lastSavedState.current = stateString

    const saveState = () => {
      const historyState: HistoryState = {
        ...newState,
        timestamp: Date.now()
      }

      setHistory(prev => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, currentIndex + 1)
        newHistory.push(historyState)
        
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          return newHistory.slice(-maxHistorySize)
        }
        
        return newHistory
      })
      
      setCurrentIndex(prev => {
        const newIndex = Math.min(prev + 1, maxHistorySize - 1)
        return newIndex
      })
    }

    if (immediate || debounceMs === 0) {
      saveState()
    } else {
      // Debounce rapid changes
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      
      debounceTimer.current = setTimeout(saveState, debounceMs)
    }
  }, [currentIndex, maxHistorySize, debounceMs, isUndoing, isRedoing])

  // Undo to previous state
  const undo = useCallback(() => {
    if (!canUndo) return null

    setIsUndoing(true)
    setCurrentIndex(prev => prev - 1)
    
    const prevState = history[currentIndex - 1]
    
    // Cleanup after state change
    setTimeout(() => setIsUndoing(false), 50)
    
    return prevState
  }, [canUndo, currentIndex, history])

  // Redo to next state
  const redo = useCallback(() => {
    if (!canRedo) return null

    setIsRedoing(true)
    setCurrentIndex(prev => prev + 1)
    
    const nextState = history[currentIndex + 1]
    
    // Cleanup after state change
    setTimeout(() => setIsRedoing(false), 50)
    
    return nextState
  }, [canRedo, currentIndex, history])

  // Clear history and start fresh
  const clearHistory = useCallback((newInitialState?: Omit<HistoryState, 'timestamp' | 'action'>) => {
    const initialState = newInitialState || {
      nodes: [],
      edges: [],
      config: undefined
    }
    
    setHistory([{ ...initialState, timestamp: Date.now() }])
    setCurrentIndex(0)
    lastSavedState.current = ''
  }, [])

  // Get history for debugging/inspection
  const getHistory = useCallback(() => ({
    history,
    currentIndex,
    canUndo,
    canRedo
  }), [history, currentIndex, canUndo, canRedo])

  // Create a checkpoint (immediate save)
  const createCheckpoint = useCallback((
    state: Omit<HistoryState, 'timestamp'>,
    description?: string
  ) => {
    pushState({ ...state, action: description }, true)
  }, [pushState])

  // Jump to specific state in history
  const jumpToState = useCallback((index: number) => {
    if (index < 0 || index >= history.length) return null

    setCurrentIndex(index)
    return history[index]
  }, [history])

  // Get state changes between two history points
  const getDiff = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= history.length || 
        toIndex < 0 || toIndex >= history.length) {
      return null
    }

    const fromState = history[fromIndex]
    const toState = history[toIndex]

    return {
      nodesAdded: toState.nodes.filter(n => !fromState.nodes.find(fn => fn.id === n.id)),
      nodesRemoved: fromState.nodes.filter(n => !toState.nodes.find(tn => tn.id === n.id)),
      nodesModified: toState.nodes.filter(n => {
        const fromNode = fromState.nodes.find(fn => fn.id === n.id)
        return fromNode && JSON.stringify(fromNode) !== JSON.stringify(n)
      }),
      edgesAdded: toState.edges.filter(e => !fromState.edges.find(fe => fe.id === e.id)),
      edgesRemoved: fromState.edges.filter(e => !toState.edges.find(te => te.id === e.id)),
      edgesModified: toState.edges.filter(e => {
        const fromEdge = fromState.edges.find(fe => fe.id === e.id)
        return fromEdge && JSON.stringify(fromEdge) !== JSON.stringify(e)
      })
    }
  }, [history])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      
      // Save final state
      if (autoSave && history.length > 0) {
        saveToStorage(history)
      }
    }
  }, [history, saveToStorage, autoSave])

  return {
    // Current state
    currentState,
    
    // Actions
    pushState,
    undo,
    redo,
    clearHistory,
    createCheckpoint,
    jumpToState,
    
    // State info
    canUndo,
    canRedo,
    isUndoing,
    isRedoing,
    
    // Utilities
    getHistory,
    getDiff,
    
    // Statistics
    historySize: history.length,
    currentIndex
  }
}

// Hook for keyboard shortcuts
export function useUndoRedoShortcuts(
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in inputs
      const target = event.target as HTMLElement
      const isInputField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.getAttribute('role') === 'textbox'
      )
      
      if (isInputField) return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey

      if (ctrlKey && event.key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault()
        undo()
      } else if (
        ((ctrlKey && event.key === 'y') || (ctrlKey && event.shiftKey && event.key === 'z')) && 
        canRedo
      ) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, canUndo, canRedo])
}