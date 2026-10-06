/**
 * Text Selection, Character Offset Calculation & Orange Indicator Badges Engine
 * Target Application: Document Review Web Application
 * Strict Contract: --md-sys-color-badge-orange: #FF6D00
 * Accurately tracks character offsets relative to document container.textContent.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SelectionManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let activeContainer = null;
  let floatingPill = null;
  let activeSelectionData = null;
  let onAddCommentCallback = null;

  /**
   * Resolves the AST path and node type for a given DOM node inside the markdown container.
   * Walks upward to trace the list/block hierarchy, and backward to find preceding headings (H1-H4).
   * @param {Node} startNode - Starting DOM text/element node of selection
   * @param {HTMLElement} container - Document container element
   * @returns {{ ast_path: string, node_type: string }}
   */
  function resolveAstContext(startNode, container) {
    if (!startNode || !container) {
      return { ast_path: 'Document', node_type: 'Text' };
    }

    let curr = startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement;
    if (!curr || !container.contains(curr)) {
      return { ast_path: 'Document', node_type: 'Text' };
    }

    let nodeType = 'Paragraph';
    const listLabels = [];

    // Check enclosing block elements up to container
    let nodeWalker = curr;
    while (nodeWalker && nodeWalker !== container) {
      const tag = (nodeWalker.tagName || '').toUpperCase();
      if (tag === 'LI') {
        nodeType = 'ListItem';
        let label = '';
        const strong = nodeWalker.querySelector('strong, b, em, i');
        if (strong && (nodeWalker.firstChild === strong || (nodeWalker.firstChild && nodeWalker.firstChild.contains && nodeWalker.firstChild.contains(strong)))) {
          label = strong.textContent.replace(/[:*_\s]+$/, '').trim();
        }
        if (!label) {
          const directText = (nodeWalker.textContent || '').trim();
          label = directText.slice(0, 35).replace(/[:*_\s]+$/, '').trim();
        }
        if (label) {
          listLabels.unshift(label);
        }
      } else if (tag === 'TD' || tag === 'TH') {
        nodeType = 'TableCell';
        const colIndex = Array.prototype.indexOf.call(nodeWalker.parentElement.children, nodeWalker);
        const table = nodeWalker.closest('table');
        const rows = table ? Array.prototype.slice.call(table.querySelectorAll('tr')) : [];
        const rowIndex = rows.indexOf(nodeWalker.parentElement);
        listLabels.unshift(`Tabel [Rij ${rowIndex + 1}, Kolom ${colIndex + 1}]`);
      } else if (nodeWalker.classList && nodeWalker.classList.contains('m3-callout')) {
        nodeType = 'Callout';
        listLabels.unshift('Callout');
      } else if (tag === 'BLOCKQUOTE') {
        if (nodeType !== 'ListItem' && nodeType !== 'TableCell') nodeType = 'Blockquote';
      } else if (tag === 'PRE' || tag === 'CODE') {
        if (nodeType !== 'ListItem' && nodeType !== 'TableCell') nodeType = 'CodeBlock';
      } else if (/^H[1-6]$/.test(tag)) {
        nodeType = 'Heading' + tag[1];
      }
      nodeWalker = nodeWalker.parentElement;
    }

    // Find enclosing heading path by looking backwards in the document order
    const allHeadings = Array.from(container.querySelectorAll('h1, h2, h3, h4'));
    let activeHeading = null;
    for (let i = allHeadings.length - 1; i >= 0; i--) {
      const h = allHeadings[i];
      if (h.compareDocumentPosition(curr) & Node.DOCUMENT_POSITION_FOLLOWING) {
        activeHeading = h;
        break;
      }
    }

    const headingChain = [];
    if (activeHeading) {
      headingChain.push(activeHeading.textContent.trim());
      const currentLevel = parseInt(activeHeading.tagName[1], 10);
      for (let i = allHeadings.indexOf(activeHeading) - 1; i >= 0; i--) {
        const prevH = allHeadings[i];
        const prevLevel = parseInt(prevH.tagName[1], 10);
        if (prevLevel < currentLevel) {
          headingChain.unshift(prevH.textContent.trim());
          break;
        }
      }
    }

    const parts = [...headingChain, ...listLabels];
    const astPath = parts.length > 0 ? parts.join(' > ') : (nodeType || 'Document');

    return {
      ast_path: astPath,
      node_type: nodeType
    };
  }

  /**
   * Compute character offsets relative to container text nodes for a given DOM Range.
   * Traverses exact text nodes (skipping badge elements), ensuring 100% 1-to-1 parity with renderAnnotations.
   * @param {HTMLElement} container - The root document content container
   * @param {Range} range - The current browser Selection Range
   * @returns {{start_offset: number, end_offset: number, selected_text: string, ast_path: string, node_type: string}|null}
   */
  function getOffsetsFromRange(container, range) {
    if (!container || !range) return null;
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return null;
    }

    function getPointOffset(boundaryNode, boundaryOffset) {
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let offset = 0;
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        // Skip existing badge indicators and UI decorations with data-doc-review-ignore
        if (textNode.parentElement && textNode.parentElement.closest('.m3-orange-badge, [data-doc-review-ignore="true"]')) {
          continue;
        }

        // Exact text node match
        if (boundaryNode === textNode) {
          return offset + Math.min(boundaryOffset, textNode.nodeValue.length);
        }

        // If boundary is an element node
        if (boundaryNode.nodeType === Node.ELEMENT_NODE) {
          if (boundaryNode.contains(textNode)) {
            let child = textNode;
            while (child && child.parentNode !== boundaryNode) {
              child = child.parentNode;
            }
            if (child) {
              const childIndex = Array.prototype.indexOf.call(boundaryNode.childNodes, child);
              if (childIndex >= boundaryOffset) {
                return offset;
              }
            }
          } else if (boundaryNode.compareDocumentPosition(textNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
            return offset;
          }
        }

        offset += textNode.nodeValue.length;
      }
      return offset;
    }

    const startOffset = getPointOffset(range.startContainer, range.startOffset);
    const endOffset = getPointOffset(range.endContainer, range.endOffset);
    const selectedText = range.toString();

    if (startOffset >= endOffset) return null;

    const astContext = resolveAstContext(range.startContainer, container);

    return {
      start_offset: startOffset,
      end_offset: endOffset,
      selected_text: selectedText,
      ast_path: astContext.ast_path,
      node_type: astContext.node_type
    };
  }

  /**
   * Initializes selection listeners on document viewer.
   * @param {HTMLElement} container - Document viewer element (#document-content)
   * @param {HTMLElement} pillElement - Floating comment pill button (#btn-floating-comment)
   * @param {Function} onAddComment - Callback invoked when "Add Comment" pill is pressed
   */
  function init(container, pillElement, onAddComment) {
    activeContainer = container;
    floatingPill = pillElement;
    onAddCommentCallback = onAddComment;

    if (!activeContainer || !floatingPill) return;

    // Track mouse drag state so floating button never appears while actively selecting text
    let isMouseDown = false;

    // Handle selection changes
    function handleSelectionChange() {
      if (isMouseDown) {
        hidePill();
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        hidePill();
        activeSelectionData = null;
        return;
      }

      const range = sel.getRangeAt(0);
      const offsets = getOffsetsFromRange(activeContainer, range);
      if (!offsets || !offsets.selected_text || offsets.selected_text.trim().length === 0) {
        hidePill();
        activeSelectionData = null;
        return;
      }

      activeSelectionData = offsets;
      positionPill(range);
    }

    let debounceTimer = null;
    document.addEventListener('selectionchange', function () {
      if (isMouseDown) {
        // While user is actively dragging the mouse across words, do NOT obstruct their cursor
        hidePill();
        return;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(handleSelectionChange, 120);
    });

    document.addEventListener('mousedown', function (e) {
      isMouseDown = true;
      if (
        floatingPill &&
        !floatingPill.contains(e.target) &&
        activeContainer &&
        !activeContainer.contains(e.target)
      ) {
        hidePill();
      }
    });

    document.addEventListener('mouseup', function () {
      isMouseDown = false;
      setTimeout(handleSelectionChange, 10);
    });

    activeContainer.addEventListener('mouseup', function () {
      isMouseDown = false;
      setTimeout(handleSelectionChange, 10);
    });

    activeContainer.addEventListener('touchend', function () {
      isMouseDown = false;
      setTimeout(handleSelectionChange, 150);
    });

    // Dismiss pill on click outside
    document.addEventListener('click', function (e) {
      if (
        floatingPill &&
        !floatingPill.contains(e.target) &&
        activeContainer &&
        !activeContainer.contains(e.target)
      ) {
        hidePill();
      }
    });

    // Pill click handler
    floatingPill.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (activeSelectionData && typeof onAddCommentCallback === 'function') {
        const payload = Object.assign({}, activeSelectionData);
        let targetRect = null;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          targetRect = sel.getRangeAt(0).getBoundingClientRect();
        }
        hidePill();
        onAddCommentCallback(payload, targetRect);
      }
    });
  }

  /**
   * Position the floating comment action pill above the current selection.
   * Ensures the button is placed comfortably ABOVE the text with clear breathing room,
   * completely out of the way of the words.
   * @param {Range} range
   */
  function positionPill(range) {
    if (!floatingPill) return;
    const rects = range.getClientRects();
    const lastRect = (rects && rects.length > 0) ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (!lastRect || (lastRect.width === 0 && lastRect.height === 0)) {
      hidePill();
      return;
    }

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    // Position cleanly without ever obstructing the selected text
    const pillEstimatedWidth = 110;
    const roomToRight = viewportWidth - lastRect.right;

    let top;
    let left;

    if (roomToRight >= (pillEstimatedWidth + 24)) {
      // Place comfortably to the right of the selection end in the margin
      left = lastRect.right + scrollX + 12;
      top = lastRect.top + scrollY + (lastRect.height / 2);
      floatingPill.style.transform = 'translate(0, -50%)';
    } else {
      // If near edge of viewport, place comfortably ABOVE the selection with 12px breathing room
      left = Math.min(lastRect.right + scrollX, viewportWidth - 80);
      if (left < 75) left = 75;

      if (lastRect.top >= 52) {
        top = lastRect.top + scrollY - 12;
        floatingPill.style.transform = 'translate(-50%, -100%)';
      } else {
        top = lastRect.bottom + scrollY + 12;
        floatingPill.style.transform = 'translate(-50%, 0)';
      }
    }

    floatingPill.style.top = top + 'px';
    floatingPill.style.left = left + 'px';
    floatingPill.classList.add('visible');
  }

  /**
   * Hide the floating action pill.
   */
  function hidePill() {
    if (floatingPill) {
      floatingPill.classList.remove('visible');
    }
  }

  /**
   * Creates an orange badge DOM element conforming to M3 strict contract (#FF6D00).
   * @param {Object} annotation
   * @returns {HTMLElement}
   */
  function createBadgeElement(annotation) {
    const badge = document.createElement('span');
    badge.className = 'm3-orange-badge';
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('data-annotation-id', String(annotation.id));

    const activeComments = (annotation.comments || []).filter(function (c) {
      return !c.is_deleted;
    });
    const rawComments = annotation.comments || [];
    const count = rawComments.length > 0 ? activeComments.length : 1;
    badge.setAttribute('aria-label', `Annotation thread with ${count} comment(s)`);
    badge.setAttribute('title', `View discussion (${count})`);

    const countSpan = document.createElement('span');
    countSpan.className = 'm3-orange-badge__count';
    countSpan.textContent = String(count);

    badge.appendChild(countSpan);
    return badge;
  }

  /**
   * Cleans up all existing annotation highlights and badges from container, restoring raw text nodes.
   * @param {HTMLElement} container
   */
  function clearAnnotations(container) {
    if (!container) return;

    // 1. Remove all existing badge elements
    const badges = container.querySelectorAll('.m3-orange-badge');
    for (let i = 0; i < badges.length; i++) {
      const b = badges[i];
      if (b.parentNode) {
        b.parentNode.removeChild(b);
      }
    }

    // 2. Unwrap all highlight mark elements, restoring original text nodes
    const marks = container.querySelectorAll('.m3-annotation-highlight');
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      const parent = m.parentNode;
      if (parent) {
        while (m.firstChild) {
          parent.insertBefore(m.firstChild, m);
        }
        parent.removeChild(m);
      }
    }

    // 3. Normalize adjacent text nodes
    container.normalize();
  }

  /**
   * Renders annotations as text highlights and anchors circular orange badges (#FF6D00).
   * Automatically clears any prior annotations in container first to guarantee zero duplicate badges.
   * Sorts annotations in descending offset order to guarantee DOM mutation immutability.
   * @param {HTMLElement} container - Document viewer element
   * @param {Array<Object>} annotations - List of annotation objects from API
   * @param {Function} onBadgeClick - Handler when badge or highlight is clicked
   * @param {Function} onBadgeHover - Optional hover handler for desktop preview
   */
  function renderAnnotations(container, annotations, onBadgeClick, onBadgeHover) {
    if (!container) return;

    // Clean up any existing annotations and badges first to prevent duplicate badges or nested marks
    clearAnnotations(container);

    if (!Array.isArray(annotations) || annotations.length === 0) return;

    // Sort descending by start_offset so earlier character offsets remain unaffected by DOM changes
    const sorted = annotations
      .filter(function (ann) {
        if (ann.is_deleted) return false;
        if (ann.comments && ann.comments.length > 0) {
          const hasActive = ann.comments.some(function (c) { return !c.is_deleted; });
          if (!hasActive) return false;
        }
        return true;
      })
      .sort(function (a, b) {
        return Number(b.start_offset) - Number(a.start_offset);
      });

    sorted.forEach(function (ann) {
      let start = Number(ann.start_offset);
      let end = Number(ann.end_offset);
      if (isNaN(start) || isNaN(end) || start >= end || start < 0) return;

      // Collect all text nodes and their cumulative offset ranges
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const textNodesInfo = [];
      let currentOffset = 0;
      let fullText = '';

      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        // Skip inside already created badges or UI decorations
        if (textNode.parentElement && textNode.parentElement.closest('.m3-orange-badge, [data-doc-review-ignore="true"]')) {
          continue;
        }
        const val = textNode.nodeValue;
        const len = val.length;
        fullText += val;
        textNodesInfo.push({
          node: textNode,
          start: currentOffset,
          end: currentOffset + len,
          length: len
        });
        currentOffset += len;
      }

      // Reconcile start and end using selected_text if available and not matching
      if (ann.selected_text && typeof ann.selected_text === 'string') {
        const expected = ann.selected_text;
        const currentSlice = fullText.slice(start, end);
        if (currentSlice !== expected && expected.trim().length > 0) {
          const directIdx = fullText.indexOf(expected);
          if (directIdx !== -1) {
            start = directIdx;
            end = directIdx + expected.length;
          } else {
            const trimmed = expected.trim();
            const prefix = trimmed.slice(0, Math.min(30, trimmed.length)).trim();
            const suffix = trimmed.slice(-Math.min(30, trimmed.length)).trim();

            if (prefix.length >= 8) {
              let candidateStart = -1;
              const searchWindowStart = Math.max(0, start - 200);
              const searchWindowEnd = Math.min(fullText.length, start + 200 + prefix.length);
              const windowText = fullText.slice(searchWindowStart, searchWindowEnd);
              const localIdx = windowText.indexOf(prefix);

              if (localIdx !== -1) {
                candidateStart = searchWindowStart + localIdx;
              } else {
                candidateStart = fullText.indexOf(prefix);
              }

              if (candidateStart !== -1) {
                let candidateEnd = -1;
                if (suffix.length >= 8) {
                  const windowSuffixText = fullText.slice(candidateStart, Math.min(fullText.length, candidateStart + trimmed.length + 150));
                  const localSuffixIdx = windowSuffixText.lastIndexOf(suffix);
                  if (localSuffixIdx !== -1) {
                    candidateEnd = candidateStart + localSuffixIdx + suffix.length;
                  }
                }
                if (candidateEnd === -1 || candidateEnd <= candidateStart) {
                  candidateEnd = candidateStart + trimmed.length;
                }
                start = candidateStart;
                end = candidateEnd;
              }
            }
          }
        }
      }

      if (start >= currentOffset) return;

      // Find overlapping text nodes
      const targetNodes = [];
      for (let i = 0; i < textNodesInfo.length; i++) {
        const info = textNodesInfo[i];
        if (info.end > start && info.start < end) {
          targetNodes.push(info);
        }
      }

      if (targetNodes.length === 0) return;

      let lastMark = null;

      // Process target nodes in reverse order so splitting doesn't alter previous node indices
      for (let i = targetNodes.length - 1; i >= 0; i--) {
        const target = targetNodes[i];
        const node = target.node;
        const nodeStart = target.start;
        const nodeEnd = target.end;

        const sliceStart = Math.max(0, start - nodeStart);
        const sliceEnd = Math.min(target.length, end - nodeStart);

        let midNode = node;
        if (sliceEnd < node.nodeValue.length) {
          midNode.splitText(sliceEnd);
        }
        if (sliceStart > 0) {
          midNode = midNode.splitText(sliceStart);
        }

        const mark = document.createElement('mark');
        mark.className = 'm3-annotation-highlight';
        mark.setAttribute('data-annotation-id', String(ann.id));
        if (ann.badge_color) {
          mark.style.setProperty('--md-sys-color-annotation', ann.badge_color);
        }

        midNode.parentNode.insertBefore(mark, midNode);
        mark.appendChild(midNode);

        if (!lastMark) {
          lastMark = mark;
        }
      }

      // Anchor the orange indicator badge after the last highlighted text mark
      if (lastMark && lastMark.parentNode) {
        const badge = createBadgeElement(ann);
        lastMark.parentNode.insertBefore(badge, lastMark.nextSibling);

        // Bind click event to badge and mark
        const clickHandler = function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof onBadgeClick === 'function') {
            onBadgeClick(ann, badge, e);
          }
        };

        badge.addEventListener('click', clickHandler);
        lastMark.addEventListener('click', clickHandler);

        // Enter key accessibility
        badge.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            clickHandler(e);
          }
        });

        // Optional desktop hover preview
        if (typeof onBadgeHover === 'function') {
          badge.addEventListener('mouseenter', function (e) {
            onBadgeHover(ann, badge, e);
          });
          badge.addEventListener('mouseleave', function (e) {
            onBadgeHover(null, badge, e);
          });
        }
      }
    });
  }

  return {
    init: init,
    getOffsetsFromRange: getOffsetsFromRange,
    renderAnnotations: renderAnnotations,
    clearAnnotations: clearAnnotations,
    hidePill: hidePill
  };
});
