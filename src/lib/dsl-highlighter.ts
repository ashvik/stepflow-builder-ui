export class DslHighlighter {
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  static highlight(dsl: string): string {
    if (!dsl) return ''
    
    const lines = dsl.split('\n')
    const highlightedLines = lines.map((line, index) => {
      return this.highlightLine(line, index)
    })
    
    return highlightedLines.join('\n')
  }

  private static highlightLine(line: string, lineNumber: number): string {
    if (!line.trim()) return line

    // Handle comments first
    const commentMatch = line.match(/^([^#"']*(?:"[^"]*"|'[^']*')*)(.*)$/)
    if (commentMatch) {
      let [, beforeComment, afterComment] = commentMatch
      const hashIndex = afterComment.indexOf('#')
      if (hashIndex !== -1) {
        const comment = afterComment.substring(hashIndex)
        afterComment = afterComment.substring(0, hashIndex)
        return this.highlightLineContent(beforeComment + afterComment) + 
               `<span class="dsl-comment">${this.escapeHtml(comment)}</span>`
      }
    }

    return this.highlightLineContent(line)
  }

  private static highlightLineContent(line: string): string {
    // Detect indentation
    const indentMatch = line.match(/^(\s*)(.*)$/)
    if (!indentMatch) return this.escapeHtml(line)
    
    const [, indent, content] = indentMatch
    let result = content

    // Don't process empty lines
    if (!result.trim()) {
      return line
    }

    // Escape HTML first, then add our spans
    result = this.escapeHtml(result)

    // Handle section headers (settings:, defaults:)
    result = result.replace(
      /^(settings|defaults)(\s*):(.*)$/gi,
      '<span class="dsl-section">$1</span>$2<span class="dsl-punctuation">:</span>$3'
    )

    // Handle workflow definitions
    result = result.replace(
      /^(workflow)(\s+)([A-Za-z_][\w]*)(\s*):(.*)$/gi,
      '<span class="dsl-keyword">$1</span>$2<span class="dsl-identifier">$3</span>$4<span class="dsl-punctuation">:</span>$5'
    )

    // Handle step definitions
    result = result.replace(
      /^(step)(\s+)([A-Za-z_][\w]*)(\s*):(\s*)([A-Za-z_][\w\.]*)(.*)$/gi,
      '<span class="dsl-keyword">$1</span>$2<span class="dsl-identifier">$3</span>$4<span class="dsl-punctuation">:</span>$5<span class="dsl-type">$6</span>$7'
    )

    // Handle root declarations
    result = result.replace(
      /^(root)(\s*):(\s*)([A-Za-z_][\w]*)(.*)$/gi,
      '<span class="dsl-property">$1</span>$2<span class="dsl-punctuation">:</span>$3<span class="dsl-identifier">$4</span>$5'
    )

    // Handle edge syntax (step1 -> step2)
    result = result.replace(
      /([A-Za-z_][\w]*)(\s*)(->)(\s*)([A-Za-z_][\w]*|SUCCESS|FAILURE)/g,
      '<span class="dsl-identifier">$1</span>$2<span class="dsl-arrow">$3</span>$4<span class="dsl-identifier">$5</span>'
    )

    // Handle guard syntax (? guardName)
    result = result.replace(
      /(\?)(\s*)([A-Za-z_][\w]*)/g,
      '<span class="dsl-operator">$1</span>$2<span class="dsl-guard">$3</span>'
    )

    // Handle special keywords
    result = result.replace(
      /\b(fail|retry|skip|stop|continue|requires|config|SUCCESS|FAILURE)\b/gi,
      '<span class="dsl-keyword">$1</span>'
    )

    // Handle property assignments (key = value)
    result = result.replace(
      /^([A-Za-z_][\w\.]*)(\s*)(=)(\s*)(.+)$/g,
      '<span class="dsl-property">$1</span>$2<span class="dsl-operator">$3</span>$4<span class="dsl-value">$5</span>'
    )

    // Handle property names (key:)
    result = result.replace(
      /^([A-Za-z_][\w]*)(\s*)(:)(.*)$/g,
      '<span class="dsl-property">$1</span>$2<span class="dsl-punctuation">$3</span>$4'
    )

    // Handle numbers
    result = result.replace(
      /\b(\d+(?:\.\d+)?)\b/g,
      '<span class="dsl-number">$1</span>'
    )

    // Handle quoted strings - need to handle escaped HTML
    result = result.replace(
      /&quot;([^&]*(?:&[^;]*;[^&]*)*)&quot;/g,
      '<span class="dsl-string">&quot;<span class="dsl-string-content">$1</span>&quot;</span>'
    )

    // Handle booleans
    result = result.replace(
      /\b(true|false)\b/gi,
      '<span class="dsl-boolean">$1</span>'
    )

    // Handle retry patterns (3x, 1000ms, etc.)
    result = result.replace(
      /\b(\d+x|\d+(?:ms|s|m))\b/g,
      '<span class="dsl-duration">$1</span>'
    )

    return indent + result
  }

  static getStylesheet(): string {
    return `
      .dsl-section { 
        color: #8250df; 
        font-weight: 700; 
      }
      .dark .dsl-section { 
        color: #d2a8ff; 
      }
      
      .dsl-keyword { 
        color: #cf222e; 
        font-weight: 600; 
      }
      .dark .dsl-keyword { 
        color: #ff7b72; 
      }
      
      .dsl-identifier { 
        color: #0969da; 
        font-weight: 500; 
      }
      .dark .dsl-identifier { 
        color: #58a6ff; 
      }
      
      .dsl-type {
        color: #1f883d;
        font-weight: 500;
      }
      .dark .dsl-type {
        color: #3fb950;
      }
      
      .dsl-property { 
        color: #0550ae; 
        font-weight: 500; 
      }
      .dark .dsl-property { 
        color: #79c0ff; 
      }
      
      .dsl-value {
        color: #0a3069;
      }
      .dark .dsl-value {
        color: #a5d6ff;
      }
      
      .dsl-string { 
        color: #0a3069; 
      }
      .dark .dsl-string { 
        color: #a5d6ff; 
      }
      
      .dsl-string-content {
        color: #0550ae;
      }
      .dark .dsl-string-content {
        color: #79c0ff;
      }
      
      .dsl-number { 
        color: #0550ae; 
        font-weight: 500; 
      }
      .dark .dsl-number { 
        color: #79c0ff; 
      }
      
      .dsl-boolean { 
        color: #cf222e; 
        font-weight: 600; 
      }
      .dark .dsl-boolean { 
        color: #ff7b72; 
      }
      
      .dsl-duration {
        color: #8250df;
        font-weight: 500;
      }
      .dark .dsl-duration {
        color: #d2a8ff;
      }
      
      .dsl-comment { 
        color: #656d76; 
        font-style: italic; 
      }
      .dark .dsl-comment { 
        color: #8b949e; 
      }
      
      .dsl-arrow { 
        color: #cf222e; 
        font-weight: 700; 
      }
      .dark .dsl-arrow { 
        color: #ff7b72; 
      }
      
      .dsl-operator { 
        color: #8250df; 
        font-weight: 600; 
      }
      .dark .dsl-operator { 
        color: #d2a8ff; 
      }
      
      .dsl-guard {
        color: #1f883d;
        font-weight: 500;
      }
      .dark .dsl-guard {
        color: #3fb950;
      }
      
      .dsl-punctuation { 
        color: #24292f; 
      }
      .dark .dsl-punctuation { 
        color: #f0f6fc; 
      }
    `
  }
}