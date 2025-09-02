import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface TreeNode {
  key: string
  value: any
  type: 'object' | 'array' | 'primitive'
  path: string[]
  children?: TreeNode[]
}

interface YamlTreeViewProps {
  data: any
  yamlString: string
  className?: string
}

interface TreeItemProps {
  node: TreeNode
  level: number
  onCopy?: (path: string[], value: any) => void
}

const TreeItem: React.FC<TreeItemProps> = ({ node, level, onCopy }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2) // Auto-expand first 2 levels
  const [copied, setCopied] = useState(false)
  
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])
  
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const valueStr = typeof node.value === 'object' 
        ? JSON.stringify(node.value, null, 2)
        : String(node.value)
      await navigator.clipboard.writeText(valueStr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
      onCopy?.(node.path, node.value)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [node.path, node.value, onCopy])
  
  const indent = level * 16
  const hasChildren = node.children && node.children.length > 0
  
  const getValuePreview = (value: any, type: string): string => {
    if (type === 'primitive') {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (typeof value === 'number') return String(value)
      if (value === null || value === undefined) return 'null'
      return String(value)
    }
    if (type === 'array') {
      return `[${Array.isArray(value) ? value.length : 0} items]`
    }
    if (type === 'object') {
      const keys = Object.keys(value || {})
      return `{${keys.length} properties}`
    }
    return ''
  }
  
  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'object': return 'text-blue-600 dark:text-blue-400'
      case 'array': return 'text-green-600 dark:text-green-400'
      case 'primitive': {
        if (typeof node.value === 'string') return 'text-orange-600 dark:text-orange-400'
        if (typeof node.value === 'number') return 'text-purple-600 dark:text-purple-400'
        if (typeof node.value === 'boolean') return 'text-red-600 dark:text-red-400'
        return 'text-gray-600 dark:text-gray-400'
      }
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }
  
  return (
    <div className="select-text">
      <div
        className={cn(
          "flex items-center py-1 px-2 rounded hover:bg-muted/50 cursor-pointer group transition-colors",
          level === 0 && "font-medium"
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={hasChildren ? handleToggle : undefined}
      >
        {/* Expand/Collapse Icon */}
        <div className="w-4 h-4 flex items-center justify-center mr-2">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )
          ) : (
            <div className="w-3 h-3" />
          )}
        </div>
        
        {/* Key */}
        <span className="text-sm font-medium text-foreground mr-2">
          {node.key}:
        </span>
        
        {/* Value */}
        <span className={cn("text-sm flex-1", getTypeColor(node.type))}>
          {getValuePreview(node.value, node.type)}
        </span>
        
        {/* Copy Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
          title="Copy value"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-600" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && node.children && (
        <div className="ml-4">
          {node.children.map((child, index) => (
            <TreeItem
              key={`${child.key}-${index}`}
              node={child}
              level={level + 1}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const YamlTreeView: React.FC<YamlTreeViewProps> = ({ data, yamlString, className }) => {
  const [rootCopied, setRootCopied] = useState(false)
  
  const buildTree = useCallback((obj: any, path: string[] = []): TreeNode[] => {
    if (!obj || typeof obj !== 'object') return []
    
    return Object.entries(obj).map(([key, value]) => {
      const currentPath = [...path, key]
      const type = Array.isArray(value) ? 'array' : typeof value === 'object' && value !== null ? 'object' : 'primitive'
      
      const node: TreeNode = {
        key,
        value,
        type,
        path: currentPath
      }
      
      if (type === 'object' || type === 'array') {
        node.children = buildTree(value, currentPath)
      }
      
      return node
    })
  }, [])
  
  const tree = buildTree(data)
  
  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(yamlString)
      setRootCopied(true)
      setTimeout(() => setRootCopied(false), 1000)
    } catch (error) {
      console.error('Failed to copy YAML:', error)
    }
  }, [yamlString])
  
  const handleItemCopy = useCallback((path: string[], value: any) => {
    console.log('Copied item:', path.join('.'), value)
  }, [])
  
  if (!tree.length) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        No data to display
      </div>
    )
  }
  
  return (
    <div className={cn("relative", className)}>
      {/* Header with Copy All Button */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <span className="text-sm font-medium text-foreground">Configuration Tree</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAll}
          className="h-7"
        >
          {rootCopied ? (
            <>
              <Check className="w-3 h-3 mr-1 text-green-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Copy YAML
            </>
          )}
        </Button>
      </div>
      
      {/* Tree Content */}
      <div className="p-2 max-h-[500px] overflow-auto">
        {tree.map((node, index) => (
          <TreeItem
            key={`${node.key}-${index}`}
            node={node}
            level={0}
            onCopy={handleItemCopy}
          />
        ))}
      </div>
    </div>
  )
}

export default YamlTreeView