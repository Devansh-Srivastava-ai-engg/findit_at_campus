(() => {
  // Use relative '/api' on production or when served directly from Express.
  // Fall back to 'http://localhost:3000/api' only if previewed via Live Server (port 5500/5501).
  const API_BASE = (window.location.port === '5500' || window.location.port === '5501')
    ? 'http://localhost:3000/api'
    : '/api';

  const categoryIcons = {
    'ID & Cards': '🪪',
    'Electronics': '💻',
    'Books & Notes': '📖',
    'Bags & Bottles': '🎒',
    'Clothing': '👕',
    'Other': '📦'
  };

  // State
  let reports = [];
  let isFetching = false;
  let activeType = 'all';

  // DOM Elements
  const el = {
    grid: document.getElementById('itemsGrid'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyStateTitle'),
    emptyDesc: document.getElementById('emptyStateDesc'),
    emptyResetBtn: document.getElementById('emptyResetBtn'),
    emptyReportBtn: document.getElementById('emptyReportBtn'),
    searchInput: document.getElementById('searchInput'),
    searchKbd: document.getElementById('searchKbd'),
    categorySelect: document.getElementById('categorySelect'),
    statusSelect: document.getElementById('statusSelect'),
    resultsCount: document.getElementById('resultsCount'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    segmentBtns: document.querySelectorAll('.segment-btn'),
    systemStatus: document.getElementById('systemStatus'),
    // Stats
    statTotal: document.getElementById('statTotal'),
    statLost: document.getElementById('statLost'),
    statFound: document.getElementById('statFound'),
    statReturned: document.getElementById('statReturned'),
    // Report Modal
    modal: document.getElementById('reportModal'),
    modalForm: document.getElementById('reportForm'),
    openModalBtn: document.getElementById('openReportModalBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    submitBtn: document.getElementById('submitReportBtn'),
    itemType: document.getElementById('itemType'),
    itemCategory: document.getElementById('itemCategory'),
    itemName: document.getElementById('itemName'),
    itemLocation: document.getElementById('itemLocation'),
    itemDate: document.getElementById('itemDate'),
    itemContact: document.getElementById('itemContact'),
    itemDescription: document.getElementById('itemDescription'),
    // Item Photo Upload
    photoDropzone: document.getElementById('photoDropzone'),
    itemPhotoFile: document.getElementById('itemPhotoFile'),
    photoPrompt: document.getElementById('photoPrompt'),
    photoPreviewBox: document.getElementById('photoPreviewBox'),
    photoPreviewImg: document.getElementById('photoPreviewImg'),
    removePhotoBtn: document.getElementById('removePhotoBtn'),
    itemPhotoData: document.getElementById('itemPhotoData'),
    // Claim Modal
    claimModal: document.getElementById('claimModal'),
    claimForm: document.getElementById('claimForm'),
    claimItemId: document.getElementById('claimItemId'),
    claimItemSummary: document.getElementById('claimItemSummary'),
    closeClaimModalBtn: document.getElementById('closeClaimModalBtn'),
    cancelClaimModalBtn: document.getElementById('cancelClaimModalBtn'),
    submitClaimBtn: document.getElementById('submitClaimBtn'),
    claimantName: document.getElementById('claimantName'),
    claimantId: document.getElementById('claimantId'),
    claimantContact: document.getElementById('claimantContact'),
    claimProof: document.getElementById('claimProof'),
    // Claimant Photo Upload
    claimPhotoDropzone: document.getElementById('claimPhotoDropzone'),
    claimantPhotoFile: document.getElementById('claimantPhotoFile'),
    claimPhotoPrompt: document.getElementById('claimPhotoPrompt'),
    claimPhotoPreviewBox: document.getElementById('claimPhotoPreviewBox'),
    claimPhotoPreviewImg: document.getElementById('claimPhotoPreviewImg'),
    removeClaimPhotoBtn: document.getElementById('removeClaimPhotoBtn'),
    claimantPhotoData: document.getElementById('claimantPhotoData'),
    // Lightbox
    lightboxModal: document.getElementById('lightboxModal'),
    lightboxImg: document.getElementById('lightboxImg'),
    lightboxCaption: document.getElementById('lightboxCaption'),
    closeLightboxBtn: document.getElementById('closeLightboxBtn'),
    // Toast
    toast: document.getElementById('toastNotice')
  };

  // Toast notification
  let toastTimer = null;
  function notify(message, variant = 'info') {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.className = `toast-notice toast-${variant}`;
    el.toast.classList.remove('hidden');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 3200);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return 'Date not specified';
    const parsed = new Date(iso + 'T00:00:00');
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function debounce(fn, wait = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Client-side image compression to lightweight JPEG
  function compressImageFile(file, maxDimension = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Health check for status indicator
  async function checkServerHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
      if (res.ok) {
        el.systemStatus.classList.remove('offline');
        el.systemStatus.querySelector('.status-text').textContent = 'Connected';
      } else {
        throw new Error();
      }
    } catch {
      el.systemStatus.classList.add('offline');
      el.systemStatus.querySelector('.status-text').textContent = 'Offline';
    }
  }

  // API Calls
  async function fetchReports() {
    isFetching = true;
    renderSkeletons();

    try {
      const res = await fetch(`${API_BASE}/reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reports = await res.json();
      isFetching = false;
      render();
      checkServerHealth();
    } catch (err) {
      isFetching = false;
      console.error('Fetch error:', err);
      el.systemStatus.classList.add('offline');
      el.systemStatus.querySelector('.status-text').textContent = 'Offline';
      renderFetchError();
      notify('Unable to reach server. Check local database connection.', 'error');
    }
  }

  async function deleteReport(id) {
    const item = reports.find(r => r.id === id);
    if (!item) return;

    if (!window.confirm(`Permanently remove report for "${item.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      reports = reports.filter(r => r.id !== id);
      render();
      notify(`Removed record for "${item.name}".`);
    } catch (err) {
      console.error('Delete error:', err);
      notify('Could not delete record.', 'error');
    }
  }

  // UI Rendering
  function renderSkeletons() {
    el.emptyState.classList.add('hidden');
    el.grid.classList.remove('hidden');
    el.grid.innerHTML = `
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    `;
    el.resultsCount.textContent = 'Updating...';
  }

  function renderFetchError() {
    el.grid.classList.add('hidden');
    el.emptyState.classList.remove('hidden');
    el.emptyTitle.textContent = 'Server Unreachable';
    el.emptyDesc.textContent = `Could not connect to API at ${API_BASE}. Make sure the server is running on port 3000.`;
    el.emptyResetBtn.textContent = 'Retry Connection';
    el.emptyResetBtn.onclick = () => fetchReports();
  }

  function render() {
    if (isFetching) return;

    const query = el.searchInput.value.trim().toLowerCase();
    const category = el.categorySelect.value;
    const status = el.statusSelect.value;

    const filtered = reports.filter(item => {
      const matchType = activeType === 'all' || item.type === activeType;
      const matchCat = category === 'all' || item.category === category;
      const matchStatus = status === 'all' || item.status === status;
      const matchQuery = !query || [item.name, item.location, item.description, item.category, item.contact, item.claimedBy, item.claimantId]
        .some(val => (val || '').toLowerCase().includes(query));

      return matchType && matchCat && matchStatus && matchQuery;
    });

    // Update stats
    el.statTotal.textContent = reports.length;
    el.statLost.textContent = reports.filter(r => r.type === 'lost' && r.status === 'active').length;
    el.statFound.textContent = reports.filter(r => r.type === 'found' && r.status === 'active').length;
    el.statReturned.textContent = reports.filter(r => r.status === 'returned').length;

    // Reset button visibility
    const isFiltered = activeType !== 'all' || category !== 'all' || status !== 'all' || query.length > 0;
    el.resetFiltersBtn.classList.toggle('hidden', !isFiltered);

    el.resultsCount.textContent = `Showing ${filtered.length} of ${reports.length} records`;

    if (filtered.length === 0) {
      el.grid.classList.add('hidden');
      el.emptyState.classList.remove('hidden');
      el.emptyTitle.textContent = query || isFiltered ? 'No records match your filters' : 'No records logged yet';
      el.emptyDesc.textContent = isFiltered
        ? 'Try clearing active filters or modifying search keywords.'
        : 'Be the first to file a lost or found report for campus facilities.';
      el.emptyResetBtn.textContent = 'Clear filters';
      el.emptyResetBtn.onclick = resetFilters;
      return;
    }

    el.emptyState.classList.add('hidden');
    el.grid.classList.remove('hidden');

    el.grid.innerHTML = filtered.map(item => {
      const isReturned = item.status === 'returned';
      const icon = categoryIcons[item.category] || '📦';
      const hasPhoto = Boolean(item.image && item.image.trim());

      return `
        <article class="item-card ${isReturned ? 'is-returned' : ''}" data-id="${item.id}">
          ${hasPhoto ? `
            <div class="item-card-photo-wrap" data-action="view-photo" data-id="${item.id}" title="Click to view full photo">
              <img class="item-card-photo" src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy">
              <span class="photo-zoom-hint">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Zoom Photo
              </span>
            </div>
          ` : ''}

          <div class="card-header">
            <div class="badges-group">
              <span class="badge badge-${item.type}">${item.type}</span>
              <span class="badge badge-category">${icon} ${escapeHTML(item.category)}</span>
              ${isReturned ? '<span class="badge badge-returned">Claimed & Verified</span>' : ''}
            </div>
            <span class="item-date-tag">${formatDate(item.date)}</span>
          </div>

          <div class="card-body">
            <h2 class="item-title">${escapeHTML(item.name)}</h2>
            <p class="item-description">${escapeHTML(item.description)}</p>

            <div class="item-meta-list">
              <div class="meta-row">
                <svg class="meta-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                  <circle cx="12" cy="9" r="2.5"></circle>
                </svg>
                <span>${escapeHTML(item.location)}</span>
              </div>
            </div>

            ${item.contact ? `
              <div class="item-contact-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <div>
                  <span class="contact-label">${item.type === 'found' ? 'Drop-off Desk / Finder:' : 'Owner Reach Info:'}</span>
                  <span class="contact-val">${escapeHTML(item.contact)}</span>
                </div>
              </div>
            ` : ''}

            ${isReturned ? `
              <div class="claimant-audit-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
                <div style="flex:1;">
                  <span class="audit-title">Ownership Verified & Claimed</span>
                  <span class="audit-detail">Claimed by <strong>${escapeHTML(item.claimedBy || 'Verified Student')}</strong> (ID: <code>${escapeHTML(item.claimantId || 'On Record')}</code>)</span>
                  ${item.claimProof ? `<span class="audit-proof">Verification note: ${escapeHTML(item.claimProof)}</span>` : ''}
                  
                  ${item.claimantPhoto ? `
                    <div class="claimant-photo-thumb-wrap" data-action="view-claimant-photo" data-id="${item.id}" title="View verified claimant ID photo">
                      <img class="claimant-photo-thumb" src="${item.claimantPhoto}" alt="Verified claimant">
                      <span class="claimant-photo-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        View Verification Photo
                      </span>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="card-footer">
            <button class="btn-card match-action" data-action="match" data-id="${item.id}">
              Cross-Match
            </button>
            <div style="display:flex; gap:6px;">
              ${!isReturned ? `
                <button class="btn-card claim-action" data-action="open-claim" data-id="${item.id}">
                  ${item.type === 'found' ? 'Claim (Verify ID)' : 'Mark Claimed'}
                </button>
              ` : ''}
              ${!item.demo ? `
                <button class="btn-card delete-action" data-action="delete" data-id="${item.id}" title="Delete record">
                  Delete
                </button>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function resetFilters() {
    activeType = 'all';
    el.segmentBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.type === 'all'));
    el.searchInput.value = '';
    el.categorySelect.value = 'all';
    el.statusSelect.value = 'all';
    render();
  }

  // Cross-match helper
  function checkCrossMatches(itemId) {
    const target = reports.find(r => r.id === itemId);
    if (!target) return;

    const matches = reports.filter(candidate =>
      candidate.id !== target.id &&
      candidate.type !== target.type &&
      candidate.status === 'active' &&
      candidate.category === target.category
    );

    if (matches.length === 0) {
      notify(`No active ${target.type === 'lost' ? 'found' : 'lost'} logs matching category "${target.category}".`);
      return;
    }

    const locationMatches = matches.filter(m =>
      m.location.toLowerCase().includes(target.location.toLowerCase()) ||
      target.location.toLowerCase().includes(m.location.toLowerCase())
    );

    if (locationMatches.length > 0) {
      notify(`Potential location match: "${locationMatches[0].name}" at ${locationMatches[0].location}`, 'success');
    } else {
      notify(`Category match: "${matches[0].name}" reported at ${matches[0].location}.`);
    }
  }

  // Lightbox handlers
  function openLightbox(imageUrl, caption) {
    if (!imageUrl) return;
    el.lightboxImg.src = imageUrl;
    el.lightboxCaption.textContent = caption || 'Photo View';
    el.lightboxModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    el.lightboxModal.classList.add('hidden');
    el.lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  // Report Modal Handlers
  function openModal(defaultType = 'lost') {
    el.itemType.value = defaultType;
    el.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    clearValidationErrors();
    resetPhotoUpload();

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    el.itemDate.value = `${yyyy}-${mm}-${dd}`;

    setTimeout(() => el.itemName.focus(), 60);
  }

  function closeModal() {
    el.modal.classList.add('hidden');
    document.body.style.overflow = '';
    el.modalForm.reset();
    resetPhotoUpload();
    clearValidationErrors();
  }

  function resetPhotoUpload() {
    el.itemPhotoFile.value = '';
    el.itemPhotoData.value = '';
    el.photoPreviewImg.src = '';
    el.photoPreviewBox.classList.add('hidden');
    el.photoPrompt.classList.remove('hidden');
  }

  function resetClaimPhotoUpload() {
    el.claimantPhotoFile.value = '';
    el.claimantPhotoData.value = '';
    el.claimPhotoPreviewImg.src = '';
    el.claimPhotoPreviewBox.classList.add('hidden');
    el.claimPhotoPrompt.classList.remove('hidden');
  }

  function clearValidationErrors() {
    el.modalForm.querySelectorAll('.input-error').forEach(input => input.classList.remove('input-error'));
    el.modalForm.querySelectorAll('.field-error').forEach(span => span.textContent = '');
  }

  function validateForm() {
    clearValidationErrors();
    let valid = true;

    if (!el.itemCategory.value) {
      el.itemCategory.classList.add('input-error');
      document.getElementById('categoryError').textContent = 'Please choose a category.';
      valid = false;
    }
    if (!el.itemName.value.trim()) {
      el.itemName.classList.add('input-error');
      document.getElementById('nameError').textContent = 'Item name is required.';
      valid = false;
    }
    if (!el.itemLocation.value.trim()) {
      el.itemLocation.classList.add('input-error');
      document.getElementById('locationError').textContent = 'Specify where this was lost or found.';
      valid = false;
    }
    if (!el.itemDate.value) {
      el.itemDate.classList.add('input-error');
      document.getElementById('dateError').textContent = 'Date is required.';
      valid = false;
    }
    if (!el.itemContact.value.trim()) {
      el.itemContact.classList.add('input-error');
      document.getElementById('contactError').textContent = 'Please provide contact info or a campus drop-off desk.';
      valid = false;
    }
    if (!el.itemDescription.value.trim()) {
      el.itemDescription.classList.add('input-error');
      document.getElementById('descError').textContent = 'Add a short description or identifying details.';
      valid = false;
    }

    return valid;
  }

  // Item Photo upload events
  el.photoDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#removePhotoBtn')) return;
    el.itemPhotoFile.click();
  });

  el.photoDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.photoDropzone.style.borderColor = 'var(--brand-primary)';
  });

  el.photoDropzone.addEventListener('dragleave', () => {
    el.photoDropzone.style.borderColor = '';
  });

  el.photoDropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.photoDropzone.style.borderColor = '';
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handlePhotoSelected(file);
    }
  });

  el.itemPhotoFile.addEventListener('change', () => {
    const file = el.itemPhotoFile.files?.[0];
    if (file) handlePhotoSelected(file);
  });

  el.removePhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPhotoUpload();
  });

  async function handlePhotoSelected(file) {
    try {
      notify('Compressing photo...', 'info');
      const dataUrl = await compressImageFile(file);
      el.itemPhotoData.value = dataUrl;
      el.photoPreviewImg.src = dataUrl;
      el.photoPrompt.classList.add('hidden');
      el.photoPreviewBox.classList.remove('hidden');
      notify('Photo attached.', 'info');
    } catch (err) {
      console.error('Photo read error:', err);
      notify('Could not process image file.', 'error');
    }
  }

  // Claimant Verification Photo upload events
  el.claimPhotoDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#removeClaimPhotoBtn')) return;
    el.claimantPhotoFile.click();
  });

  el.claimPhotoDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.claimPhotoDropzone.style.borderColor = 'var(--brand-primary)';
  });

  el.claimPhotoDropzone.addEventListener('dragleave', () => {
    el.claimPhotoDropzone.style.borderColor = '';
  });

  el.claimPhotoDropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.claimPhotoDropzone.style.borderColor = '';
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleClaimPhotoSelected(file);
    }
  });

  el.claimantPhotoFile.addEventListener('change', () => {
    const file = el.claimantPhotoFile.files?.[0];
    if (file) handleClaimPhotoSelected(file);
  });

  el.removeClaimPhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetClaimPhotoUpload();
  });

  async function handleClaimPhotoSelected(file) {
    try {
      notify('Compressing verification photo...', 'info');
      const dataUrl = await compressImageFile(file);
      el.claimantPhotoData.value = dataUrl;
      el.claimPhotoPreviewImg.src = dataUrl;
      el.claimPhotoPrompt.classList.add('hidden');
      el.claimPhotoPreviewBox.classList.remove('hidden');
      notify('Claimant verification photo attached.', 'info');
    } catch (err) {
      console.error('Claimant photo error:', err);
      notify('Could not process photo.', 'error');
    }
  }

  // Claim Modal Handlers
  function openClaimModal(itemId) {
    const item = reports.find(r => r.id === itemId);
    if (!item) return;

    el.claimItemId.value = item.id;
    el.claimItemSummary.innerHTML = `
      <span class="claim-summary-title">${escapeHTML(item.name)} (${item.type === 'found' ? 'Found Item' : 'Lost Report'})</span>
      <span class="claim-summary-meta">Location: ${escapeHTML(item.location)} · Reported: ${formatDate(item.date)}</span>
    `;

    clearClaimValidationErrors();
    resetClaimPhotoUpload();
    el.claimModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => el.claimantName.focus(), 60);
  }

  function closeClaimModal() {
    el.claimModal.classList.add('hidden');
    document.body.style.overflow = '';
    el.claimForm.reset();
    resetClaimPhotoUpload();
    clearClaimValidationErrors();
  }

  function clearClaimValidationErrors() {
    el.claimForm.querySelectorAll('.input-error').forEach(input => input.classList.remove('input-error'));
    el.claimForm.querySelectorAll('.field-error').forEach(span => span.textContent = '');
  }

  function validateClaimForm() {
    clearClaimValidationErrors();
    let valid = true;

    if (!el.claimantName.value.trim()) {
      el.claimantName.classList.add('input-error');
      document.getElementById('claimNameError').textContent = 'Your full name is required.';
      valid = false;
    }
    if (!el.claimantId.value.trim()) {
      el.claimantId.classList.add('input-error');
      document.getElementById('claimIdError').textContent = 'College ID Card / Roll number is mandatory.';
      valid = false;
    }
    if (!el.claimantContact.value.trim()) {
      el.claimantContact.classList.add('input-error');
      document.getElementById('claimContactError').textContent = 'Contact email or phone is required.';
      valid = false;
    }
    if (!el.claimProof.value.trim()) {
      el.claimProof.classList.add('input-error');
      document.getElementById('claimProofError').textContent = 'Please provide an identifying feature to verify ownership.';
      valid = false;
    }

    return valid;
  }

  // Event Listeners
  el.openModalBtn.addEventListener('click', () => openModal('lost'));
  el.emptyReportBtn.addEventListener('click', () => openModal('lost'));
  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelModalBtn.addEventListener('click', closeModal);

  el.modal.addEventListener('click', (e) => {
    if (e.target === el.modal) closeModal();
  });

  el.closeClaimModalBtn.addEventListener('click', closeClaimModal);
  el.cancelClaimModalBtn.addEventListener('click', closeClaimModal);
  el.claimModal.addEventListener('click', (e) => {
    if (e.target === el.claimModal) closeClaimModal();
  });

  el.closeLightboxBtn.addEventListener('click', closeLightbox);
  el.lightboxModal.addEventListener('click', (e) => {
    if (e.target === el.lightboxModal) closeLightbox();
  });

  // Hotkeys: '/' to search, 'Escape' to dismiss modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.lightboxModal.classList.contains('hidden')) closeLightbox();
      if (!el.modal.classList.contains('hidden')) closeModal();
      if (!el.claimModal.classList.contains('hidden')) closeClaimModal();
      return;
    }
    if (e.key === '/' && document.activeElement !== el.searchInput && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      el.searchInput.focus();
    }
  });

  // Segmented Type Buttons
  el.segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.type;
      render();
    });
  });

  // Filter & Search bindings
  el.searchInput.addEventListener('input', debounce(() => render(), 150));
  el.categorySelect.addEventListener('change', render);
  el.statusSelect.addEventListener('change', render);
  el.resetFiltersBtn.addEventListener('click', resetFilters);

  // Grid Action Delegation
  el.grid.addEventListener('click', (e) => {
    const photoTarget = e.target.closest('[data-action="view-photo"]');
    if (photoTarget) {
      const item = reports.find(r => r.id === photoTarget.dataset.id);
      if (item && item.image) {
        openLightbox(item.image, `${item.name} (${item.type.toUpperCase()}) — ${item.location}`);
      }
      return;
    }

    const claimantPhotoTarget = e.target.closest('[data-action="view-claimant-photo"]');
    if (claimantPhotoTarget) {
      const item = reports.find(r => r.id === claimantPhotoTarget.dataset.id);
      if (item && item.claimantPhoto) {
        openLightbox(item.claimantPhoto, `Verified Claimant Photo: ${item.claimedBy} (ID: ${item.claimantId})`);
      }
      return;
    }

    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'open-claim') openClaimModal(id);
    else if (action === 'delete') deleteReport(id);
    else if (action === 'match') checkCrossMatches(id);
  });

  // Submit New Report
  el.modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      type: el.itemType.value,
      category: el.itemCategory.value,
      name: el.itemName.value.trim(),
      location: el.itemLocation.value.trim(),
      date: el.itemDate.value,
      contact: el.itemContact.value.trim(),
      image: el.itemPhotoData.value,
      description: el.itemDescription.value.trim()
    };

    el.submitBtn.disabled = true;
    el.submitBtn.textContent = 'Saving...';

    try {
      const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded with ${res.status}`);
      }

      const created = await res.json();
      reports.unshift(created);

      closeModal();
      resetFilters();
      notify(`Record created for "${created.name}".`, 'success');
    } catch (err) {
      console.error('Submission error:', err);
      notify(`Save failed: ${err.message}`, 'error');
    } finally {
      el.submitBtn.disabled = false;
      el.submitBtn.textContent = 'Submit Record';
    }
  });

  // Submit Claim & Identity Verification
  el.claimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateClaimForm()) return;

    const itemId = el.claimItemId.value;
    const item = reports.find(r => r.id === itemId);
    if (!item) return;

    const payload = {
      claimedBy: el.claimantName.value.trim(),
      claimantId: el.claimantId.value.trim(),
      claimantContact: el.claimantContact.value.trim(),
      claimProof: el.claimProof.value.trim(),
      claimantPhoto: el.claimantPhotoData.value
    };

    el.submitClaimBtn.disabled = true;
    el.submitClaimBtn.textContent = 'Verifying ID...';

    try {
      const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(itemId)}/return`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }

      const updated = await res.json();
      Object.assign(item, updated);

      closeClaimModal();
      render();
      notify(`Ownership verified for "${item.name}" (ID: ${updated.claimantId}).`, 'success');
    } catch (err) {
      console.error('Claim error:', err);
      notify(`Claim verification failed: ${err.message}`, 'error');
    } finally {
      el.submitClaimBtn.disabled = false;
      el.submitClaimBtn.textContent = 'Confirm ID & Claim Item';
    }
  });

  // URL view helper for screenshots / direct navigation
  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view');
  if (requestedView) {
    setTimeout(() => {
      if (requestedView === 'report') {
        openModal();
      } else if (requestedView === 'claim') {
        const target = reports.find(r => r.status === 'open') || reports[0];
        if (target) openClaimModal(target.id);
      } else if (requestedView === 'returned') {
        const sel = document.getElementById('statusSelect');
        if (sel) {
          sel.value = 'returned';
          sel.dispatchEvent(new Event('change'));
        }
      } else if (requestedView === 'lost') {
        const lostBtn = document.querySelector('[data-type="lost"]');
        if (lostBtn) lostBtn.click();
      }
    }, 700);
  }

  // Boot
  fetchReports();
})();
