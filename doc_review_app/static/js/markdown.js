/**
 * Google Material Design 3 Markdown & Plain Text Rendering Pipeline
 * Target Application: Document Review Web Application
 * Safely parses Markdown and plain text documents with complete XSS sanitization,
 * GFM tables, multi-line blockquotes, GitHub callouts/alerts, task lists, and code boxes.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkdownRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Escape HTML entities to prevent Cross-Site Scripting (XSS).
   * @param {string} str - Raw input text
   * @returns {string} Escaped safe HTML text
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Render plain text (.txt) document preserving newlines, whitespace, and formatting verbatim.
   * @param {string} content - Raw plain text
   * @returns {string} Formatted HTML pre block
   */
  function renderPlainText(content) {
    const safeContent = escapeHtml(content || '');
    return `<pre class="m3-plain-text"><code>${safeContent}</code></pre>`;
  }

  /**
   * Format inline markdown spans (bold, italic, strikethrough, links, kbd) with complete HTML escaping.
   * @param {string} str - Unformatted inline text
   * @returns {string} Safe HTML string with inline formatting tags
   */
  function formatInline(str) {
    if (!str) return '';
    let res = escapeHtml(str);
    // Bold: **text** or __text__
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    res = res.replace(/(?<!\*)\*(?!\s)([^\*\n]+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');
    res = res.replace(/(?<!_)_(?!\s)([^_\n]+?)(?<!\s)_(?!_)/g, '<em>$1</em>');
    // Strikethrough: ~~text~~
    res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // Keyboard caps: <kbd>key</kbd>
    res = res.replace(/&lt;kbd&gt;(.*?)&lt;\/kbd&gt;/gi, '<kbd class="m3-kbd">$1</kbd>');
    // Markdown Links: [title](url)
    res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (m, title, url) {
      const cleanUrl = url.trim();
      const safeHref = /^https?:\/\//i.test(cleanUrl) || cleanUrl.startsWith('#') || cleanUrl.startsWith('/')
        ? cleanUrl
        : '#';
      return `<a href="${safeHref}" class="m3-link" target="_blank" rel="noopener noreferrer">${title}</a>`;
    });
    return res;
  }

  /**
   * Render GFM Table rows with column alignments and strict zero inter-tag whitespace.
   * @param {string[]} tableLines - Array of markdown table lines
   * @returns {string} Rendered table HTML
   */
  function renderTable(tableLines) {
    if (tableLines.length < 2) return tableLines.join('\n');
    const headerLine = tableLines[0].trim();
    const sepLine = tableLines[1].trim();
    const sepParts = sepLine.replace(/^\||\|$/g, '').split('|').map(function (s) { return s.trim(); });
    const alignments = sepParts.map(function (p) {
      const left = p.startsWith(':');
      const right = p.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return 'left';
    });

    const headerCells = headerLine.replace(/^\||\|$/g, '').split('|');
    let html = '<div class="m3-table-wrapper"><table class="m3-table"><thead><tr>';
    for (let c = 0; c < headerCells.length; c++) {
      const align = alignments[c] || 'left';
      const cellContent = formatInline(headerCells[c].trim());
      html += `<th style="text-align:${align};">${cellContent}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let r = 2; r < tableLines.length; r++) {
      const rowLine = tableLines[r].trim();
      if (!rowLine || !rowLine.includes('|')) continue;
      const rowCells = rowLine.replace(/^\||\|$/g, '').split('|');
      html += '<tr>';
      for (let c = 0; c < headerCells.length; c++) {
        const align = alignments[c] || 'left';
        const cellRaw = (rowCells[c] !== undefined ? rowCells[c] : '').trim();
        const cellContent = formatInline(cellRaw);
        html += `<td style="text-align:${align};">${cellContent}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  /**
   * Render multi-line quotes or GitHub callouts/alerts (> [!NOTE], etc.)
   * @param {string[]} quoteLines - Lines belonging to quote block
   * @returns {string} Rendered blockquote or callout HTML
   */
  function renderCalloutOrQuote(quoteLines) {
    if (quoteLines.length === 0) return '';
    const rawLines = quoteLines.map(function (l) {
      return l.replace(/^>\s?/, '');
    });

    const firstLine = rawLines[0].trim();
    const alertMatch = firstLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);

    if (alertMatch) {
      const type = alertMatch[1].toLowerCase();
      let icon = 'info';
      let title = 'Opmerking';
      if (type === 'tip') {
        icon = 'lightbulb';
        title = 'Tip';
      } else if (type === 'important') {
        icon = 'priority_high';
        title = 'Belangrijk';
      } else if (type === 'warning') {
        icon = 'warning';
        title = 'Waarschuwing';
      } else if (type === 'caution') {
        icon = 'report';
        title = 'Let op';
      }

      const bodyLines = rawLines.slice(1);
      const innerHtml = bodyLines.map(function (l) {
        if (!l.trim()) return '';
        return `<p class="m3-callout-paragraph">${formatInline(l)}</p>`;
      }).filter(Boolean).join('');

      return `<div class="m3-callout m3-callout--${type}"><div class="m3-callout__header" data-doc-review-ignore="true"><span class="material-symbols-outlined m3-callout__icon" data-doc-review-ignore="true">${icon}</span><span class="m3-callout__title" data-doc-review-ignore="true">${title}</span></div><div class="m3-callout__body">${innerHtml}</div></div>`;
    }

    const innerHtml = rawLines.map(function (l) {
      const trimmed = l.trim();
      if (!trimmed) return '';
      const listMatch = trimmed.match(/^([\*\-]|\+)\s+(.*)$/);
      if (listMatch) {
        return `<li class="m3-blockquote-item">${formatInline(listMatch[2])}</li>`;
      }
      return `<p class="m3-blockquote-paragraph">${formatInline(l)}</p>`;
    }).filter(Boolean).join('');

    return `<blockquote class="m3-blockquote">${innerHtml}</blockquote>`;
  }

  /**
   * Parse Markdown text into semantic HTML conforming to Google M3 typography standards.
   * @param {string} rawMarkdown - Markdown text
   * @returns {string} Sanitized semantic HTML
   */
  function renderMarkdown(rawMarkdown) {
    if (!rawMarkdown) return '';

    // Standardize line breaks
    let text = String(rawMarkdown).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Extract fenced code blocks first
    const codeBlocks = [];
    text = text.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, function (match, lang, code) {
      const token = `@@M3CODEBLOCK${codeBlocks.length}@@`;
      const cleanLang = escapeHtml(lang.trim());
      const cleanCode = escapeHtml(code);
      codeBlocks.push(
        `<div class="m3-code-box">` +
          `<div class="m3-code-header" data-doc-review-ignore="true">` +
            `<span class="m3-code-lang" data-doc-review-ignore="true">${cleanLang || 'code'}</span>` +
            `<button class="m3-code-copy-btn" data-doc-review-ignore="true" title="Kopieer code">` +
              `<span class="material-symbols-outlined" data-doc-review-ignore="true">content_copy</span>` +
            `</button>` +
          `</div>` +
          `<pre class="m3-code-block"><code class="${cleanLang ? 'language-' + cleanLang : ''}">${cleanCode}</code></pre>` +
        `</div>`
      );
      return token;
    });

    // 2. Extract inline code spans
    const inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, function (match, code) {
      const token = `@@M3INLINECODE${inlineCodes.length}@@`;
      inlineCodes.push(`<code class="m3-inline-code">${escapeHtml(code)}</code>`);
      return token;
    });

    // 3. Stateful line & block processing
    const inputLines = text.split('\n');
    const outputBlocks = [];
    let headingCounter = 0;

    let i = 0;
    while (i < inputLines.length) {
      const line = inputLines[i];
      const trimmed = line.trim();

      // Check code block placeholder
      if (trimmed.startsWith('@@M3CODEBLOCK')) {
        outputBlocks.push(trimmed);
        i++;
        continue;
      }

      // Horizontal Rule
      if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
        outputBlocks.push('<hr class="m3-divider" />');
        i++;
        continue;
      }

      // Headings (H1 - H6) with slug ID for Table of Contents and Scrollspy
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        headingCounter++;
        const slug = headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sectie';
        const headingId = `heading-${slug}-${headingCounter}`;
        outputBlocks.push(
          `<h${level} id="${headingId}" class="m3-heading-${level}">${formatInline(headingText)}</h${level}>`
        );
        i++;
        continue;
      }

      // Blockquotes & Callouts (Grouping continuous lines starting with >)
      if (line.startsWith('>')) {
        const quoteLines = [];
        while (i < inputLines.length && (inputLines[i].startsWith('>') || (inputLines[i].trim() === '' && i + 1 < inputLines.length && inputLines[i + 1].startsWith('>')))) {
          if (inputLines[i].startsWith('>')) {
            quoteLines.push(inputLines[i]);
          } else {
            quoteLines.push('>');
          }
          i++;
        }
        outputBlocks.push(renderCalloutOrQuote(quoteLines));
        continue;
      }

      // GFM Tables: Check if current line contains | and next line is separator
      if (line.includes('|') && i + 1 < inputLines.length) {
        const nextLine = inputLines[i + 1].trim();
        const sepParts = nextLine.replace(/^\||\|$/g, '').split('|').map(function (s) { return s.trim(); });
        if (sepParts.length > 0 && sepParts.every(function (p) { return /^:?-+:?$/.test(p); })) {
          const tableLines = [line, inputLines[i + 1]];
          i += 2;
          while (i < inputLines.length && inputLines[i].trim().includes('|')) {
            tableLines.push(inputLines[i]);
            i++;
          }
          outputBlocks.push(renderTable(tableLines));
          continue;
        }
      }

      // Lists: Unordered / Ordered / Task Lists with nesting support
      const ulMatch = line.match(/^(\s*)(?:[\*\-]|\+)\s+(.*)$/);
      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ulMatch || olMatch) {
        const listLines = [];
        while (i < inputLines.length) {
          const l = inputLines[i];
          if (/^\s*(?:[\*\-]|\+|\d+\.)\s+/.test(l) || (l.trim().length > 0 && listLines.length > 0 && /^\s{2,}/.test(l))) {
            listLines.push(l);
            i++;
          } else {
            break;
          }
        }

        const listStack = [];
        let listHtml = '';
        for (let li = 0; li < listLines.length; li++) {
          const itemLine = listLines[li];
          const itemUl = itemLine.match(/^(\s*)(?:[\*\-]|\+)\s+(.*)$/);
          const itemOl = itemLine.match(/^(\s*)\d+\.\s+(.*)$/);

          if (itemUl || itemOl) {
            const indent = (itemUl || itemOl)[1].length;
            const type = itemUl ? 'ul' : 'ol';
            const cssClass = type === 'ul' ? 'm3-list' : 'm3-ordered-list';
            let itemContent = (itemUl || itemOl)[2];

            let isTask = false;
            let isChecked = false;
            const taskMatch = itemContent.match(/^\[([ xX])\]\s+(.*)$/);
            if (taskMatch) {
              isTask = true;
              isChecked = taskMatch[1].toLowerCase() === 'x';
              itemContent = taskMatch[2];
            }

            const itemHtml = isTask
              ? `<li class="m3-task-item"><input type="checkbox" class="m3-checkbox" ${isChecked ? 'checked ' : ''}disabled data-doc-review-ignore="true" />${formatInline(itemContent)}`
              : `<li>${formatInline(itemContent)}`;

            if (listStack.length === 0) {
              listHtml += `<${type} class="${cssClass}">` + itemHtml;
              listStack.push({ type: type, indent: indent });
            } else {
              const current = listStack[listStack.length - 1];
              if (indent > current.indent) {
                listHtml += `<${type} class="${cssClass}">` + itemHtml;
                listStack.push({ type: type, indent: indent });
              } else if (indent === current.indent) {
                listHtml += `</li>`;
                if (current.type !== type) {
                  listHtml += `</${current.type}><${type} class="${cssClass}">`;
                  current.type = type;
                }
                listHtml += itemHtml;
              } else {
                while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
                  const top = listStack.pop();
                  listHtml += `</li></${top.type}>`;
                }
                if (listStack.length > 0 && listStack[listStack.length - 1].indent === indent) {
                  listHtml += `</li>`;
                  const top = listStack[listStack.length - 1];
                  if (top.type !== type) {
                    listHtml += `</${top.type}><${type} class="${cssClass}">`;
                    top.type = type;
                  }
                  listHtml += itemHtml;
                } else {
                  listHtml += `<${type} class="${cssClass}">` + itemHtml;
                  listStack.push({ type: type, indent: indent });
                }
              }
            }
          } else {
            listHtml += ' ' + formatInline(itemLine.trim());
          }
        }
        while (listStack.length > 0) {
          const top = listStack.pop();
          listHtml += `</li></${top.type}>`;
        }
        outputBlocks.push(listHtml);
        continue;
      }

      // Paragraph: Group consecutive non-empty lines
      if (trimmed.length > 0) {
        const paraLines = [];
        while (
          i < inputLines.length &&
          inputLines[i].trim().length > 0 &&
          !inputLines[i].startsWith('#') &&
          !inputLines[i].startsWith('>') &&
          !/^(?:---|\*\*\*|___)\s*$/.test(inputLines[i].trim()) &&
          !inputLines[i].trim().startsWith('@@M3CODEBLOCK') &&
          !/^\s*(?:[\*\-]|\+|\d+\.)\s+/.test(inputLines[i]) &&
          !(inputLines[i].includes('|') && i + 1 < inputLines.length && inputLines[i + 1].trim().includes('|'))
        ) {
          paraLines.push(formatInline(inputLines[i].trim()));
          i++;
        }
        outputBlocks.push(`<p class="m3-paragraph">${paraLines.join('<br/>')}</p>`);
        continue;
      }

      i++;
    }

    let resultHtml = outputBlocks.join('\n');

    // 4. Re-insert preserved inline codes
    resultHtml = resultHtml.replace(/@@M3INLINECODE(\d+)@@/g, function (match, index) {
      return inlineCodes[Number(index)] || '';
    });

    // 5. Re-insert preserved fenced code blocks
    resultHtml = resultHtml.replace(/@@M3CODEBLOCK(\d+)@@/g, function (match, index) {
      return codeBlocks[Number(index)] || '';
    });

    return resultHtml;
  }

  /**
   * Master renderer deciding between Markdown and Plain Text according to file extension or format.
   * @param {string} content - Raw file content
   * @param {string} filenameOrFormat - e.g. "document.md", "notes.txt", or format "markdown" / "text"
   * @returns {string} Rendered HTML string
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
    renderDocument: renderDocument
  };
});
