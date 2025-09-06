import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { cn } from '../lib/utils'
import { AlertTriangle, Info } from 'lucide-react'

export interface DslEditorProps {
  value: string
  onChange: (val: string) => void
  className?: string
  suggestions?: string[]
  getSuggestions?: (ctx: { line: string; before: string; after: string }) => string[]
  errors?: Array<{ line: number; message: string; severity?: 'error' | 'warning' | 'info' }>
  showLineNumbers?: boolean
  height?: string
  placeholder?: string
}

// Clean DSL code editor without HTML bleeding issues
const DslEditor: React.FC<DslEditorProps> = ({ 
  value, 
  onChange, 
  className, 
  suggestions = [], 
  getSuggestions,
  errors = [],
  showLineNumbers = true,
  height = 'h-[600px]',
  placeholder = 'Type DSL syntax here...'
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  
  const [cursorPos, setCursorPos] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionItems, setSuggestionItems] = useState<string[]>([])
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)
  const suggestionListRef = useRef<HTMLDivElement>(null)
  const [suggestionPos, setSuggestionPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [currentToken, setCurrentToken] = useState('')
  const [tokenStart, setTokenStart] = useState(0)
  const [hoveredError, setHoveredError] = useState<number | null>(null)
  const [isNavigatingSuggestions, setIsNavigatingSuggestions] = useState(false)

  // Helper functions defined before use
  const escapeHtml = useCallback((str: string) => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }, [])

  // Tokenize a line into meaningful parts - defined first
  const tokenizeLine = useCallback((line: string) => {
    const tokens: Array<{ text: string; type: string }> = []
    let i = 0
    
    while (i < line.length) {
      const char = line[i]
      
      // Whitespace
      if (/\s/.test(char)) {
        let whitespace = ''
        while (i < line.length && /\s/.test(line[i])) {
          whitespace += line[i]
          i++
        }
        tokens.push({ text: whitespace, type: 'whitespace' })
        continue
      }
      
      // Operators
      if (i + 1 < line.length && line.slice(i, i + 2) === '->') {
        tokens.push({ text: '->', type: 'operator' })
        i += 2
        continue
      }
      
      // Single character symbols
      if ([':', '=', '?'].includes(char)) {
        tokens.push({ text: char, type: 'symbol' })
        i++
        continue
      }
      
      // Numbers
      if (/\d/.test(char)) {
        let number = ''
        while (i < line.length && /[\d.]/.test(line[i])) {
          number += line[i]
          i++
        }
        tokens.push({ text: number, type: 'number' })
        continue
      }
      
      // Words (identifiers, keywords, etc.)
      if (/[a-zA-Z_]/.test(char)) {
        let word = ''
        // Allow hyphens and dots inside identifiers/types
        while (i < line.length && /[a-zA-Z0-9_.-]/.test(line[i])) {
          word += line[i]
          i++
        }
        
        // Classify the word
        const lowerWord = word.toLowerCase()
        if (['settings', 'defaults', 'workflow', 'step', 'root', 'requires', 'retry', 'config', 'skip', 'stop', 'continue'].includes(lowerWord)) {
          tokens.push({ text: word, type: 'keyword' })
        } else if (['SUCCESS', 'FAILURE'].includes(word)) {
          tokens.push({ text: word, type: 'terminal' })
        } else if (['true', 'false'].includes(lowerWord)) {
          tokens.push({ text: word, type: 'boolean' })
        } else {
          tokens.push({ text: word, type: 'identifier' })
        }
        continue
      }
      
      // Everything else (including special characters)
      tokens.push({ text: char, type: 'other' })
      i++
    }
    
    return tokens
  }, [])

  // Safe token-level syntax highlighting function - defined after tokenizeLine
  const highlightTokens = useCallback((line: string) => {
    if (!line.trim()) return escapeHtml(line)
    
    const trimmed = line.trim()
    
    // Comments - highest priority
    if (trimmed.startsWith('#')) {
      return `<span class="text-gray-600 dark:text-gray-400 italic">${escapeHtml(line)}</span>`
    }
    
    // Use a safer approach - tokenize first, then highlight
    const tokens = tokenizeLine(line)
    return tokens.map(token => {
      const { text, type } = token
      const escaped = escapeHtml(text)
      
      switch (type) {
        case 'keyword':
          if (['settings', 'defaults'].includes(text.toLowerCase())) {
            return `<span class="text-blue-600 dark:text-blue-400 font-black">${escaped}</span>`
          }
          if (['workflow', 'step'].includes(text.toLowerCase())) {
            return `<span class="text-purple-600 dark:text-purple-400 font-black">${escaped}</span>`
          }
          if (['root', 'requires', 'retry', 'config'].includes(text.toLowerCase())) {
            return `<span class="text-emerald-600 dark:text-emerald-400 font-bold">${escaped}</span>`
          }
          if (['skip', 'stop', 'continue', 'retry'].includes(text.toLowerCase())) {
            return `<span class="text-pink-600 dark:text-pink-400 font-bold">${escaped}</span>`
          }
          return `<span class="text-purple-600 dark:text-purple-400 font-medium">${escaped}</span>`
        case 'identifier':
          return `<span class="text-indigo-600 dark:text-indigo-400 font-bold">${escaped}</span>`
        case 'operator':
          return `<span class="text-green-600 dark:text-green-400 font-bold">${escaped}</span>`
        case 'terminal':
          return `<span class="text-red-600 dark:text-red-400 font-bold">${escaped}</span>`
        case 'value':
          return `<span class="text-orange-600 dark:text-orange-400 font-medium">${escaped}</span>`
        case 'number':
          return `<span class="text-amber-600 dark:text-amber-400 font-medium">${escaped}</span>`
        case 'boolean':
          return `<span class="text-yellow-600 dark:text-yellow-400 font-medium">${escaped}</span>`
        case 'symbol':
          if (text === '?') {
            return `<span class="text-cyan-600 dark:text-cyan-400 font-medium">${escaped}</span>`
          }
          return `<span class="text-gray-800 dark:text-gray-200">${escaped}</span>`
        default:
          return escaped
      }
    }).join('')
  }, [escapeHtml, tokenizeLine])

  // Keep cursor in view when navigating
  const scrollCursorIntoView = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = value.slice(0, cursorPosition)
    const linesBeforeCursor = textBeforeCursor.split('\n')
    const currentLineIndex = linesBeforeCursor.length - 1
    
    // Calculate cursor line position
    const lineHeight = 20 // matches the lineHeight in CSS
    const cursorTop = currentLineIndex * lineHeight
    const containerHeight = textarea.clientHeight
    const scrollTop = textarea.scrollTop
    
    // Check if cursor is outside visible area
    const visibleTop = scrollTop
    const visibleBottom = scrollTop + containerHeight - 40 // 40px buffer for better UX
    
    if (cursorTop < visibleTop) {
      // Cursor is above visible area - scroll up
      textarea.scrollTop = Math.max(0, cursorTop - 20)
    } else if (cursorTop > visibleBottom) {
      // Cursor is below visible area - scroll down
      textarea.scrollTop = cursorTop - containerHeight + 60
    }
  }, [value])

  // Sync scroll between textarea and background with precise alignment
  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const background = backgroundRef.current
    const lineNumbers = lineNumbersRef.current
    
    if (textarea && background) {
      // Ensure pixel-perfect alignment for both axes
      requestAnimationFrame(() => {
        background.scrollTop = textarea.scrollTop
        background.scrollLeft = textarea.scrollLeft
        
        // Force layout recalculation
        background.style.transform = 'translateZ(0)'
      })
    }
    
    if (textarea && lineNumbers) {
      requestAnimationFrame(() => {
        lineNumbers.scrollTop = textarea.scrollTop
      })
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    
    // Multiple event listeners for better sync
    textarea.addEventListener('scroll', syncScroll)
    textarea.addEventListener('input', syncScroll)
    textarea.addEventListener('keyup', syncScroll)
    textarea.addEventListener('mouseup', syncScroll)
    
    // Initial sync
    syncScroll()
    
    return () => {
      textarea.removeEventListener('scroll', syncScroll)
      textarea.removeEventListener('input', syncScroll)
      textarea.removeEventListener('keyup', syncScroll)
      textarea.removeEventListener('mouseup', syncScroll)
    }
  }, [syncScroll])

  // Handle clicking outside to dismiss suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSuggestions) {
        const target = event.target as Element
        const suggestionPopup = document.querySelector('[data-suggestion-popup]')
        const textarea = textareaRef.current
        
        if (textarea && !textarea.contains(target) && suggestionPopup && !suggestionPopup.contains(target)) {
          setShowSuggestions(false)
        }
      }
    }
    
    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

  const lines = value.split('\n')
  const lineCount = lines.length

  // Generate line numbers
  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1)
  }, [lineCount])

  // Error markers by line
  const errorsByLine = useMemo(() => {
    const map = new Map<number, typeof errors[0][]>()
    errors.forEach(error => {
      const lineErrors = map.get(error.line) || []
      lineErrors.push(error)
      map.set(error.line, lineErrors)
    })
    return map
  }, [errors])

  // Enhanced syntax highlighting for background with precise token-level highlighting
  const highlightedContent = useMemo(() => {
    return lines.map((line, idx) => {
      const lineNum = idx + 1
      const hasError = errorsByLine.has(lineNum)
      
      // Apply token-level highlighting instead of line-level
      const highlightedLine = highlightTokens(line)
      
      let baseClassName = ''
      if (hasError) {
        baseClassName = 'bg-red-100 dark:bg-red-900/40 border-l-4 border-red-500 shadow-sm'
      }
      
      return {
        content: line || ' ', // Ensure empty lines have content
        highlightedHtml: highlightedLine,
        className: baseClassName,
        hasError
      }
    })
  }, [value, lines, errorsByLine, highlightTokens])


  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    updateSuggestions()
  }

  const updateSuggestions = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    setCursorPos(start)

    // Get current context
    const textBefore = value.slice(0, start)
    const currentLine = textBefore.split('\n').pop() || ''
    const textAfter = value.slice(end)
    
    // Find current token
    const tokenMatch = currentLine.match(/(^|\s)([^\s]*)$/)
    const token = tokenMatch ? tokenMatch[2] : ''
    const lineStart = start - currentLine.length
    const tokenStartPos = lineStart + (tokenMatch ? (tokenMatch.index || 0) + tokenMatch[1].length : currentLine.length)
    
    setCurrentToken(token)
    setTokenStart(tokenStartPos)

    // Get suggestions only if token has meaningful length
    let suggestions: string[] = []
    if (getSuggestions && token.length >= 1) {
      suggestions = getSuggestions({
        line: currentLine,
        before: textBefore,
        after: textAfter.split('\n')[0] || ''
      })
    }

    // Clean and filter suggestions more strictly
    const cleanSuggestions = suggestions
      .filter(s => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim())
      .filter(s => s.toLowerCase().startsWith(token.toLowerCase()) || token.length === 0)
      .slice(0, 6)

    setSuggestionItems(cleanSuggestions)
    // Only reset index if not actively navigating suggestions
    if (!isNavigatingSuggestions) {
      setActiveSuggestionIdx(0)
    }
    
    // Show suggestions with improved logic
    const hasAssignment = currentLine.includes('=') && !currentLine.endsWith('=')
    const shouldShow = cleanSuggestions.length > 0 && token.length >= 1 && !hasAssignment
    setShowSuggestions(shouldShow)

    // Position suggestions
    if (shouldShow) {
      positionSuggestions(textarea, start)
    }
  }, [value, getSuggestions])

  const positionSuggestions = (textarea: HTMLTextAreaElement, cursorPosition: number) => {
    // Simple positioning based on cursor
    const rect = textarea.getBoundingClientRect()
    const textBeforeCursor = value.slice(0, cursorPosition)
    const linesBeforeCursor = textBeforeCursor.split('\n').length - 1
    const lineHeight = 20 // approximate line height
    const charWidth = 8 // approximate character width
    const currentLineText = textBeforeCursor.split('\n').pop() || ''
    
    const top = linesBeforeCursor * lineHeight + 25
    const left = currentLineText.length * charWidth
    
    setSuggestionPos({ top, left })
  }

  const scrollToSuggestion = (index: number) => {
    const listElement = suggestionListRef.current
    if (!listElement) return
    
    const suggestionButtons = listElement.querySelectorAll('button')
    const targetButton = suggestionButtons[index]
    if (!targetButton) return
    
    // Scroll the target suggestion into view
    targetButton.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    })
  }

  const applySuggestion = (suggestion: string) => {
    console.log('applySuggestion called with:', suggestion)
    if (!suggestion) return
    
    const textarea = textareaRef.current
    if (!textarea) {
      console.log('No textarea ref available')
      return
    }
    
    const cleanSuggestion = suggestion.trim()
    console.log('Applying suggestion:', cleanSuggestion)
    
    // Get current cursor position
    const currentCursor = textarea.selectionStart
    const textBefore = value.slice(0, currentCursor)
    const textAfter = value.slice(currentCursor)
    
    // Find the start of the current token being typed
    const currentLine = textBefore.split('\n').pop() || ''
    const tokenMatch = currentLine.match(/(^|\s)([^\s]*)$/)
    const token = tokenMatch ? tokenMatch[2] : ''
    
    // Calculate the actual start position of the token
    const lineStart = currentCursor - currentLine.length
    const actualTokenStart = lineStart + (tokenMatch ? (tokenMatch.index || 0) + tokenMatch[1].length : currentLine.length)
    
    // Replace the partial token with the full suggestion
    const newValue = value.slice(0, actualTokenStart) + cleanSuggestion + textAfter
    console.log('Old value:', value)
    console.log('New value:', newValue)
    console.log('Token start:', actualTokenStart, 'Current cursor:', currentCursor)
    console.log('Text before:', textBefore)
    console.log('Current line:', currentLine)
    console.log('Token:', token)
    
    onChange(newValue)
    
    // Update cursor position after the suggestion
    const newCursorPos = actualTokenStart + cleanSuggestion.length
    console.log('New cursor position:', newCursorPos)
    
    // Use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = newCursorPos
        textarea.focus()
        setCursorPos(newCursorPos)
      }
    })
    
    setShowSuggestions(false)
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Reset navigation flag when releasing arrow keys
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      setIsNavigatingSuggestions(false)
      // Also ensure cursor stays in view for arrow keys
      setTimeout(() => {
        scrollCursorIntoView()
        syncScroll()
      }, 0)
    }
    // Call updateSuggestions for other keys
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      updateSuggestions()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Always handle Escape to dismiss suggestions
    if (e.key === 'Escape' && showSuggestions) {
      e.preventDefault()
      setShowSuggestions(false)
      return
    }

    if (showSuggestions && suggestionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIsNavigatingSuggestions(true)
        setActiveSuggestionIdx(prev => {
          const newIdx = Math.min(prev + 1, suggestionItems.length - 1)
          scrollToSuggestion(newIdx)
          return newIdx
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIsNavigatingSuggestions(true)
        setActiveSuggestionIdx(prev => {
          const newIdx = Math.max(prev - 1, 0)
          scrollToSuggestion(newIdx)
          return newIdx
        })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const selectedSuggestion = suggestionItems[activeSuggestionIdx]
        if (selectedSuggestion) {
          applySuggestion(selectedSuggestion)
        }
        return
      }
      // Dismiss suggestions on Space if not completing
      if (e.key === ' ' && currentToken.length === 0) {
        setShowSuggestions(false)
      }
    }

    // Auto-indent on Enter
    if (e.key === 'Enter') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const beforeCursor = value.slice(0, start)
      const currentLine = beforeCursor.split('\n').pop() || ''
      const indent = currentLine.match(/^\s*/)?.[0] || ''
      
      let extraIndent = ''
      if (currentLine.trim().endsWith(':')) {
        extraIndent = '  '
      }
      
      const newValue = value.slice(0, start) + '\n' + indent + extraIndent + value.slice(textarea.selectionEnd)
      onChange(newValue)
      
      setTimeout(() => {
        const newPos = start + 1 + indent.length + extraIndent.length
        textarea.selectionStart = textarea.selectionEnd = newPos
        scrollCursorIntoView()
        syncScroll()
      }, 0)
    }

    // Tab handling
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + '  ' + value.slice(end)
      onChange(newValue)
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
        scrollCursorIntoView()
        syncScroll()
      }, 0)
    }

    // Track cursor movement for navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      setTimeout(() => {
        scrollCursorIntoView()
        syncScroll()
      }, 0)
    }
  }

  return (
    <div className={cn('relative font-mono text-sm border rounded-lg overflow-hidden bg-white dark:bg-gray-900', className, height)}>
      <div className="relative flex h-full">
        {/* Line numbers */}
        {showLineNumbers && (
          <div 
            ref={lineNumbersRef}
            className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden select-none"
            style={{ width: `${Math.max(4, String(lineCount).length + 2)}ch` }}
          >
            <div className="p-3 pr-3 text-right text-xs font-mono" style={{ lineHeight: '20px', fontSize: '12px' }}>
              {lineNumbers.map(lineNum => {
                const hasError = errorsByLine.has(lineNum)
                const errorData = errorsByLine.get(lineNum)?.[0]
                return (
                  <div
                    key={lineNum}
                    className={cn(
                      'relative group cursor-pointer px-1 rounded transition-all duration-200',
                      hasError 
                        ? 'text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/30' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    )}
                    style={{ 
                      lineHeight: '20px', 
                      minHeight: '20px',
                      fontSize: '12px'
                    }}
                    onMouseEnter={() => hasError && setHoveredError(lineNum)}
                    onMouseLeave={() => setHoveredError(null)}
                  >
                    {lineNum}
                    {hasError && (
                      <div className="absolute -left-2 top-0 w-2 h-full bg-gradient-to-r from-red-500 to-red-600 rounded-r shadow-sm animate-pulse"></div>
                    )}
                    
                    {/* Error tooltip */}
                    {hoveredError === lineNum && errorData && (
                      <div className="absolute left-full top-0 ml-3 z-50 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-red-200 dark:border-red-600 rounded-xl shadow-2xl p-3 min-w-52 max-w-72 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                          {errorData.severity === 'error' ? (
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          ) : errorData.severity === 'warning' ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <div className="font-bold text-sm text-gray-900 dark:text-gray-100">
                              Line {errorData.line} • {errorData.severity || 'Error'}
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
                              {errorData.message}
                            </div>
                          </div>
                        </div>
                        {/* Arrow pointer */}
                        <div className="absolute left-0 top-3 -ml-2 w-4 h-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-l-2 border-t-2 border-red-200 dark:border-red-600 transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 relative overflow-auto" style={{ isolation: 'isolate' }}>
          {/* Syntax highlighting background */}
          <div
            ref={backgroundRef}
            className="absolute inset-0 p-3 overflow-hidden pointer-events-none whitespace-pre font-mono z-10"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: '14px',
              lineHeight: '20px',
              letterSpacing: '0',
              overflowX: 'hidden',
              overflowY: 'hidden'
            }}
          >
            {highlightedContent.map((lineData, idx) => (
              <div
                key={idx}
                className={cn('min-h-[20px]', lineData.className)}
                style={{ 
                  lineHeight: '20px', 
                  minHeight: '20px',
                  fontSize: '14px',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
                }}
                dangerouslySetInnerHTML={{ __html: lineData.highlightedHtml || lineData.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}
              />
            ))}
          </div>
          
          {/* Main textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onClick={() => {
              updateSuggestions()
              setTimeout(() => {
                scrollCursorIntoView()
                syncScroll()
              }, 0)
            }}
            onFocus={() => {
              updateSuggestions()
              setTimeout(() => {
                scrollCursorIntoView()
                syncScroll()
              }, 0)
            }}
            onScroll={syncScroll}
            className={cn(
              'relative w-full h-full resize-none bg-transparent p-3 outline-none z-20',
              'text-transparent caret-blue-500 selection:bg-blue-200 dark:selection:bg-blue-800/50',
              'overflow-auto'
            )}
            data-scrollbar-styled="true"
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: '14px',
              lineHeight: '20px',
              letterSpacing: '0',
              WebkitTextFillColor: 'transparent',
              wordWrap: 'off',
              whiteSpace: 'pre'
            }}
          />

          {/* Suggestion popup - Simplified & Professional */}
          {showSuggestions && suggestionItems.length > 0 && (
            <div
              data-suggestion-popup
              className="absolute z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-w-xs overflow-hidden"
              style={{
                top: Math.min(suggestionPos.top, 400),
                left: Math.min(suggestionPos.left, 300)
              }}
            >
              {/* Header */}
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Suggestions
                </div>
              </div>
              
              {/* Suggestion items */}
              <div ref={suggestionListRef} className="py-1 max-h-48 overflow-y-auto">
                {suggestionItems.map((item, idx) => (
                  <button
                    key={`${idx}-${item}`}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left transition-colors duration-75 focus:outline-none',
                      idx === activeSuggestionIdx
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      applySuggestion(item)
                    }}
                    onMouseEnter={() => setActiveSuggestionIdx(idx)}
                    onMouseDown={(e) => {
                      // Prevent textarea from losing focus
                      e.preventDefault()
                    }}
                  >
                    <div className="font-mono truncate">
                      {item}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Footer with hint */}
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span>↑↓ Navigate</span>
                  <span>⏎ Select</span>
                  <span>⎋ Close</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DslEditor
