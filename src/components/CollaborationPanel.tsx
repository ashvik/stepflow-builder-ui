import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Users, Wifi, WifiOff, Circle, Settings } from 'lucide-react'
import { CollaborationManager, CollaboratorInfo, CollaborationEvent } from '../lib/collaboration'
import { cn } from '../lib/utils'

interface CollaborationPanelProps {
  collaborationManager: CollaborationManager
  className?: string
}

export function CollaborationPanel({ collaborationManager, className }: CollaborationPanelProps) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<CollaboratorInfo | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Initialize state
    setCollaborators(collaborationManager.getCollaborators())
    setIsConnected(collaborationManager.isConnected())
    setCurrentUser(collaborationManager.getCurrentUser())

    // Set up event listeners
    const handleUserJoined = (event: CollaborationEvent) => {
      setCollaborators(prev => {
        const existing = prev.find(c => c.id === event.userId)
        if (existing) return prev
        
        return [...prev, event.data]
      })
    }

    const handleUserLeft = (event: CollaborationEvent) => {
      setCollaborators(prev => prev.filter(c => c.id !== event.userId))
    }

    const handleConnected = () => {
      setIsConnected(true)
    }

    const handleDisconnected = () => {
      setIsConnected(false)
    }

    const handleCursorMoved = (event: CollaborationEvent) => {
      setCollaborators(prev => prev.map(c => 
        c.id === event.userId 
          ? { ...c, cursor: event.data, lastActive: Date.now() }
          : c
      ))
    }

    // Register listeners
    collaborationManager.on('user-joined', handleUserJoined)
    collaborationManager.on('user-left', handleUserLeft)
    collaborationManager.on('connected', handleConnected)
    collaborationManager.on('disconnected', handleDisconnected)
    collaborationManager.on('cursor-moved', handleCursorMoved)

    return () => {
      collaborationManager.off('user-joined', handleUserJoined)
      collaborationManager.off('user-left', handleUserLeft)
      collaborationManager.off('connected', handleConnected)
      collaborationManager.off('disconnected', handleDisconnected)
      collaborationManager.off('cursor-moved', handleCursorMoved)
    }
  }, [collaborationManager])

  const formatLastActive = (timestamp: number) => {
    const diff = Date.now() - timestamp
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Connection Status */}
      <div className="flex items-center gap-1">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-500" title="Connected" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500" title="Disconnected" />
        )}
      </div>

      {/* Collaborator Avatars */}
      <div className="flex items-center -space-x-2">
        {/* Current User */}
        {currentUser && (
          <div 
            className="relative w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-white z-10"
            style={{ backgroundColor: currentUser.color }}
            title={`${currentUser.name} (You)`}
          >
            {currentUser.avatar ? (
              <img 
                src={currentUser.avatar} 
                alt={currentUser.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(currentUser.name)
            )}
            <Circle 
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-green-500 fill-current" 
            />
          </div>
        )}

        {/* Other Collaborators */}
        {collaborators.slice(0, 5).map((collaborator) => (
          <div
            key={collaborator.id}
            className="relative w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-white"
            style={{ backgroundColor: collaborator.color }}
            title={`${collaborator.name} - ${formatLastActive(collaborator.lastActive)}`}
          >
            {collaborator.avatar ? (
              <img 
                src={collaborator.avatar} 
                alt={collaborator.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(collaborator.name)
            )}
            <Circle 
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 fill-current',
                collaborator.isActive ? 'text-green-500' : 'text-gray-400'
              )} 
            />
          </div>
        ))}

        {/* Overflow indicator */}
        {collaborators.length > 5 && (
          <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm bg-gray-500 flex items-center justify-center text-xs font-medium text-white">
            +{collaborators.length - 5}
          </div>
        )}
      </div>

      {/* Users Button */}
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => setShowDetails(!showDetails)}
        title={`${collaborators.length + 1} user${collaborators.length !== 0 ? 's' : ''} online`}
      >
        <Users className="w-4 h-4" />
      </Button>

      {/* Details Dropdown */}
      {showDetails && (
        <div className="absolute top-12 right-0 z-50 bg-card border border-border rounded-md shadow-lg min-w-64">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Collaboration ({collaborators.length + 1})
              </span>
              <div className="flex items-center gap-1">
                {isConnected ? (
                  <span className="text-xs text-green-600">Connected</span>
                ) : (
                  <span className="text-xs text-red-600">Offline</span>
                )}
                <Settings className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {/* Current User */}
            {currentUser && (
              <div className="flex items-center gap-3 p-3 bg-accent/20">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {currentUser.avatar ? (
                    <img 
                      src={currentUser.avatar} 
                      alt={currentUser.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(currentUser.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {currentUser.name} (You)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentUser.currentWorkflow || 'No workflow selected'}
                  </div>
                </div>
                <Circle className="w-3 h-3 text-green-500 fill-current flex-shrink-0" />
              </div>
            )}

            {/* Other Collaborators */}
            {collaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center gap-3 p-3 hover:bg-accent/50">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                  style={{ backgroundColor: collaborator.color }}
                >
                  {collaborator.avatar ? (
                    <img 
                      src={collaborator.avatar} 
                      alt={collaborator.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(collaborator.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {collaborator.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {collaborator.currentWorkflow || 'Browsing...'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {formatLastActive(collaborator.lastActive)}
                  </span>
                  <Circle 
                    className={cn(
                      'w-3 h-3 fill-current',
                      collaborator.isActive ? 'text-green-500' : 'text-gray-400'
                    )} 
                  />
                </div>
              </div>
            ))}

            {collaborators.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No other users online</p>
                <p className="text-xs">Share this workspace to collaborate</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Room: <code className="bg-accent/50 px-1 rounded">{collaborationManager.getRoomId()}</code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Cursor component for showing collaborator cursors
export function CollaboratorCursor({ 
  collaborator, 
  position 
}: { 
  collaborator: CollaboratorInfo
  position: { x: number; y: number }
}) {
  return (
    <div 
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-2px, -2px)'
      }}
    >
      <div className="relative">
        <svg
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0.5 0.5V19L5.5 14.5H11.5L0.5 0.5Z"
            fill={collaborator.color}
            stroke="white"
            strokeWidth="1"
          />
        </svg>
        <div 
          className="absolute top-4 left-2 text-xs font-medium text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
          style={{ backgroundColor: collaborator.color }}
        >
          {collaborator.name}
        </div>
      </div>
    </div>
  )
}