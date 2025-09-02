import { Node, Edge } from 'reactflow'

export interface CollaborationEvent {
  type: 'node-added' | 'node-removed' | 'node-updated' | 'node-moved' |
        'edge-added' | 'edge-removed' | 'edge-updated' |
        'user-cursor' | 'user-joined' | 'user-left' |
        'workflow-selected' | 'sync-request'
  userId: string
  timestamp: number
  data: any
}

export interface CollaboratorInfo {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
  avatar?: string
  lastActive: number
  isActive: boolean
  currentWorkflow?: string
}

export interface CollaborationState {
  collaborators: Map<string, CollaboratorInfo>
  currentUser: CollaboratorInfo
  isConnected: boolean
  roomId: string
}

export class CollaborationManager {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private eventListeners: Map<string, ((event: CollaborationEvent) => void)[]> = new Map()
  private state: CollaborationState
  private maxReconnectAttempts = 5
  private reconnectAttempts = 0

  constructor(roomId: string, user: Omit<CollaboratorInfo, 'lastActive' | 'isActive'>) {
    this.state = {
      collaborators: new Map(),
      currentUser: {
        ...user,
        lastActive: Date.now(),
        isActive: true
      },
      isConnected: false,
      roomId
    }
  }

  // Connection management
  async connect(wsUrl?: string): Promise<boolean> {
    const url = wsUrl || `ws://localhost:8080/collaborate/${this.state.roomId}`
    
    try {
      this.ws = new WebSocket(url)
      
      this.ws.onopen = () => {
        console.log('Connected to collaboration server')
        this.state.isConnected = true
        this.reconnectAttempts = 0
        this.startHeartbeat()
        
        // Send join event
        this.send({
          type: 'user-joined',
          userId: this.state.currentUser.id,
          timestamp: Date.now(),
          data: this.state.currentUser
        })
        
        this.emit('connected', null as any)
      }

      this.ws.onmessage = (event) => {
        try {
          const collaborationEvent: CollaborationEvent = JSON.parse(event.data)
          this.handleIncomingEvent(collaborationEvent)
        } catch (error) {
          console.error('Failed to parse collaboration event:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('Disconnected from collaboration server')
        this.state.isConnected = false
        this.stopHeartbeat()
        this.emit('disconnected', null as any)
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.emit('error', { data: error } as CollaborationEvent)
      }

      return true
    } catch (error) {
      console.error('Failed to connect to collaboration server:', error)
      return false
    }
  }

  disconnect(): void {
    if (this.ws) {
      // Send leave event
      this.send({
        type: 'user-left',
        userId: this.state.currentUser.id,
        timestamp: Date.now(),
        data: { userId: this.state.currentUser.id }
      })
      
      this.ws.close()
      this.ws = null
    }
    
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
  }

  // Event handling
  private handleIncomingEvent(event: CollaborationEvent): void {
    switch (event.type) {
      case 'user-joined':
        this.state.collaborators.set(event.userId, event.data)
        this.emit('user-joined', event)
        break
        
      case 'user-left':
        this.state.collaborators.delete(event.userId)
        this.emit('user-left', event)
        break
        
      case 'user-cursor':
        const collaborator = this.state.collaborators.get(event.userId)
        if (collaborator) {
          collaborator.cursor = event.data
          collaborator.lastActive = Date.now()
          this.emit('cursor-moved', event)
        }
        break
        
      case 'node-added':
      case 'node-removed':
      case 'node-updated':
      case 'node-moved':
      case 'edge-added':
      case 'edge-removed':
      case 'edge-updated':
      case 'workflow-selected':
        // Don't process events from current user
        if (event.userId !== this.state.currentUser.id) {
          this.emit(event.type, event)
        }
        break
        
      case 'sync-request':
        // Send current state to requesting user
        this.emit('sync-requested', event)
        break
    }
  }

  // Send events
  send(event: CollaborationEvent): void {
    if (this.ws && this.state.isConnected) {
      this.ws.send(JSON.stringify(event))
    }
  }

  // Workflow operations
  broadcastNodeAdd(node: Node): void {
    this.send({
      type: 'node-added',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: node
    })
  }

  broadcastNodeUpdate(node: Node): void {
    this.send({
      type: 'node-updated',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: node
    })
  }

  broadcastNodeRemove(nodeId: string): void {
    this.send({
      type: 'node-removed',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: { nodeId }
    })
  }

  broadcastNodeMove(nodeId: string, position: { x: number; y: number }): void {
    this.send({
      type: 'node-moved',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: { nodeId, position }
    })
  }

  broadcastEdgeAdd(edge: Edge): void {
    this.send({
      type: 'edge-added',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: edge
    })
  }

  broadcastEdgeRemove(edgeId: string): void {
    this.send({
      type: 'edge-removed',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: { edgeId }
    })
  }

  broadcastWorkflowSelection(workflowName: string): void {
    this.send({
      type: 'workflow-selected',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: { workflowName }
    })
  }

  // Cursor tracking
  updateCursor(x: number, y: number): void {
    this.state.currentUser.cursor = { x, y }
    this.state.currentUser.lastActive = Date.now()
    
    this.send({
      type: 'user-cursor',
      userId: this.state.currentUser.id,
      timestamp: Date.now(),
      data: { x, y }
    })
  }

  // Event system
  on(eventType: string, callback: (event: CollaborationEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    this.eventListeners.get(eventType)!.push(callback)
  }

  off(eventType: string, callback: (event: CollaborationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(eventType: string, event: CollaborationEvent): void {
    const listeners = this.eventListeners.get(eventType) || []
    listeners.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        console.error('Error in collaboration event listener:', error)
      }
    })
  }

  // Utility methods
  getCollaborators(): CollaboratorInfo[] {
    return Array.from(this.state.collaborators.values())
  }

  getCurrentUser(): CollaboratorInfo {
    return this.state.currentUser
  }

  isConnected(): boolean {
    return this.state.isConnected
  }

  getRoomId(): string {
    return this.state.roomId
  }

  // Connection maintenance
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.state.isConnected) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000)
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  // Mock server for development
  static startMockServer(port: number = 8080): void {
    console.log(`Mock collaboration server would start on port ${port}`)
    console.log('In a real implementation, this would start a WebSocket server')
    console.log('For now, collaboration features work in offline mode only')
  }

  // Offline mode simulation
  enableOfflineMode(): void {
    console.log('Running in offline collaboration mode')
    
    // Simulate connection
    setTimeout(() => {
      this.state.isConnected = true
      this.emit('connected', null as any)
      
      // Add a mock collaborator for demo
      const mockUser: CollaboratorInfo = {
        id: 'demo-user-2',
        name: 'Demo User',
        color: '#10b981',
        lastActive: Date.now(),
        isActive: true,
        cursor: { x: 100, y: 100 }
      }
      
      this.state.collaborators.set(mockUser.id, mockUser)
      
      this.emit('user-joined', {
        type: 'user-joined',
        userId: mockUser.id,
        timestamp: Date.now(),
        data: mockUser
      })
    }, 1000)
  }
}