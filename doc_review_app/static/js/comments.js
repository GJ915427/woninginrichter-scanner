/**
 * Threaded Comments UX & Interaction Architecture
 * Target Application: Document Review Web Application
 * Handles author initials derivation, nested thread hierarchy, inline self-editing,
 * and 403 permission error notifications.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CommentsManager = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Computes 1-2 character author initials from user full name or username.
   * Examples: "Alice Smith" -> "AS", "gaspar" -> "GA", "Bob" -> "BO"
   * @param {string} name
   * @returns {string} 1-2 uppercase initials
   */
  function computeInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    const clean = name.trim();
    if (!clean) return '?';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (clean.length === 1) {
      return clean.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  /**
   * Deterministically returns an M3 container background and text color based on string hash.
   * @param {string} name
   * @returns {{bg: string, text: string}}
   */
  function getAvatarColor(name) {
    const palettes = [
      { bg: '#cbe6ff', text: '#001e30' }, // Primary Container
      { bg: '#d3e4f5', text: '#0c1d29' }, // Secondary Container
      { bg: '#ecdcff', text: '#211634' }, // Tertiary Container
      { bg: '#ffd8e4', text: '#31111d' }, // Rose Container
      { bg: '#ffe0b2', text: '#bf360c' }, // Orange Accent Container
      { bg: '#cce8e4', text: '#05201e' }  // Teal Container
    ];
    let hash = 0;
    const str = String(name || '');
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
    }
    const index = Math.abs(hash) % palettes.length;
    return palettes[index];
  }

  /**
   * Humanize ISO timestamp (e.g. "Just now", "5m ago", "2h ago", or formatted date).
   * @param {string} dateStr
   * @returns {string}
   */
  function formatTimestamp(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 10) return 'Just now';
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return String(dateStr);
    }
  }

  /**
   * Build a nested hierarchical tree from a flat comment list.
   * @param {Array<Object>} comments
   * @returns {Array<Object>} Root comments with child .replies arrays
   */
  function buildCommentTree(comments) {
    if (!Array.isArray(comments)) return [];
    const idMap = {};
    const rootComments = [];

    // Clone objects and initialize replies array
    comments.forEach(function (c) {
      idMap[c.id] = Object.assign({}, c, { replies: [] });
    });

    comments.forEach(function (c) {
      const mapped = idMap[c.id];
      if (c.parent_comment_id && idMap[c.parent_comment_id]) {
        idMap[c.parent_comment_id].replies.push(mapped);
      } else {
        rootComments.push(mapped);
      }
    });

    function hasActiveContent(node) {
      if (!node.is_deleted) return true;
      if (Array.isArray(node.replies)) {
        return node.replies.some(hasActiveContent);
      }
      return false;
    }

    function pruneTree(nodes) {
      return nodes.filter(function (node) {
        if (Array.isArray(node.replies)) {
          node.replies = pruneTree(node.replies);
        }
        return hasActiveContent(node);
      });
    }

    return pruneTree(rootComments);
  }

  /**
   * Render a complete threaded comment stream inside a container.
   * @param {Object} options
   * @param {HTMLElement} options.container - Comments stream container (#comments-body)
   * @param {Object} options.annotation - Active annotation object with .comments
   * @param {Object} options.currentUser - Active logged-in user object ({ id, username, initials })
   * @param {Function} options.onEditComment - Async callback: fn(commentId, newContent) -> Promise
   * @param {Function} options.onAddReply - Async callback: fn(annotationId, content, parentId) -> Promise
   * @param {Function} options.showToast - Function to show notification snackbar: fn(msg, type)
   */
  function renderThread(options) {
    const container = options.container;
    const annotation = options.annotation;
    const currentUser = options.currentUser || {};
    const onEditComment = options.onEditComment;
    const onAddReply = options.onAddReply;
    const showToast = options.showToast || function (m) { alert(m); };

    if (!container || !annotation) return;
    container.innerHTML = '';

    const comments = annotation.comments || [];
    if (comments.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.className = 'm3-typography-body-medium';
      emptyNote.style.color = 'var(--md-sys-color-outline)';
      emptyNote.style.padding = '1rem 0';
      emptyNote.textContent = 'No comments attached to this highlight yet. Be the first to comment!';
      container.appendChild(emptyNote);
      return;
    }

    const tree = buildCommentTree(comments);

    function renderNode(node, parentElement) {
      const card = document.createElement('div');
      card.className = 'comment-card';
      card.setAttribute('data-comment-id', String(node.id));

      // Header: Avatar, Name, Timestamp, Edited Indicator
      const header = document.createElement('div');
      header.className = 'comment-card__header';

      const authorInfo = document.createElement('div');
      authorInfo.className = 'comment-card__author-info';

      const avatar = document.createElement('div');
      avatar.className = 'm3-avatar-badge';
      const initials = node.author_initials || computeInitials(node.author_name || node.author_username || 'User');
      avatar.textContent = initials;
      const palette = getAvatarColor(node.author_name || initials);
      avatar.style.backgroundColor = palette.bg;
      avatar.style.color = palette.text;

      const metaBlock = document.createElement('div');
      metaBlock.className = 'comment-card__meta';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'comment-card__name';
      nameSpan.textContent = node.author_name || node.author_username || 'Reviewer';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'comment-card__timestamp';
      timeSpan.textContent = ' • ' + formatTimestamp(node.created_at);

      if (node.is_edited && !node.is_deleted) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'comment-card__edited-badge';
        editedSpan.textContent = ' (bewerkt)';
        editedSpan.style.cursor = 'pointer';
        editedSpan.setAttribute('title', 'Klik om audit history te bekijken');
        if (typeof options.onViewHistory === 'function') {
          editedSpan.addEventListener('click', function (e) {
            e.stopPropagation();
            options.onViewHistory(node.id);
          });
        }
        timeSpan.appendChild(editedSpan);
      }

      metaBlock.appendChild(nameSpan);
      metaBlock.appendChild(timeSpan);

      authorInfo.appendChild(avatar);
      authorInfo.appendChild(metaBlock);
      header.appendChild(authorInfo);

      // Trailing action icons on the SAME header line: Reply, Add Comment, Edit, Delete
      const headerActions = document.createElement('div');
      headerActions.className = 'comment-card__header-actions';

      let replyButton = null;
      let addCommentButton = null;
      if (!node.is_deleted) {
        replyButton = document.createElement('button');
        replyButton.className = 'm3-icon-button';
        replyButton.setAttribute('type', 'button');
        replyButton.setAttribute('aria-label', 'Reageren op deze opmerking');
        replyButton.setAttribute('title', 'Reageren op deze opmerking');
        replyButton.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">reply</span>';
        headerActions.appendChild(replyButton);

        addCommentButton = document.createElement('button');
        addCommentButton.className = 'm3-icon-button';
        addCommentButton.setAttribute('type', 'button');
        addCommentButton.setAttribute('aria-label', 'Nieuwe opmerking toevoegen');
        addCommentButton.setAttribute('title', 'Nieuwe opmerking toevoegen');
        addCommentButton.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">add_comment</span>';
        headerActions.appendChild(addCommentButton);
      }

      const isOwner = currentUser && !node.is_deleted && (
        String(currentUser.id) === String(node.user_id) ||
        String(currentUser.id) === String(node.author_id) ||
        currentUser.username === node.author_username
      );
      const isAdmin = currentUser && Boolean(currentUser.is_admin);

      let editButton = null;
      let deleteButton = null;
      if (isOwner) {
        editButton = document.createElement('button');
        editButton.className = 'm3-icon-button';
        editButton.setAttribute('type', 'button');
        editButton.setAttribute('aria-label', 'Opmerking bewerken');
        editButton.setAttribute('title', 'Opmerking bewerken');
        editButton.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">edit</span>';
        headerActions.appendChild(editButton);
      }

      if ((isOwner || isAdmin) && !node.is_deleted) {
        deleteButton = document.createElement('button');
        deleteButton.className = 'm3-icon-button';
        deleteButton.setAttribute('type', 'button');
        deleteButton.setAttribute('aria-label', 'Opmerking verwijderen');
        deleteButton.setAttribute('title', 'Opmerking verwijderen');
        deleteButton.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: var(--md-sys-color-error);">delete</span>';
        headerActions.appendChild(deleteButton);
      }

      header.appendChild(headerActions);
      card.appendChild(header);

      // AST Breadcrumb Tag (indicates the semantic location of this annotation)
      if (annotation && annotation.ast_path && !node.parent_comment_id) {
        const astTag = document.createElement('div');
        astTag.className = 'comment-card__ast-path';
        astTag.setAttribute('title', `AST Node: ${annotation.node_type || 'Element'}`);
        astTag.innerHTML = `<span class="material-symbols-outlined" style="font-size: 13px;">account_tree</span><span>${annotation.ast_path}</span>`;
        card.appendChild(astTag);
      }

      // Comment Content Body
      const contentEl = document.createElement('div');
      contentEl.className = 'comment-card__content';
      if (node.is_deleted) {
        contentEl.textContent = '[Opmerking verwijderd]';
        contentEl.style.fontStyle = 'italic';
        contentEl.style.color = 'var(--md-sys-color-outline)';
      } else {
        contentEl.textContent = node.content || '';
      }
      card.appendChild(contentEl);

      // Inline Edit Mode Container (initially hidden)
      const editContainer = document.createElement('div');
      editContainer.style.display = 'none';
      editContainer.style.flexDirection = 'column';
      editContainer.style.gap = '0.375rem';
      editContainer.style.marginTop = '0.375rem';

      const editTextarea = document.createElement('textarea');
      editTextarea.className = 'm3-textarea';
      editTextarea.rows = 2;

      const editActions = document.createElement('div');
      editActions.style.display = 'flex';
      editActions.style.justifyContent = 'flex-end';
      editActions.style.gap = '0.375rem';

      const cancelEditBtn = document.createElement('button');
      cancelEditBtn.className = 'm3-button m3-button--text';
      cancelEditBtn.style.height = '28px';
      cancelEditBtn.style.fontSize = '12px';
      cancelEditBtn.textContent = 'Annuleren';

      const saveEditBtn = document.createElement('button');
      saveEditBtn.className = 'm3-button m3-button--filled';
      saveEditBtn.style.height = '28px';
      saveEditBtn.style.fontSize = '12px';
      saveEditBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">check</span><span>Opslaan</span>';

      editActions.appendChild(cancelEditBtn);
      editActions.appendChild(saveEditBtn);
      editContainer.appendChild(editTextarea);
      editContainer.appendChild(editActions);
      card.appendChild(editContainer);

      // Inline Reply Composer (initially hidden)
      const replyComposer = document.createElement('div');
      replyComposer.style.display = 'none';
      replyComposer.style.flexDirection = 'column';
      replyComposer.style.gap = '0.375rem';
      replyComposer.style.marginTop = '0.375rem';

      const replyTextarea = document.createElement('textarea');
      replyTextarea.className = 'm3-textarea';
      replyTextarea.placeholder = `Antwoord aan ${node.author_name || 'opmerking'}...`;
      replyTextarea.rows = 2;

      const replyComposerActions = document.createElement('div');
      replyComposerActions.style.display = 'flex';
      replyComposerActions.style.justifyContent = 'flex-end';
      replyComposerActions.style.gap = '0.375rem';

      const cancelReplyBtn = document.createElement('button');
      cancelReplyBtn.className = 'm3-button m3-button--text';
      cancelReplyBtn.style.height = '28px';
      cancelReplyBtn.style.fontSize = '12px';
      cancelReplyBtn.textContent = 'Annuleren';

      const sendReplyBtn = document.createElement('button');
      sendReplyBtn.className = 'm3-button m3-button--filled';
      sendReplyBtn.style.height = '28px';
      sendReplyBtn.style.fontSize = '12px';
      sendReplyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">send</span><span>Verstuur</span>';

      replyComposerActions.appendChild(cancelReplyBtn);
      replyComposerActions.appendChild(sendReplyBtn);
      replyComposer.appendChild(replyTextarea);
      replyComposer.appendChild(replyComposerActions);
      card.appendChild(replyComposer);

      // Event Listeners for Edit
      if (editButton) {
        editButton.addEventListener('click', function () {
          if (editContainer.style.display === 'flex') {
            editContainer.style.display = 'none';
            contentEl.style.display = 'block';
          } else {
            editTextarea.value = node.content || '';
            contentEl.style.display = 'none';
            if (replyComposer) replyComposer.style.display = 'none';
            editContainer.style.display = 'flex';
            editTextarea.focus();
          }
        });

        cancelEditBtn.addEventListener('click', function () {
          editContainer.style.display = 'none';
          contentEl.style.display = 'block';
        });

        saveEditBtn.addEventListener('click', async function () {
          const updatedContent = editTextarea.value.trim();
          if (!updatedContent) {
            showToast('Comment content cannot be empty.', 'error');
            return;
          }
          saveEditBtn.disabled = true;

          try {
            await onEditComment(node.id, updatedContent);
            node.content = updatedContent;
            node.is_edited = true;
            contentEl.textContent = updatedContent;
            if (!timeSpan.querySelector('.comment-card__edited-badge')) {
              const editedBadge = document.createElement('span');
              editedBadge.className = 'comment-card__edited-badge';
              editedBadge.textContent = ' (bewerkt)';
              timeSpan.appendChild(editedBadge);
            }
            editContainer.style.display = 'none';
            contentEl.style.display = 'block';
            showToast('Comment updated successfully.', 'success');
          } catch (err) {
            if (err && err.status === 403) {
              showToast("Forbidden: You cannot edit another user's comment", 'error');
            } else {
              showToast(err.message || 'Failed to update comment.', 'error');
            }
          } finally {
            saveEditBtn.disabled = false;
          }
        });
      }

      // Event Listeners for Delete
      if (deleteButton) {
        deleteButton.addEventListener('click', async function () {
          if (!confirm('Weet je zeker dat je deze opmerking wilt verwijderen?')) return;
          deleteButton.disabled = true;
          try {
            if (typeof options.onDeleteComment === 'function') {
              await options.onDeleteComment(node.id);
            }
          } catch (err) {
            showToast(err.message || 'Fout bij verwijderen.', 'error');
            deleteButton.disabled = false;
          }
        });
      }

      // Event Listeners for Reply
      if (replyButton) {
        replyButton.addEventListener('click', function () {
          if (replyComposer.style.display === 'flex') {
            replyComposer.style.display = 'none';
          } else {
            if (editContainer) {
              editContainer.style.display = 'none';
              contentEl.style.display = 'block';
            }
            replyComposer.style.display = 'flex';
            replyTextarea.focus();
          }
        });

        cancelReplyBtn.addEventListener('click', function () {
          replyComposer.style.display = 'none';
          replyTextarea.value = '';
        });

        sendReplyBtn.addEventListener('click', async function () {
          const replyText = replyTextarea.value.trim();
          if (!replyText) {
            showToast('Vul een reactie in.', 'error');
            return;
          }
          sendReplyBtn.disabled = true;

          try {
            await onAddReply(annotation.id, replyText, node.id);
            replyComposer.style.display = 'none';
            replyTextarea.value = '';
          } catch (err) {
            showToast(err.message || 'Failed to post reply.', 'error');
          } finally {
            sendReplyBtn.disabled = false;
          }
        });
      }

      // Event Listeners for Add Comment (New note in this discussion)
      if (addCommentButton) {
        addCommentButton.addEventListener('click', function (e) {
          e.stopPropagation();
          if (typeof options.onAddNewComment === 'function') {
            options.onAddNewComment(node);
          }
        });
      }

      parentElement.appendChild(card);

      // Recursively render child replies
      if (node.replies && node.replies.length > 0) {
        const repliesStream = document.createElement('div');
        repliesStream.className = 'comment-replies';
        node.replies.forEach(function (child) {
          renderNode(child, repliesStream);
        });
        parentElement.appendChild(repliesStream);
      }
    }

    tree.forEach(function (rootComment) {
      renderNode(rootComment, container);
    });
  }

  return {
    computeInitials: computeInitials,
    getAvatarColor: getAvatarColor,
    formatTimestamp: formatTimestamp,
    renderThread: renderThread
  };
});
