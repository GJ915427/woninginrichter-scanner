/**
 * Material Design 3 Markdown & Plaintext Renderer with Native Mermaid Support.
 * Powered by marked.js AST compiler with zero-CDN local vendoring.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkdownRenderer = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Resolve marked library
  let markedObj = null;
  if (typeof window !== 'undefined' && window.marked) {
    markedObj = window.marked;
  } else if (typeof globalThis !== 'undefined' && globalThis.marked) {
    markedObj = globalThis.marked;
  } else if (typeof require !== 'undefined') {
    try {
      const path = require('path');
      const markedPath = path.resolve(__dirname, '../vendor/marked/marked.min.js');
      markedObj = require(markedPath);
    } catch (e) {
      try {
        markedObj = require('marked');
      } catch (err) {
        // Fallback
      }
    }
  }

  /**
   * Escape special HTML characters to prevent XSS.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Plain text renderer for .txt files.
   */
  function renderPlainText(text) {
    if (!text) return '';
    const safe = escapeHtml(text);
    const paragraphs = safe.split(/\n{2,}/);
    return paragraphs
      .map(p => `<p class="m3-paragraph">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
  }

  // Initialize marked instance with custom M3 & Mermaid AST renderer
  let markedInstance = null;
  if (markedObj) {
    const MarkedConstructor = markedObj.Marked || (markedObj.marked && markedObj.marked.Marked) || (typeof markedObj === 'function' ? markedObj : null);
    if (MarkedConstructor && typeof MarkedConstructor === 'function') {
      markedInstance = new MarkedConstructor();
    } else if (typeof markedObj.parse === 'function') {
      markedInstance = markedObj;
    }

    const m3Renderer = {
      heading(text, level, raw) {
        const cleanSlug = (raw || text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const headingId = cleanSlug ? `heading-${cleanSlug}` : `heading-${level}`;
        return `<h${level} id="${headingId}" class="m3-heading-${level}">${text}</h${level}>\n`;
      },

      code(code, infostring, escaped) {
        const rawInfo = (infostring || '').trim();
        const parts = rawInfo.split(/\s+/);
        const lang = (parts[0] || '').toLowerCase();

        let title = '';
        const titleMatch = rawInfo.match(/title=["']([^"']+)["']/);
        if (titleMatch) {
          title = titleMatch[1];
        }

        if (lang === 'mermaid') {
          const cleanCode = (code || '').replace(/\n+$/, '');
          const encodedCode = encodeURIComponent(cleanCode);
          const safeEscapedCode = cleanCode.replace(/&/g, '&amp;').replace(/</g, '&lt;');
          const displayTitle = title ? escapeHtml(title) : 'Diagram';

          return `<div class="m3-mermaid-box" data-mermaid-code="${encodedCode}">` +
            `<div class="m3-mermaid-header" data-doc-review-ignore="true">` +
              `<div class="m3-mermaid-header__left" data-doc-review-ignore="true">` +
                `<span class="m3-mermaid-lang" data-doc-review-ignore="true">MERMAID</span>` +
                `<span class="m3-mermaid-title" data-doc-review-ignore="true">${displayTitle}</span>` +
              `</div>` +
              `<div class="m3-mermaid-header__actions" data-doc-review-ignore="true">` +
                `<button type="button" class="m3-mermaid-toggle-btn m3-code-copy-btn" data-doc-review-ignore="true" title="Toon/verberg broncode">` +
                  `<span class="material-symbols-outlined" data-doc-review-ignore="true">code</span>` +
                `</button>` +
              `</div>` +
            `</div>` +
            `<div class="m3-mermaid-render-area" data-doc-review-ignore="true">` +
              `<div class="m3-mermaid-skeleton" data-doc-review-ignore="true">` +
                `<div class="m3-skeleton-pulse" data-doc-review-ignore="true"></div>` +
              `</div>` +
            `</div>` +
            `<pre class="m3-mermaid-source m3-code-block" style="display: none;"><code class="language-mermaid">${safeEscapedCode}</code></pre>` +
          `</div>\n`;
        }

        const safeLang = escapeHtml(lang || 'plaintext');
        const cleanCode = (code || '').replace(/\n+$/, '');
        const safeCode = escapeHtml(cleanCode);
        return `<div class="m3-code-box">` +
          `<div class="m3-code-header" data-doc-review-ignore="true">` +
            `<span class="m3-code-lang" data-doc-review-ignore="true">${safeLang.toUpperCase()}</span>` +
            `<button type="button" class="m3-code-copy-btn" data-doc-review-ignore="true" title="Kopieer code">` +
              `<span class="material-symbols-outlined" data-doc-review-ignore="true">content_copy</span>` +
            `</button>` +
          `</div>` +
          `<pre class="m3-code-block"><code class="language-${safeLang}">${safeCode}</code></pre>` +
        `</div>\n`;
      },

      blockquote(quote) {
        const calloutMatch = quote.match(/<p[^>]*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>|\n)?([\s\S]*?)<\/p>([\s\S]*)/i);
        if (calloutMatch) {
          const type = calloutMatch[1].toLowerCase();
          const firstLineBody = calloutMatch[2];
          const remainingQuote = calloutMatch[3] || '';
          const icons = {
            note: 'info',
            tip: 'lightbulb',
            important: 'priority_high',
            warning: 'warning',
            caution: 'report'
          };
          const icon = icons[type] || 'info';
          const title = type.charAt(0).toUpperCase() + type.slice(1);
          const bodyHtml = (firstLineBody ? `<p class="m3-paragraph">${firstLineBody}</p>` : '') + remainingQuote;

          return `<div class="m3-callout m3-callout--${type}">` +
            `<div class="m3-callout__header" data-doc-review-ignore="true">` +
              `<span class="m3-callout__icon material-symbols-outlined" data-doc-review-ignore="true">${icon}</span>` +
              `<span class="m3-callout__title" data-doc-review-ignore="true">${title}</span>` +
            `</div>` +
            `<div class="m3-callout__content">${bodyHtml}</div>` +
          `</div>\n`;
        }

        return `<blockquote class="m3-blockquote">${quote}</blockquote>\n`;
      },

      table(header, body) {
        return `<div class="m3-table-wrapper"><table class="m3-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
      },

      paragraph(text) {
        return `<p class="m3-paragraph">${text}</p>\n`;
      },

      codespan(text) {
        return `<code class="m3-inline-code">${text}</code>`;
      },

      html(html) {
        return escapeHtml(html);
      },

      link(href, title, text) {
        const safeHref = escapeHtml(href || '');
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${safeHref}" class="m3-link" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
      }
    };

    markedInstance.use({
      gfm: true,
      breaks: true,
      pedantic: false,
      renderer: m3Renderer
    });
  }

  /**
   * Main Markdown render function using marked AST compiler.
   */
  function renderMarkdown(rawMarkdown) {
    if (!rawMarkdown) return '';
    if (!markedInstance) {
      return renderPlainText(rawMarkdown);
    }
    return markedInstance.parse(rawMarkdown);
  }

  /**
   * Legacy table renderer export for test contracts.
   */
  function renderTable(tableLines) {
    if (!tableLines || !tableLines.length) return '';
    return renderMarkdown(tableLines.join('\n'));
  }

  /**
   * Legacy callout renderer export for test contracts.
   */
  function renderCalloutOrQuote(lines) {
    if (!lines || !lines.length) return '';
    return renderMarkdown(lines.join('\n'));
  }

  /**
   * Master renderer deciding between Markdown and Plain Text.
   */
  function renderDocument(content, filenameOrFormat) {
    if (!content) return '';
    const descriptor = (filenameOrFormat || '').toLowerCase();
    if (descriptor.endsWith('.txt') || descriptor === 'text' || descriptor === 'plain') {
      return renderPlainText(content);
    }
    return renderMarkdown(content);
  }

  return {
    escapeHtml: escapeHtml,
    renderPlainText: renderPlainText,
    renderMarkdown: renderMarkdown,
    renderTable: renderTable,
    renderCalloutOrQuote: renderCalloutOrQuote,
    renderDocument: renderDocument
  };
}));
