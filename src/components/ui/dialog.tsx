import React from 'react'
import { X } from 'lucide-react'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)} 
      />
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

export interface DialogContentProps {
  className?: string
  children: React.ReactNode
}

export function DialogContent({ className = '', children }: DialogContentProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}

export interface DialogHeaderProps {
  children: React.ReactNode
  onClose?: () => void
}

export function DialogHeader({ children, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-lg font-semibold">{children}</div>
      {onClose && (
        <button 
          onClick={onClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-lg font-semibold">{children}</div>
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
      {children}
    </div>
  )
}