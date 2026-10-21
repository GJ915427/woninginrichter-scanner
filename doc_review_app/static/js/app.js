/**
 * Main Application Client Controller
 * Target Application: Document Review Web Application
 * Orchestrates M3 UI lifecycle, authentication, document reading, and annotation threading.
 */

(function () {
  'use strict';

  // Application Global State
  const state = {
    token: localStorage.getItem('doc_review_token') || null,
    currentUser: null,
    documents: [],
    currentDoc: null,
    annotations: [],
    activeAnnotation: null,
    pendingSelection: null,
    pendingDeleteDoc: null,
    searchQuery: '',
    tocObserver: null
  };

  // DOM Elements Cache
  const els = {
    appTitle: document.getElementById('app-title'),
    topAppBar: document.getElementById('top-app-bar'),
    btnNavToggle: document.getElementById('btn-nav-toggle'),
    btnOpenFolder: document.getElementById('btn-open-folder'),
    drawerHeaderTitle: document.getElementById('nav-drawer-header-title'),
    drawerToolbar: document.getElementById('nav-drawer-toolbar'),
    drawerDocsHeader: document.getElementById('nav-drawer-docs-header'),
    filePickerInput: document.getElementById('file-picker-input'),
    btnPickFile: document.getElementById('btn-pick-file'),
    docFileCount: document.getElementById('doc-file-count'),
    userAvatar: document.getElementById('user-avatar'),
    navDrawer: document.getElementById('nav-drawer'),
    drawerClose: document.getElementById('btn-drawer-close'),
    documentList: document.getElementById('document-list'),
    scrim: document.getElementById('scrim'),
    documentContainer: document.getElementById('document-content'),
    documentHeaderTitle: document.getElementById('doc-header-title'),
    documentHeaderMeta: document.getElementById('doc-header-meta'),
    btnExportAstFeedback: document.getElementById('btn-export-ast-feedback'),
    btnManageAccess: document.getElementById('btn-manage-access'),
    floatingCommentPill: document.getElementById('btn-floating-comment'),

    // Input Popover (Balloon)
    commentInputPopover: document.getElementById('comment-input-popover'),
    popoverInputQuote: document.getElementById('popover-input-quote'),
    popoverInputTextarea: document.getElementById('popover-input-textarea'),
    btnCancelInputPopover: document.getElementById('btn-cancel-input-popover'),
    btnSubmitInputPopover: document.getElementById('btn-submit-input-popover'),

    // View Popover (Balloon)
    commentViewPopover: document.getElementById('comment-view-popover'),
    btnCloseViewCard: document.getElementById('btn-close-view-card'),
    btnCloseViewPopover: document.getElementById('btn-close-view-popover'),
    popoverViewQuote: document.getElementById('popover-view-quote'),
    popoverViewBody: document.getElementById('popover-view-body'),
    popoverViewReplyToggle: document.getElementById('popover-view-reply-toggle'),
    btnToggleViewReply: document.getElementById('btn-toggle-view-reply'),
    popoverViewReplyBox: document.getElementById('popover-view-reply-box'),
    popoverViewTextarea: document.getElementById('popover-view-textarea'),
    btnSubmitViewReply: document.getElementById('btn-submit-view-reply'),

    // Delete Confirmation Dialog Modal
    deleteDocDialog: document.getElementById('delete-doc-dialog'),
    deleteDocTitle: document.getElementById('delete-doc-title'),
    deleteDocMessage: document.getElementById('delete-doc-message'),
    btnCancelDeleteDoc: document.getElementById('btn-cancel-delete-doc'),
    btnConfirmDeleteDoc: document.getElementById('btn-confirm-delete-doc'),

    authModal: document.getElementById('auth-modal'),
    loginForm: document.getElementById('login-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error'),
    snackbar: document.getElementById('snackbar'),
    snackbarText: document.getElementById('snackbar-text'),
    navDrawerTocSection: document.getElementById('nav-drawer-toc-section'),
    documentTocNav: document.getElementById('document-toc-nav'),
    overviewRuler: document.getElementById('m3-overview-ruler')
  };

  /**
   * Universal API Request Handler
   * Automatically injects Bearer authorization token and parses JSON responses.
   */
  async function api(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const fetchConfig = Object.assign({}, options, {
      headers: headers,
      credentials: 'same-origin'
    });

    const res = await fetch(url, fetchConfig);

    if (res.status === 401) {
      let detail = 'Authentication required';
      try {
        const body = await res.json();
        if (body && (body.detail || body.error)) {
          detail = body.detail || body.error;
        }
      } catch (e) {}
      state.token = null;
      state.currentUser = null;
      localStorage.removeItem('doc_review_token');
      showAuthDialog();
      const err = new Error(detail);
      err.status = 401;
      throw err;
    }

    if (!res.ok) {
      let detail = `Error ${res.status}: ${res.statusText}`;
      try {
        const body = await res.json();
        detail = body.detail || body.error || detail;
      } catch (e) {}
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  }

  /**
   * Display Material Design 3 Snackbar notification
   * @param {string} message
   * @param {'info'|'success'|'error'} [type='info']
   */
  let snackbarTimeout = null;
  function showToast(message, type = 'info') {
    if (!els.snackbar) return;
    clearTimeout(snackbarTimeout);

    els.snackbar.className = 'm3-snackbar';
    if (type === 'error') els.snackbar.classList.add('m3-snackbar--error');
    if (type === 'success') els.snackbar.classList.add('m3-snackbar--success');

    els.snackbarText.textContent = message;
    els.snackbar.classList.add('visible');

    snackbarTimeout = setTimeout(function () {
      els.snackbar.classList.remove('visible');
    }, 4000);
  }

  /**
   * Authentication State Handlers
   */
  function showAuthDialog() {
    if (els.authModal) {
      els.authModal.classList.add('open');
      if (els.loginUsername) els.loginUsername.focus();
    }
  }

  function hideAuthDialog() {
    if (els.authModal) {
      els.authModal.classList.remove('open');
      if (els.loginError) els.loginError.textContent = '';
      if (els.loginForm) els.loginForm.reset();
    }
  }

  /**
   * Role-Based Access Control (RBAC) UI Adaptation
   * Document selection, feedback export, and OS file explorer are admin-only features.
   */
  function applyRolePermissions(user) {
    const isAdmin = Boolean(user && user.is_admin);

    // 1. Exporteer feedback: admin only
    if (els.btnExportAstFeedback) {
      els.btnExportAstFeedback.style.display = isAdmin ? '' : 'none';
    }

    // 2. File Explorer openen: admin only
    if (els.btnOpenFolder) {
      els.btnOpenFolder.style.display = isAdmin ? '' : 'none';
    }
    if (els.drawerHeaderTitle) {
      els.drawerHeaderTitle.style.display = isAdmin ? 'none' : 'inline-block';
    }

    // 3. Document selecteren & toegangsbeheer: admin only
    if (els.btnPickFile) {
      els.btnPickFile.style.display = isAdmin ? '' : 'none';
    }
    if (els.btnManageAccess) {
      els.btnManageAccess.style.display = isAdmin ? 'flex' : 'none';
    }
    if (els.drawerToolbar) {
      els.drawerToolbar.style.display = isAdmin ? '' : 'none';
    }

    // 4. Documentenlijst & header: zichtbaar voor iedereen (reviewers zien gefilterde lijst)
    if (els.drawerDocsHeader) {
      els.drawerDocsHeader.style.display = '';
    }
    if (els.documentList) {
      els.documentList.style.display = '';
    }
  }

  async function checkAuthSession() {
    try {
      const user = await api('/api/auth/me');
      state.currentUser = user;
      updateUserAvatar(user);
      applyRolePermissions(user);
      hideAuthDialog();
      await loadDocuments();
    } catch (err) {
      applyRolePermissions(null);
      showAuthDialog();
    }
  }

  function updateUserAvatar(user) {
    if (!els.userAvatar || !user) return;
    const initials = user.initials || CommentsManager.computeInitials(user.full_name || user.username);
    els.userAvatar.textContent = initials;
    els.userAvatar.title = `${user.full_name || user.username} (Click to sign out)`;
    const palette = CommentsManager.getAvatarColor(user.username || initials);
    els.userAvatar.style.backgroundColor = palette.bg;
    els.userAvatar.style.color = palette.text;
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (els.loginError) els.loginError.textContent = '';
    const username = (els.loginUsername.value || '').trim();
    const password = els.loginPassword.value || '';

    if (!username || !password) {
      if (els.loginError) els.loginError.textContent = 'Please enter both username and password.';
      return;
    }

    try {
      const resp = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password })
      });

      if (resp && resp.token) {
        state.token = resp.token;
        localStorage.setItem('doc_review_token', resp.token);
        state.currentUser = resp.user;
        updateUserAvatar(resp.user);
        applyRolePermissions(resp.user);
        hideAuthDialog();
        showToast(`Welcome back, ${resp.user.full_name || resp.user.username}!`, 'success');
        await loadDocuments();
      }
    } catch (err) {
      if (els.loginError) {
        els.loginError.textContent = (err.message === 'Authentication required' || err.message === 'Invalid username or password.')
          ? 'Ongeldige gebruikersnaam of wachtwoord.'
          : (err.message || 'Ongeldige gebruikersnaam of wachtwoord.');
      }
    }
  }

  async function handleLogout() {
    if (!confirm('Are you sure you want to sign out?')) return;
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    state.token = null;
    state.currentUser = null;
    applyRolePermissions(null);
    localStorage.removeItem('doc_review_token');
    clearActiveDocumentState();
    showAuthDialog();
    showToast('Signed out successfully.', 'info');
  }

  function clearActiveDocumentState() {
    state.currentDoc = null;
    state.annotations = [];
    if (state.tocObserver) {
      state.tocObserver.disconnect();
      state.tocObserver = null;
    }
    if (els.documentContainer) {
      els.documentContainer.innerHTML = '';
    }
    if (els.documentHeaderTitle) {
      els.documentHeaderTitle.textContent = 'Select a document';
    }
    if (els.documentHeaderMeta) {
      els.documentHeaderMeta.textContent = '';
      els.documentHeaderMeta.style.display = 'none';
    }
    if (els.documentTocNav) {
      els.documentTocNav.innerHTML = '';
    }
    if (els.navDrawerTocSection) {
      els.navDrawerTocSection.style.display = 'none';
    }
    if (window.SelectionManager && typeof window.SelectionManager.hidePill === 'function') {
      window.SelectionManager.hidePill();
    }
    if (els.floatingCommentPill) {
      els.floatingCommentPill.style.display = 'none';
    }
    hideViewPopover();
    hideInputPopover();
    if (typeof OverviewRulerManager !== 'undefined' && typeof OverviewRulerManager.clear === 'function') {
      OverviewRulerManager.clear();
    }
  }

  const OverviewRulerManager = (function() {
    let rulerEl = null;
    let resizeObserver = null;
    let clusters = [];
    let resizeTimer = null;

    function debouncedUpdate() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(update, 150);
    }

    function init() {
      rulerEl = els.overviewRuler || document.getElementById('m3-overview-ruler');
      if (!rulerEl) return;

      const container = els.documentContainer || document.getElementById('document-content');
      if (window.ResizeObserver && container) {
        resizeObserver = new ResizeObserver(function() {
          update();
        });
        resizeObserver.observe(container);
      }
      window.addEventListener('resize', debouncedUpdate);
    }

    function clear() {
      if (rulerEl) {
        rulerEl.innerHTML = '';
      }
      clusters = [];
    }

    function update() {
      if (!rulerEl) {
        rulerEl = els.overviewRuler || document.getElementById('m3-overview-ruler');
      }
      if (!rulerEl) return;
      rulerEl.innerHTML = '';
      clusters = [];

      const docPane = document.getElementById('document-pane') || rulerEl.parentElement;
      const contentEl = els.documentContainer || document.getElementById('document-content');
      if (!docPane || !contentEl) return;

      const paneRect = docPane.getBoundingClientRect();
      const paneHeight = paneRect.height;
      const scrollHeight = docPane.scrollHeight;
      if (paneHeight <= 0 || scrollHeight <= 0) return;

      const badges = contentEl.querySelectorAll('.m3-orange-badge');
      if (!badges || badges.length === 0) return;

      const rawItems = [];
      badges.forEach(function(badge) {
        const badgeId = badge.getAttribute('data-annotation-id') || badge.getAttribute('data-badge-id');
        const ann = (state.annotations || []).find(function(a) { return String(a.id) === String(badgeId); });
        if (!ann) return;

        const badgeRect = badge.getBoundingClientRect();
        const relativeTop = badgeRect.top - paneRect.top + docPane.scrollTop;
        const normalizedY = (relativeTop / scrollHeight) * paneHeight;
        const clampedY = Math.max(8, Math.min(paneHeight - 14, normalizedY));

        rawItems.push({
          y: clampedY,
          ann: ann,
          badgeEl: badge
        });
      });

      rawItems.sort(function(a, b) { return a.y - b.y; });

      rawItems.forEach(function(item) {
        const lastCluster = clusters[clusters.length - 1];
        if (lastCluster && Math.abs(lastCluster.y - item.y) <= 8) {
          lastCluster.items.push(item);
        } else {
          clusters.push({
            y: item.y,
            items: [item],
            currentIndex: 0
          });
        }
      });

      clusters.forEach(function(cluster) {
        const marker = document.createElement('div');
        marker.className = 'm3-overview-ruler__marker';
        marker.style.top = `${Math.round(cluster.y)}px`;

        if (cluster.items.length > 1) {
          marker.classList.add('m3-overview-ruler__marker--clustered');
          marker.setAttribute('title', `${cluster.items.length} opmerkingen`);
        } else {
          const author = (cluster.items[0].ann.author && cluster.items[0].ann.author.full_name) || 'Opmerking';
          marker.setAttribute('title', author);
        }

        marker.addEventListener('click', function(e) {
          e.stopPropagation();
          const target = cluster.items[cluster.currentIndex % cluster.items.length];
          cluster.currentIndex++;

          target.badgeEl.scrollIntoView({ behavior: 'auto', block: 'center' });

          target.badgeEl.classList.remove('m3-annotation-highlight--pulse');
          void target.badgeEl.offsetWidth;
          target.badgeEl.classList.add('m3-annotation-highlight--pulse');

          openCommentThread(target.ann, target.badgeEl);
        });

        rulerEl.appendChild(marker);
      });
    }

    return {
      init: init,
      clear: clear,
      update: update
    };
  })();
  window.OverviewRulerManager = OverviewRulerManager;

  /**
   * Document Navigation & Content Rendering
   */
  function updateDocumentHeaderMeta(docParam) {
    const doc = docParam || state.currentDoc;
    if (!doc || !els.documentHeaderMeta) return;

    const parts = [];
    if (doc.filename) {
      parts.push(`<span class="m3-document-meta-chip m3-document-meta-chip--filename">${MarkdownRenderer.escapeHtml(doc.filename)}</span>`);
    }
    const annCount = Array.isArray(state.annotations) ? state.annotations.filter(function (a) {
      if (a.is_deleted) return false;
      if (a.comments && a.comments.length > 0) {
        return a.comments.some(function (c) { return !c.is_deleted; });
      }
      return true;
    }).length : (doc.annotations_count || 0);

    const commentTotal = Array.isArray(state.annotations) ? state.annotations.reduce(function (acc, a) {
      if (a.is_deleted) return acc;
      const active = a.comments
        ? a.comments.filter(function (c) { return !c.is_deleted; }).length
        : 1;
      return acc + active;
    }, 0) : 0;

    const wordCount = (doc.content || '').trim().split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.round(wordCount / 190));

    parts.push(`<span class="m3-document-meta-chip">Leestijd: ~${readingTime} min (${wordCount.toLocaleString()} woorden)</span>`);
    parts.push(`<span class="m3-document-meta-chip">${annCount} ${annCount === 1 ? 'annotatie' : 'annotaties'} (${commentTotal} ${commentTotal === 1 ? 'opmerking' : 'opmerkingen'})</span>`);

    if (doc.updated_at) {
      const d = new Date(doc.updated_at);
      parts.push(`<span class="m3-document-meta-chip">${d.toLocaleDateString()}</span>`);
    }

    els.documentHeaderMeta.innerHTML = parts.join(' ');
    els.documentHeaderMeta.style.display = 'flex';
  }

  async function refreshDocumentList() {
    try {
      const docs = await api('/api/documents');
      state.documents = Array.isArray(docs) ? docs : [];
      renderDocumentDrawerList();
    } catch (e) {}
  }

  async function loadDocuments() {
    try {
      const docs = await api('/api/documents');
      state.documents = Array.isArray(docs) ? docs : [];
      renderDocumentDrawerList();

      if (state.documents.length > 0) {
        const targetDocId = state.currentDoc ? state.currentDoc.id : state.documents[0].id;
        await selectDocument(targetDocId);
      } else {
        const isAdmin = Boolean(state.currentUser && state.currentUser.is_admin);
        if (isAdmin) {
          els.documentContainer.innerHTML = '<p class="m3-typography-body-medium" style="color: var(--md-sys-color-outline);">Geen documenten gevonden. Klik op "Document Selecteren" of plaats een .md bestand in de lokale map.</p>';
        } else {
          els.documentContainer.innerHTML = `
            <div class="reviewer-empty-state">
              <span class="material-symbols-outlined reviewer-empty-state__icon">folder_off</span>
              <div class="reviewer-empty-state__title">Geen documenten beschikbaar</div>
              <div class="reviewer-empty-state__desc">U heeft momenteel geen toegang tot documenten. Neem contact op met uw beheerder om toegang te verkrijgen.</div>
            </div>
          `;
        }
      }
    } catch (err) {
      showToast('Failed to load document list.', 'error');
    }
  }

  function renderDocumentDrawerList() {
    if (!els.documentList) return;
    els.documentList.innerHTML = '';

    if (els.docFileCount) {
      els.docFileCount.textContent = state.documents.length;
    }

    if (state.documents.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'document-nav-item--empty';
      const isAdmin = Boolean(state.currentUser && state.currentUser.is_admin);
      if (isAdmin) {
        emptyLi.innerHTML = `
          <div style="padding: 16px 8px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
            <p style="margin: 0 0 6px; font-weight: 500;">Geen documenten</p>
            <p style="margin: 0; font-size: 12px; line-height: 1.4; color: var(--md-sys-color-outline);">
              Klik op <strong>Document Selecteren</strong> of plaats een .md bestand in de geopende map.
            </p>
          </div>
        `;
      } else {
        emptyLi.innerHTML = `
          <div style="padding: 16px 8px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
            <p style="margin: 0 0 6px; font-weight: 500;">Geen documenten</p>
            <p style="margin: 0; font-size: 12px; line-height: 1.4; color: var(--md-sys-color-outline);">
              Vraag uw beheerder om toegang tot documenten.
            </p>
          </div>
        `;
      }
      els.documentList.appendChild(emptyLi);
      return;
    }

    state.documents.forEach(function (doc) {
      const li = document.createElement('li');
      li.className = 'document-nav-item';
      li.dataset.id = String(doc.id);
      if (state.currentDoc && state.currentDoc.id === doc.id) {
        li.classList.add('active');
      }

      const isMd = (doc.filename || '').endsWith('.md') || (doc.filename || '').endsWith('.markdown');
      const iconName = isMd ? 'description' : 'text_snippet';

      const isAdmin = Boolean(state.currentUser && state.currentUser.is_admin);
      const deleteButtonHtml = isAdmin
        ? `<button class="document-nav-item__delete m3-icon-button" type="button" title="Verwijder ${MarkdownRenderer.escapeHtml(doc.filename)}" aria-label="Verwijder ${MarkdownRenderer.escapeHtml(doc.filename)}">
            <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
          </button>`
        : '';

      li.innerHTML = `
        <span class="document-nav-item__name">
          <span class="material-symbols-outlined" style="font-size: 20px;">${iconName}</span>
          <span class="document-nav-item__label">${MarkdownRenderer.escapeHtml(doc.filename)}</span>
        </span>
        <div class="document-nav-item__actions">
          <span class="document-nav-item__badge" title="${doc.comment_count || 0} comment(s)">
            ${doc.comment_count || 0}
          </span>
          ${deleteButtonHtml}
        </div>
      `;

      li.addEventListener('click', function (e) {
        if (!state.currentUser) return;
        if (e.target.closest('.document-nav-item__delete')) return;
        selectDocument(doc.id);
        if (window.innerWidth < 840) {
          closeDrawer();
        }
      });

      const delBtn = li.querySelector('.document-nav-item__delete');
      if (delBtn && isAdmin) {
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openDeleteModal(doc);
        });
      }

      els.documentList.appendChild(li);
    });
  }

  function openDeleteModal(doc) {
    if (!state.currentUser || !state.currentUser.is_admin) {
      showToast('Uitsluitend toegankelijk voor beheerders.', 'error');
      return;
    }
    state.pendingDeleteDoc = doc;
    if (els.deleteDocMessage) {
      els.deleteDocMessage.textContent = `Weet je zeker dat je "${doc.filename}" wilt verwijderen? Alle bijbehorende annotaties en opmerkingen worden definitief gewist.`;
    }
    if (els.deleteDocDialog) {
      els.deleteDocDialog.style.display = 'flex';
    }
  }

  function closeDeleteModal() {
    state.pendingDeleteDoc = null;
    if (els.deleteDocDialog) {
      els.deleteDocDialog.style.display = 'none';
    }
  }

  async function handleConfirmDelete() {
    const docToDelete = state.pendingDeleteDoc;
    if (!docToDelete) return;
    closeDeleteModal();

    try {
      await api(`/api/documents/${docToDelete.id}`, { method: 'DELETE' });
      showToast(`Document "${docToDelete.filename}" verwijderd.`, 'info');

      // Refresh documents
      const docs = await api('/api/documents');
      state.documents = Array.isArray(docs) ? docs : [];
      renderDocumentDrawerList();

      // If the deleted document was currently active, fall back to another or empty state
      if (state.currentDoc && state.currentDoc.id === docToDelete.id) {
        clearActiveDocumentState();
        if (state.documents.length > 0) {
          await selectDocument(state.documents[0].id);
        } else {
          if (els.documentHeaderTitle) els.documentHeaderTitle.textContent = 'Geen documenten';
          if (els.documentHeaderMeta) els.documentHeaderMeta.innerHTML = '';
          els.documentContainer.innerHTML = '<p class="m3-typography-body-medium" style="color: var(--md-sys-color-outline);">Geen documenten in bibliotheek. Kies een map om te beginnen.</p>';
        }
      }
    } catch (err) {
      showToast('Fout bij verwijderen: ' + (err.message || 'Onbekende fout'), 'error');
    }
  }

  let isOpeningFolder = false;

  async function handleOpenFolder() {
    if (!state.currentUser || !state.currentUser.is_admin) {
      showToast('Uitsluitend toegankelijk voor beheerders.', 'error');
      return;
    }
    if (isOpeningFolder) return;
    isOpeningFolder = true;
    showToast('Documentenmap wordt geopend in Windows Verkenner...', 'info');
    try {
      await api('/api/documents/open-folder', { method: 'POST' });
    } catch (err) {
      showToast('Kon map niet automatisch openen: ' + (err.message || 'Onbekende fout'), 'error');
    } finally {
      setTimeout(function () {
        isOpeningFolder = false;
      }, 1000);
    }
  }

  // Expose to window for inline onclick handler resilience
  window.handleOpenFolder = handleOpenFolder;

  window.handleFileSelected = async function handleFileSelected(event) {
    if (!state.currentUser || !state.currentUser.is_admin) {
      showToast('Uitsluitend toegankelijk voor beheerders.', 'error');
      event.target.value = '';
      return;
    }
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const allowedExts = ['.md', '.txt'];
    const lowerName = file.name.toLowerCase();
    const isValid = allowedExts.some(ext => lowerName.endsWith(ext));
    if (!isValid) {
      showToast('Alleen .md en .txt bestanden worden ondersteund.', 'error');
      event.target.value = '';
      return;
    }

    showToast(`Document '${file.name}' importeren...`, 'info');
    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await api('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (Array.isArray(res) && res.length > 0) {
        showToast(`Document '${file.name}' succesvol toegevoegd!`, 'success');
        await loadDocuments();
        const uploadedDoc = res[0];
        if (uploadedDoc && uploadedDoc.id) {
          selectDocument(uploadedDoc.id);
        }
      } else {
        showToast('Document succesvol geïmporteerd.', 'success');
        await loadDocuments();
      }
    } catch (err) {
      console.error('File import failed:', err);
      showToast(err.message || 'Fout bij importeren van document.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  let isSyncing = false;
  let focusDebounceTimer = null;

  async function triggerFocusSync() {
    if (!state.token || isSyncing || !state.currentUser || !state.currentUser.is_admin) return;
    try {
      isSyncing = true;
      const res = await api('/api/documents/sync-folder', { method: 'POST' });
      if (res && ((res.added && res.added.length > 0) || (res.removed && res.removed.length > 0) || (res.updated && res.updated.length > 0))) {
        showToast('Documentenmap automatisch bijgewerkt.', 'info');
      }

      // Refresh drawer document list maintaining current state
      const docs = await api('/api/documents');
      state.documents = Array.isArray(docs) ? docs : [];
      renderDocumentDrawerList();

      // Check if current document was deleted on disk
      if (state.currentDoc) {
        const stillExists = state.documents.some(function (d) { return d.id === state.currentDoc.id; });
        if (!stillExists) {
          clearActiveDocumentState();
          if (state.documents.length > 0) {
            await selectDocument(state.documents[0].id);
          } else {
            if (els.documentHeaderTitle) els.documentHeaderTitle.textContent = 'Geen documenten';
            if (els.documentHeaderMeta) els.documentHeaderMeta.innerHTML = '';
            els.documentContainer.innerHTML = '<p class="m3-typography-body-medium" style="color: var(--md-sys-color-outline);">Geen documenten in bibliotheek. Plaats bestanden in de lokale map om te beginnen.</p>';
          }
        }
      } else if (state.documents.length > 0) {
        await selectDocument(state.documents[0].id);
      }
    } catch (err) {
      console.warn('Auto-sync notice:', err);
    } finally {
      isSyncing = false;
    }
  }

  function debouncedFocusSync() {
    clearTimeout(focusDebounceTimer);
    focusDebounceTimer = setTimeout(triggerFocusSync, 300);
  }

  function initFolderExplorer() {
    // Open Folder Trigger
    if (els.btnOpenFolder) {
      els.btnOpenFolder.addEventListener('click', handleOpenFolder);
    }

    // Native File Picker Trigger
    if (els.filePickerInput) {
      els.filePickerInput.addEventListener('change', window.handleFileSelected);
    }

    // Real-Time Focus Auto-Sync: triggers when returning to browser from Windows Explorer
    window.addEventListener('focus', debouncedFocusSync);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        debouncedFocusSync();
      }
    });

    // Delete confirmation dialog buttons
    if (els.btnCancelDeleteDoc) {
      els.btnCancelDeleteDoc.addEventListener('click', closeDeleteModal);
    }
    if (els.btnConfirmDeleteDoc) {
      els.btnConfirmDeleteDoc.addEventListener('click', handleConfirmDelete);
    }
    if (els.deleteDocDialog) {
      els.deleteDocDialog.addEventListener('click', function (e) {
        if (e.target === els.deleteDocDialog) {
          closeDeleteModal();
        }
      });
    }
  }

  async function selectDocument(docId, maintainScroll = false) {
    try {
      clearActiveDocumentState();
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      const doc = await api(`/api/documents/${docId}`);
      const annotations = await api(`/api/documents/${docId}/annotations`);

      state.currentDoc = doc;
      state.annotations = Array.isArray(annotations) ? annotations : [];

      // Update header
      if (els.documentHeaderTitle) {
        els.documentHeaderTitle.textContent = doc.filename;
      }
      updateDocumentHeaderMeta(doc);

      // Render document content via safe pipeline
      const renderedHtml = MarkdownRenderer.renderDocument(doc.content, doc.filename);
      els.documentContainer.innerHTML = renderedHtml;

      // Generate Table of Contents with Scrollspy
      generateTableOfContents(els.documentContainer);

      // Initialize Code Block One-Click Copy Buttons
      initCodeCopyButtons(els.documentContainer);

      // Apply annotations highlights and orange badges (#FF6D00)
      SelectionManager.renderAnnotations(
        els.documentContainer,
        state.annotations,
        openCommentThread,
        handleBadgeHover
      );

      // Re-highlight active document item in drawer
      renderDocumentDrawerList();

      OverviewRulerManager.update();

      // Scroll document reader only when explicitly not maintaining scroll
      if (maintainScroll) {
        window.scrollTo({ top: currentScrollY, behavior: 'instant' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Failed to load document content:', err);
      clearActiveDocumentState();
      showToast('Error loading document: ' + err.message, 'error');
    }
  }

  /**
   * Generates a Table of Contents (TOC) from H1, H2, and H3 headings
   * and sets up an IntersectionObserver scrollspy to highlight the active section.
   */
  function generateTableOfContents(container) {
    if (!els.navDrawerTocSection || !els.documentTocNav) return;

    if (state.tocObserver) {
      state.tocObserver.disconnect();
      state.tocObserver = null;
    }

    const headings = Array.from(container.querySelectorAll('h1, h2, h3'));
    if (headings.length === 0) {
      els.navDrawerTocSection.style.display = 'none';
      return;
    }

    els.navDrawerTocSection.style.display = 'flex';
    els.documentTocNav.innerHTML = '';

    const tocLinks = [];

    headings.forEach(function (h) {
      if (!h.id) {
        const slug = (h.textContent || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'heading';
        h.id = `heading-${slug}-${Math.random().toString(36).substring(2, 7)}`;
      }

      const link = document.createElement('a');
      link.href = `#${h.id}`;
      link.className = `m3-toc-link m3-toc-link--${h.tagName.toLowerCase()}`;
      link.textContent = (h.textContent || '').replace(/^#+\s*/, '').trim();
      link.title = link.textContent;
      link.setAttribute('data-doc-review-ignore', 'true');
      link.setAttribute('data-target-id', h.id);

      link.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.getElementById(h.id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, null, `#${h.id}`);
        }
      });

      els.documentTocNav.appendChild(link);
      tocLinks.push({ heading: h, link: link });
    });

    if ('IntersectionObserver' in window && headings.length > 0) {
      const observerCallback = function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            const activeId = entry.target.id;
            tocLinks.forEach(function (item) {
              if (item.heading.id === activeId) {
                item.link.classList.add('active');
              } else {
                item.link.classList.remove('active');
              }
            });
          }
        });
      };

      state.tocObserver = new IntersectionObserver(observerCallback, {
        root: null,
        rootMargin: '0px 0px -70% 0px',
        threshold: 0
      });

      headings.forEach(function (h) {
        state.tocObserver.observe(h);
      });
    }
  }

  /**
   * Initializes One-Click Copy functionality on all fenced code block headers.
   */
  function initCodeCopyButtons(container) {
    if (!container) return;
    const copyButtons = container.querySelectorAll('.m3-code-copy-btn');
    copyButtons.forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        const codeBox = btn.closest('.m3-code-box');
        if (!codeBox) return;
        const codeElem = codeBox.querySelector('pre code');
        if (!codeElem) return;

        const textToCopy = codeElem.textContent || '';
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
          } else {
            const tempTa = document.createElement('textarea');
            tempTa.value = textToCopy;
            document.body.appendChild(tempTa);
            tempTa.select();
            document.execCommand('copy');
            document.body.removeChild(tempTa);
          }
          const iconSpan = btn.querySelector('.material-symbols-outlined');
          if (iconSpan) {
            const originalIcon = iconSpan.textContent;
            iconSpan.textContent = 'check';
            btn.style.color = '#2e7d32';
            setTimeout(function () {
              iconSpan.textContent = originalIcon;
              btn.style.color = '';
            }, 1800);
          }
          showToast('Code gekopieerd naar klembord!', 'success');
        } catch (err) {
          showToast('Kopiëren mislukt: ' + err.message, 'error');
        }
      });
    });
  }

  /**
   * Helper: Position a floating popover balloon anchored at a DOM rect (selection or badge)
   */
  function positionElementAtRect(element, targetRect) {
    if (!element || !targetRect) return;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

    element.style.display = 'flex';
    element.style.visibility = 'hidden';

    // Make popover span virtually the full width of the document card
    const card = document.querySelector('.document-card');
    let left = targetRect.left + scrollX;

    if (card) {
      const cardRect = card.getBoundingClientRect();
      const cardPadding = 16;
      left = cardRect.left + scrollX + cardPadding;
      const targetWidth = Math.max(300, cardRect.width - (cardPadding * 2));
      element.style.width = targetWidth + 'px';
      element.style.maxWidth = targetWidth + 'px';
    } else {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      element.style.width = Math.min(viewportWidth - 32, 1340) + 'px';
      element.style.maxWidth = '1340px';
      left = 16;
    }

    const popoverHeight = element.offsetHeight || 160;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const spaceBelow = viewportHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let top = 0;
    // Default: directly below the orange highlighted section
    // Only flip above if there is not enough room below AND more room above
    if (spaceBelow < (popoverHeight + 16) && spaceAbove > spaceBelow) {
      top = targetRect.top + scrollY - popoverHeight - 8;
    } else {
      top = targetRect.bottom + scrollY + 8;
    }

    // Clamp top so it never goes off-screen
    if (top < scrollY + 8) {
      top = scrollY + 8;
    }

    element.style.top = top + 'px';
    element.style.left = left + 'px';
    element.style.visibility = 'visible';

    requestAnimationFrame(function () {
      element.classList.add('visible');
    });
  }

  /**
   * Thread & Floating View Popover Controller
   */
  let hoverDismissTimer = null;
  let isThreadPinned = false;

  function openCommentThread(annotation, badgeElement, isPinned = true) {
    state.activeAnnotation = annotation;
    state.pendingSelection = null;
    isThreadPinned = isPinned;

    hideInputPopover();

    if (els.popoverViewTextarea) {
      els.popoverViewTextarea.value = '';
    }
    if (els.popoverViewReplyBox) {
      els.popoverViewReplyBox.style.display = 'none';
    }

    renderActiveThread();

    // Position directly under the orange highlighted text
    let rect = null;
    const marks = document.querySelectorAll(`.m3-annotation-highlight[data-annotation-id="${annotation.id}"]`);
    if (marks && marks.length > 0) {
      const lastMark = marks[marks.length - 1];
      rect = lastMark.getBoundingClientRect();
    } else if (badgeElement && typeof badgeElement.getBoundingClientRect === 'function') {
      rect = badgeElement.getBoundingClientRect();
    } else {
      const foundBadge = document.querySelector(`.m3-orange-badge[data-annotation-id="${annotation.id}"]`);
      if (foundBadge) {
        rect = foundBadge.getBoundingClientRect();
      }
    }

    if (rect) {
      positionElementAtRect(els.commentViewPopover, rect);
    } else if (els.commentViewPopover) {
      els.commentViewPopover.style.display = 'flex';
      els.commentViewPopover.classList.add('visible');
    }
  }

  function hideViewPopover() {
    if (els.commentViewPopover) {
      els.commentViewPopover.classList.remove('visible');
      setTimeout(function () {
        if (!els.commentViewPopover.classList.contains('visible')) {
          els.commentViewPopover.style.display = 'none';
        }
      }, 160);
    }
    state.activeAnnotation = null;
    isThreadPinned = false;
  }

  function handleBadgeHover(annotation, badgeElement, e) {
    if (!annotation) {
      // Mouse left badge: start dismissal timer unless user enters popover or it is pinned
      if (!isThreadPinned) {
        clearTimeout(hoverDismissTimer);
        hoverDismissTimer = setTimeout(function () {
          if (!isThreadPinned) {
            hideViewPopover();
          }
        }, 280);
      }
      return;
    }

    // Mouse entered badge: show preview if not pinned
    clearTimeout(hoverDismissTimer);
    if (!isThreadPinned || (state.activeAnnotation && state.activeAnnotation.id !== annotation.id)) {
      openCommentThread(annotation, badgeElement, false);
    }
  }

  function renderActiveThread() {
    if (!state.activeAnnotation || !els.popoverViewBody) return;
    CommentsManager.renderThread({
      container: els.popoverViewBody,
      annotation: state.activeAnnotation,
      currentUser: state.currentUser,
      onEditComment: handleEditComment,
      onDeleteComment: handleDeleteComment,
      onViewHistory: handleViewHistory,
      onAddReply: handleAddReply,
      onAddNewComment: function () {
        if (els.popoverViewReplyBox) {
          els.popoverViewReplyBox.style.display = 'flex';
          if (els.popoverViewTextarea) {
            els.popoverViewTextarea.placeholder = 'Voeg een opmerking toe...';
            els.popoverViewTextarea.focus();
          }
        }
      },
      showToast: showToast
    });
  }

  async function handleEditComment(commentId, newContent) {
    const res = await api(`/api/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: newContent })
    });
    // Refresh annotations for current document
    if (state.currentDoc) {
      const refreshedAnnotations = await api(`/api/documents/${state.currentDoc.id}/annotations`);
      state.annotations = refreshedAnnotations;
      const found = refreshedAnnotations.find(function (a) {
        return state.activeAnnotation && String(a.id) === String(state.activeAnnotation.id);
      });
      if (found) {
        state.activeAnnotation = found;
        renderActiveThread();
      }
    }
    return res;
  }

  async function handleDeleteComment(commentId) {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    try {
      const res = await api(`/api/comments/${commentId}`, {
        method: 'DELETE'
      });
      showToast('Opmerking verwijderd.', 'success');

      if (state.currentDoc) {
        const refreshedAnnotations = await api(`/api/documents/${state.currentDoc.id}/annotations`);
        state.annotations = refreshedAnnotations;
        const found = refreshedAnnotations.find(function (a) {
          return state.activeAnnotation && String(a.id) === String(state.activeAnnotation.id);
        });

        const activeCount = found && Array.isArray(found.comments)
          ? found.comments.filter(function (c) { return !c.is_deleted; }).length
          : 0;

        if (!found || (res && res.annotation_deleted) || activeCount === 0) {
          hideViewPopover();
          SelectionManager.renderAnnotations(
            els.documentContainer,
            state.annotations,
            openCommentThread,
            handleBadgeHover
          );
        } else {
          state.activeAnnotation = found;
          renderActiveThread();
          SelectionManager.renderAnnotations(
            els.documentContainer,
            state.annotations,
            openCommentThread,
            handleBadgeHover
          );
        }
        updateDocumentHeaderMeta();
        OverviewRulerManager.update();
        await refreshDocumentList();
        window.scrollTo({ top: currentScrollY, behavior: 'instant' });
      }
      return res;
    } catch (err) {
      showToast('Fout bij verwijderen: ' + err.message, 'error');
    }
  }

  async function handleViewHistory(commentId) {
    try {
      const history = await api(`/api/comments/${commentId}/history`);
      if (!history || history.length === 0) {
        showToast('Geen revisies gevonden in het auditlogboek.', 'info');
        return;
      }
      let summary = `Audit Trail / Revisiegeschiedenis (Opmerking #${commentId}):\n\n`;
      history.forEach(function (h, i) {
        const time = new Date(h.created_at).toLocaleString();
        summary += `${i + 1}. [${h.action}] door ${h.user_name || h.user_initials || 'Gebruiker'} (${time})\n`;
        if (h.old_value) summary += `   Vorige tekst: "${h.old_value}"\n`;
        if (h.new_value) summary += `   Nieuwe tekst: "${h.new_value}"\n`;
      });
      alert(summary);
    } catch (err) {
      showToast('Fout bij ophalen auditlog: ' + err.message, 'error');
    }
  }

  async function handleAddReply(annotationId, content, parentCommentId = null) {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const payload = { content: content };
    if (parentCommentId !== null) {
      payload.parent_comment_id = parentCommentId;
    }

    await api(`/api/annotations/${annotationId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Refresh annotations for current document
    if (state.currentDoc) {
      const refreshedAnnotations = await api(`/api/documents/${state.currentDoc.id}/annotations`);
      state.annotations = refreshedAnnotations;
      const found = refreshedAnnotations.find(function (a) {
        return String(a.id) === String(annotationId);
      });
      if (found) {
        state.activeAnnotation = found;
        renderActiveThread();
      }
      SelectionManager.renderAnnotations(
        els.documentContainer,
        state.annotations,
        openCommentThread,
        handleBadgeHover
      );
      updateDocumentHeaderMeta();
      OverviewRulerManager.update();
      await refreshDocumentList();
      window.scrollTo({ top: currentScrollY, behavior: 'instant' });
    }
    showToast('Reactie geplaatst.', 'success');
  }

  /**
   * New Annotation Creation from Selection (Floating Input Popover)
   */
  function handleSelectionForNewComment(selectionData, targetRect) {
    state.pendingSelection = selectionData;
    state.activeAnnotation = null;
    hideViewPopover();

    if (els.popoverInputTextarea) {
      els.popoverInputTextarea.value = '';
    }

    if (targetRect) {
      positionElementAtRect(els.commentInputPopover, targetRect);
    } else if (els.commentInputPopover) {
      els.commentInputPopover.style.display = 'flex';
      els.commentInputPopover.classList.add('visible');
    }

    setTimeout(function () {
      if (els.popoverInputTextarea) {
        els.popoverInputTextarea.focus();
      }
    }, 150);
  }

  function hideInputPopover() {
    if (els.commentInputPopover) {
      els.commentInputPopover.classList.remove('visible');
      setTimeout(function () {
        if (!els.commentInputPopover.classList.contains('visible')) {
          els.commentInputPopover.style.display = 'none';
        }
      }, 160);
    }
    state.pendingSelection = null;
  }

  async function handleSubmitNewComment() {
    const content = (els.popoverInputTextarea ? els.popoverInputTextarea.value : '').trim();
    if (!content) {
      showToast('Vul een opmerking in.', 'error');
      return;
    }

    if (!state.pendingSelection || !state.currentDoc) {
      hideInputPopover();
      return;
    }

    if (els.btnSubmitInputPopover) els.btnSubmitInputPopover.disabled = true;

    // Freeze viewport scroll position
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

    try {
      const payload = {
        start_offset: state.pendingSelection.start_offset,
        end_offset: state.pendingSelection.end_offset,
        selected_text: state.pendingSelection.selected_text,
        comment_content: content,
        badge_color: '#FF6D00',
        ast_path: state.pendingSelection.ast_path || null,
        node_type: state.pendingSelection.node_type || null
      };

      await api(`/api/documents/${state.currentDoc.id}/annotations`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Close popovers immediately
      hideInputPopover();
      hideViewPopover();
      showToast('Opmerking geplaatst!', 'success');

      // Reload annotations and re-render document with maintainScroll = true
      await selectDocument(state.currentDoc.id, true);
      await refreshDocumentList();

      // Lock scroll position in place so document never jumps or shifts
      window.scrollTo({ top: currentScrollY, behavior: 'instant' });
      requestAnimationFrame(function () {
        window.scrollTo({ top: currentScrollY, behavior: 'instant' });
      });

      // Popover remains closed as requested by the user. Badge & highlight are now visible in-line.
    } catch (err) {
      showToast('Fout bij plaatsen: ' + err.message, 'error');
    } finally {
      if (els.btnSubmitInputPopover) els.btnSubmitInputPopover.disabled = false;
    }
  }

  async function handleSubmitViewReply() {
    const content = (els.popoverViewTextarea ? els.popoverViewTextarea.value : '').trim();
    if (!content) {
      showToast('Vul een reactie in.', 'error');
      return;
    }

    if (!state.activeAnnotation) return;

    if (els.btnSubmitViewReply) els.btnSubmitViewReply.disabled = true;

    try {
      await handleAddReply(state.activeAnnotation.id, content, null);
      if (els.popoverViewTextarea) els.popoverViewTextarea.value = '';
      if (els.popoverViewReplyBox) els.popoverViewReplyBox.style.display = 'none';
    } catch (err) {
      showToast('Fout: ' + err.message, 'error');
    } finally {
      if (els.btnSubmitViewReply) els.btnSubmitViewReply.disabled = false;
    }
  }

  async function handleExportAstFeedback() {
    if (!state.currentUser || !state.currentUser.is_admin) {
      showToast('Uitsluitend toegankelijk voor beheerders.', 'error');
      return;
    }
    if (!state.currentDoc) {
      showToast('Selecteer eerst een document.', 'error');
      return;
    }

    if (els.btnExportAstFeedback) els.btnExportAstFeedback.disabled = true;

    try {
      showToast('Feedback genereren...', 'info');
      const res = await api(`/api/documents/${state.currentDoc.id}/export-feedback`, {
        method: 'POST'
      });

      if (res && res.markdown) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(res.markdown);
          showToast(`Feedback opgeslagen en gekopieerd naar klembord!`, 'success');
        } else {
          showToast(`Feedback opgeslagen naar ${res.export_path}!`, 'success');
        }
      } else {
        showToast('Feedback geëxporteerd!', 'success');
      }
    } catch (err) {
      showToast('Fout bij exporteren: ' + err.message, 'error');
    } finally {
      if (els.btnExportAstFeedback) els.btnExportAstFeedback.disabled = false;
    }
  }

  /**
   * Drawer State
   */
  function openDrawer() {
    if (els.navDrawer) els.navDrawer.classList.add('open');
    if (els.scrim && window.innerWidth < 840) els.scrim.classList.add('active');
  }

  function closeDrawer() {
    if (els.navDrawer) els.navDrawer.classList.remove('open');
    if (els.scrim) els.scrim.classList.remove('active');
  }

  /**
   * Sync Action Handler
   */
  async function handleSyncTrigger() {
    showToast('Synchroniseren van documenten uit lokale map...', 'info');
    try {
      await loadDocuments();
      showToast('Documenten succesvol gesynchroniseerd.', 'success');
    } catch (e) {
      showToast('Sync voltooid met meldingen.', 'info');
    }
  }

  /**
   * Wire Event Listeners & Initialize
   */
  function initListeners() {
    // Initialize File Explorer & focus auto-sync
    initFolderExplorer();

    // Drawer Toggles
    if (els.btnNavToggle) {
      els.btnNavToggle.addEventListener('click', function () {
        if (els.navDrawer && els.navDrawer.classList.contains('open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    if (els.drawerClose) {
      els.drawerClose.addEventListener('click', closeDrawer);
    }

    // Scrim Dismissal
    if (els.scrim) {
      els.scrim.addEventListener('click', closeDrawer);
    }

    // Real-time focus auto-sync is active; manual sync buttons removed for clean UX

    // User Avatar / Logout Trigger
    if (els.userAvatar) {
      els.userAvatar.addEventListener('click', handleLogout);
    }

    // Input Popover Buttons
    if (els.btnCancelInputPopover) {
      els.btnCancelInputPopover.addEventListener('click', hideInputPopover);
    }
    if (els.btnSubmitInputPopover) {
      els.btnSubmitInputPopover.addEventListener('click', handleSubmitNewComment);
    }
    if (els.popoverInputTextarea) {
      els.popoverInputTextarea.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmitNewComment();
        }
      });
    }

    // View Popover Buttons & Reply Toggle
    if (els.btnCloseViewCard) {
      els.btnCloseViewCard.addEventListener('click', hideViewPopover);
    }
    if (els.btnCloseViewPopover) {
      els.btnCloseViewPopover.addEventListener('click', function () {
        if (els.popoverViewReplyBox) els.popoverViewReplyBox.style.display = 'none';
        if (els.popoverViewTextarea) els.popoverViewTextarea.value = '';
      });
    }
    if (els.btnSubmitViewReply) {
      els.btnSubmitViewReply.addEventListener('click', handleSubmitViewReply);
    }
    if (els.popoverViewTextarea) {
      els.popoverViewTextarea.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSubmitViewReply();
        }
      });
    }

    // Popover hover keep-alive
    if (els.commentViewPopover) {
      els.commentViewPopover.addEventListener('mouseenter', function () {
        clearTimeout(hoverDismissTimer);
      });
      els.commentViewPopover.addEventListener('mouseleave', function () {
        if (!isThreadPinned) {
          hoverDismissTimer = setTimeout(function () {
            if (!isThreadPinned) {
              hideViewPopover();
            }
          }, 280);
        }
      });
    }

    // Global Click-Outside Dismissal
    document.addEventListener('mousedown', function (e) {
      if (
        (els.commentInputPopover && els.commentInputPopover.contains(e.target)) ||
        (els.commentViewPopover && els.commentViewPopover.contains(e.target)) ||
        (els.floatingCommentPill && els.floatingCommentPill.contains(e.target)) ||
        (e.target.closest && (e.target.closest('.m3-orange-badge') || e.target.closest('.m3-annotation-highlight')))
      ) {
        return;
      }
      hideInputPopover();
      hideViewPopover();
    });

    // Escape Key Dismissal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hideInputPopover();
        hideViewPopover();
        closeDrawer();
      }
    });

    // Login Form
    if (els.loginForm) {
      els.loginForm.addEventListener('submit', handleLoginSubmit);
    }

    // Export AST Feedback Button
    if (els.btnExportAstFeedback) {
      els.btnExportAstFeedback.addEventListener('click', handleExportAstFeedback);
    }

    // Initialize Selection Manager
    SelectionManager.init(
      els.documentContainer,
      els.floatingCommentPill,
      handleSelectionForNewComment
    );
  }

  // ============================================================================
  // Document Access Control Matrix Functions (Admin Only)
  // ============================================================================

  let docAccessData = null;

  async function openDocumentAccessModal() {
    if (!state.currentUser || !state.currentUser.is_admin) {
      showToast('Uitsluitend toegankelijk voor beheerders.', 'error');
      return;
    }
    const modal = document.getElementById('document-access-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    await loadDocumentAccessMatrix();
  }

  function closeDocumentAccessModal() {
    const modal = document.getElementById('document-access-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  window.openDocumentAccessModal = openDocumentAccessModal;
  window.closeDocumentAccessModal = closeDocumentAccessModal;

  async function loadDocumentAccessMatrix() {
    const container = document.getElementById('doc-access-table-container');
    const statusEl = document.getElementById('doc-access-status');
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--md-sys-color-on-surface-variant);">
        <span class="material-symbols-outlined spin" style="font-size: 24px; vertical-align: middle;">sync</span>
        <span style="margin-left: 8px;">Matrix laden...</span>
      </div>
    `;
    if (statusEl) statusEl.textContent = '';

    try {
      docAccessData = await api('/api/admin/document-access');
      renderDocumentAccessMatrix(docAccessData);
    } catch (err) {
      container.innerHTML = `
        <div class="doc-access-empty">
          <p style="color: var(--md-sys-color-error);">Fout bij laden van toegangsmatrix: ${MarkdownRenderer.escapeHtml(err.message || 'Onbekende fout')}</p>
        </div>
      `;
    }
  }

  function renderDocumentAccessMatrix(data) {
    const container = document.getElementById('doc-access-table-container');
    if (!container) return;

    const users = (data && data.users) || [];
    const documents = (data && data.documents) || [];

    if (users.length === 0) {
      container.innerHTML = `
        <div class="doc-access-empty">
          <p>Geen actieve reviewers gevonden in het systeem.</p>
        </div>
      `;
      return;
    }

    if (documents.length === 0) {
      container.innerHTML = `
        <div class="doc-access-empty">
          <p>Geen documenten beschikbaar om te beheren.</p>
        </div>
      `;
      return;
    }

    let html = `
      <table class="doc-access-table">
        <thead>
          <tr>
            <th style="min-width: 220px;">Document</th>
    `;

    users.forEach(function (u) {
      html += `
        <th class="doc-access-user-header">
          <span class="doc-access-user-name">${MarkdownRenderer.escapeHtml(u.name || u.username)}</span>
          <span class="doc-access-user-uname">@${MarkdownRenderer.escapeHtml(u.username)}</span>
        </th>
      `;
    });

    html += `
          </tr>
        </thead>
        <tbody>
    `;

    documents.forEach(function (doc) {
      html += `
        <tr data-doc-id="${doc.id}">
          <td class="doc-access-doc-name" title="${MarkdownRenderer.escapeHtml(doc.filename)}">
            <div class="doc-access-doc-header">
              <span class="doc-access-doc-title">${MarkdownRenderer.escapeHtml(doc.filename)}</span>
              <div class="doc-access-bulk-actions">
                <button type="button" class="m3-button m3-button--text doc-access-btn-bulk" onclick="handleToggleAllUsersForDocument(${doc.id}, true)">Alles</button>
                <span class="doc-access-bulk-divider">/</span>
                <button type="button" class="m3-button m3-button--text doc-access-btn-bulk" onclick="handleToggleAllUsersForDocument(${doc.id}, false)">Geen</button>
              </div>
            </div>
          </td>
      `;

      users.forEach(function (u) {
        const isGranted = Boolean(doc.access && doc.access[String(u.id)]);
        html += `
          <td class="doc-access-cell">
            <label class="doc-access-checkbox-label" title="${isGranted ? 'Toegang intrekken' : 'Toegang verlenen'} voor ${MarkdownRenderer.escapeHtml(u.name)}">
              <input type="checkbox"
                data-doc-id="${doc.id}"
                data-user-id="${u.id}"
                ${isGranted ? 'checked' : ''}
                onchange="handleAccessToggle(this, ${doc.id}, ${u.id})"
                aria-label="Toegang ${MarkdownRenderer.escapeHtml(doc.filename)} voor ${MarkdownRenderer.escapeHtml(u.name)}"
              />
            </label>
          </td>
        `;
      });

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  async function handleAccessToggle(checkbox, docId, userId) {
    const isGranted = checkbox.checked;
    const statusEl = document.getElementById('doc-access-status');
    if (statusEl) {
      statusEl.style.color = 'var(--md-sys-color-primary)';
      statusEl.textContent = 'Toegang bijwerken...';
    }

    try {
      await api('/api/admin/document-access/toggle', {
        method: 'POST',
        body: JSON.stringify({
          document_id: docId,
          user_id: userId,
          granted: isGranted,
        }),
      });

      if (docAccessData && docAccessData.documents) {
        const docEntry = docAccessData.documents.find(function (d) { return d.id === docId; });
        if (docEntry) {
          if (!docEntry.access) docEntry.access = {};
          docEntry.access[String(userId)] = isGranted;
        }
      }

      if (statusEl) {
        statusEl.style.color = 'var(--md-sys-color-primary)';
        statusEl.textContent = 'Toegang succesvol bijgewerkt.';
        setTimeout(function () {
          if (statusEl.textContent === 'Toegang succesvol bijgewerkt.') {
            statusEl.textContent = '';
          }
        }, 2000);
      }
    } catch (err) {
      checkbox.checked = !isGranted;
      if (statusEl) {
        statusEl.style.color = 'var(--md-sys-color-error)';
        statusEl.textContent = 'Fout bij bijwerken toegang: ' + (err.message || 'Netwerkfout');
      }
    }
  }

  async function handleToggleAllUsersForDocument(docId, selectAll) {
    const users = (docAccessData && docAccessData.users) || [];
    if (!users.length) return;

    const row = document.querySelector(`tr[data-doc-id="${docId}"]`);
    const checkboxes = row ? row.querySelectorAll('input[type="checkbox"]') : [];
    const bulkButtons = row ? row.querySelectorAll('.doc-access-btn-bulk') : [];

    const snapshot = Array.from(checkboxes).map(function (cb) {
      return { cb: cb, checked: cb.checked };
    });

    checkboxes.forEach(function (cb) {
      cb.checked = selectAll;
      cb.disabled = true;
    });
    bulkButtons.forEach(function (btn) {
      btn.disabled = true;
    });

    const statusEl = document.getElementById('doc-access-status');
    if (statusEl) {
      statusEl.style.color = 'var(--md-sys-color-primary)';
      statusEl.textContent = 'Toegang bijwerken...';
    }

    try {
      const targetUserIds = selectAll ? users.map(function (u) { return u.id; }) : [];
      await api('/api/admin/document-access', {
        method: 'PUT',
        body: JSON.stringify({
          access_map: {
            [String(docId)]: targetUserIds
          }
        })
      });

      if (docAccessData && docAccessData.documents) {
        const docEntry = docAccessData.documents.find(function (d) { return d.id === docId; });
        if (docEntry) {
          if (!docEntry.access) docEntry.access = {};
          users.forEach(function (u) {
            docEntry.access[String(u.id)] = selectAll;
          });
        }
      }

      if (statusEl) {
        statusEl.style.color = 'var(--md-sys-color-primary)';
        statusEl.textContent = selectAll ? 'Toegang voor alle reviewers verleend.' : 'Toegang voor alle reviewers ingetrokken.';
        setTimeout(function () {
          if (statusEl.textContent.indexOf('Toegang voor alle reviewers') !== -1) {
            statusEl.textContent = '';
          }
        }, 2000);
      }
    } catch (err) {
      snapshot.forEach(function (item) {
        item.cb.checked = item.checked;
      });
      if (statusEl) {
        statusEl.style.color = 'var(--md-sys-color-error)';
        statusEl.textContent = 'Fout bij bijwerken: ' + (err.message || 'Netwerkfout');
      }
    } finally {
      checkboxes.forEach(function (cb) {
        cb.disabled = false;
      });
      bulkButtons.forEach(function (btn) {
        btn.disabled = false;
      });
    }
  }

  window.handleAccessToggle = handleAccessToggle;
  window.handleToggleAllUsersForDocument = handleToggleAllUsersForDocument;

  // Application Entry Point
  document.addEventListener('DOMContentLoaded', function () {
    initListeners();
    OverviewRulerManager.init();
    applyRolePermissions(null);
    checkAuthSession();
  });
})();
