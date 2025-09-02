export class YamlHighlighter {
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  static highlight(yaml: string): string {
    if (!yaml) return ''
    
    const lines = yaml.split('\n')
    const highlightedLines = lines.map((line, index) => {
      return this.highlightLine(line, index)
    })
    
    return highlightedLines.join('\n')
  }

  private static highlightLine(line: string, lineNumber: number): string {
    if (!line.trim()) return line

    // Handle comments first (everything after # that's not in a string)
    const commentMatch = line.match(/^([^#"']*(?:"[^"]*"|'[^']*')*)(.*)$/)
    if (commentMatch) {
      let [, beforeComment, afterComment] = commentMatch
      const hashIndex = afterComment.indexOf('#')
      if (hashIndex !== -1) {
        const comment = afterComment.substring(hashIndex)
        afterComment = afterComment.substring(0, hashIndex)
        return this.highlightLineContent(beforeComment + afterComment) + 
               `<span class="yaml-comment">${this.escapeHtml(comment)}</span>`
      }
    }

    return this.highlightLineContent(line)
  }

  private static highlightLineContent(line: string): string {
    let result = line

    // Detect indentation
    const indentMatch = result.match(/^(\s*)(.*)$/)
    if (!indentMatch) return this.escapeHtml(result)
    
    const [, indent, content] = indentMatch
    
    // Handle different YAML constructs
    result = content

    // Handle keys (word followed by colon)
    result = result.replace(
      /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/g,
      '<span class="yaml-key">$1</span><span class="yaml-punctuation">:</span>'
    )

    // Handle array items (- at start)
    result = result.replace(
      /^(\s*)(-\s*)/g,
      '$1<span class="yaml-array-item">-</span> '
    )

    // Handle strings (quoted)
    result = result.replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      '<span class="yaml-string">"<span class="yaml-string-content">$1</span>"</span>'
    )
    
    result = result.replace(
      /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      '<span class="yaml-string">\'<span class="yaml-string-content">$1</span>\'</span>'
    )

    // Handle unquoted strings that look like values
    result = result.replace(
      /:\s+([^#\n\r]+?)(\s*$)/g,
      ': <span class="yaml-unquoted-string">$1</span>$2'
    )

    // Handle booleans
    result = result.replace(
      /\b(true|false|True|False|TRUE|FALSE)\b/g,
      '<span class="yaml-boolean">$1</span>'
    )

    // Handle null values
    result = result.replace(
      /\b(null|NULL|Null|~)\b/g,
      '<span class="yaml-null">$1</span>'
    )

    // Handle numbers
    result = result.replace(
      /\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
      '<span class="yaml-number">$1</span>'
    )

    // Handle YAML special constructs
    result = result.replace(
      /(\||\>|\||-)(\d*[+-]?)/g,
      '<span class="yaml-literal">$1$2</span>'
    )

    // Handle anchors and references
    result = result.replace(
      /(&[a-zA-Z_][a-zA-Z0-9_-]*)/g,
      '<span class="yaml-anchor">$1</span>'
    )
    
    result = result.replace(
      /(\*[a-zA-Z_][a-zA-Z0-9_-]*)/g,
      '<span class="yaml-reference">$1</span>'
    )

    return this.escapeHtml(indent) + result
  }

  static getStylesheet(): string {
    return `
      .yaml-key { 
        color: #0969da; 
        font-weight: 600; 
      }
      .dark .yaml-key { 
        color: #58a6ff; 
      }
      
      .yaml-string { 
        color: #0a3069; 
      }
      .dark .yaml-string { 
        color: #a5d6ff; 
      }
      
      .yaml-string-content {
        color: #0550ae;
      }
      .dark .yaml-string-content {
        color: #79c0ff;
      }
      
      .yaml-unquoted-string {
        color: #0550ae;
      }
      .dark .yaml-unquoted-string {
        color: #79c0ff;
      }
      
      .yaml-number { 
        color: #0550ae; 
        font-weight: 500; 
      }
      .dark .yaml-number { 
        color: #79c0ff; 
      }
      
      .yaml-boolean { 
        color: #cf222e; 
        font-weight: 600; 
      }
      .dark .yaml-boolean { 
        color: #ff7b72; 
      }
      
      .yaml-null { 
        color: #656d76; 
        font-style: italic; 
      }
      .dark .yaml-null { 
        color: #8b949e; 
      }
      
      .yaml-comment { 
        color: #656d76; 
        font-style: italic; 
      }
      .dark .yaml-comment { 
        color: #8b949e; 
      }
      
      .yaml-array-item { 
        color: #cf222e; 
        font-weight: bold; 
      }
      .dark .yaml-array-item { 
        color: #ff7b72; 
      }
      
      .yaml-punctuation { 
        color: #24292f; 
      }
      .dark .yaml-punctuation { 
        color: #f0f6fc; 
      }
      
      .yaml-literal { 
        color: #8250df; 
        font-weight: 600; 
      }
      .dark .yaml-literal { 
        color: #d2a8ff; 
      }
      
      .yaml-anchor { 
        color: #1f883d; 
        font-weight: 600; 
      }
      .dark .yaml-anchor { 
        color: #3fb950; 
      }
      
      .yaml-reference { 
        color: #0969da; 
        font-weight: 600; 
      }
      .dark .yaml-reference { 
        color: #58a6ff; 
      }
    `
  }
}