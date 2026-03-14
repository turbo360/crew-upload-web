/* Turbo Upload Portal - Client Logic */
(function () {
  'use strict';

  // State
  let token = null;
  let sessionId = null;
  let sessionName = '';
  let sessionProject = '';
  let selectedFiles = [];
  let activeUploads = new Map(); // file index -> tus.Upload
  let completedCount = 0;
  let failedCount = 0;
  let uploading = false;

  // DOM refs
  const screenPin = document.getElementById('screen-pin');
  const screenDetails = document.getElementById('screen-details');
  const screenUpload = document.getElementById('screen-upload');
  const pinForm = document.getElementById('pin-form');
  const pinInputs = document.querySelectorAll('.pin-digit');
  const pinError = document.getElementById('pin-error');
  const pinSubmit = document.getElementById('pin-submit');
  const detailsForm = document.getElementById('details-form');
  const inputName = document.getElementById('input-name');
  const inputProject = document.getElementById('input-project');
  const detailsError = document.getElementById('details-error');
  const detailsSubmit = document.getElementById('details-submit');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const uploadBtn = document.getElementById('upload-btn');
  const uploadBtnCount = document.getElementById('upload-btn-count');
  const overallProgress = document.getElementById('overall-progress');
  const overallPercent = document.getElementById('overall-percent');
  const overallBar = document.getElementById('overall-bar');
  const filesCount = document.getElementById('files-count');
  const uploadSpeed = document.getElementById('upload-speed');
  const uploadComplete = document.getElementById('upload-complete');
  const completeSummary = document.getElementById('complete-summary');
  const uploadMoreBtn = document.getElementById('upload-more-btn');
  const uploadSessionInfo = document.getElementById('upload-session-info');

  // ── PIN Screen ──

  pinInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val) {
        e.target.classList.add('filled');
        if (idx < pinInputs.length - 1) pinInputs[idx + 1].focus();
      } else {
        e.target.classList.remove('filled');
      }
      updatePinButton();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        pinInputs[idx - 1].focus();
        pinInputs[idx - 1].value = '';
        pinInputs[idx - 1].classList.remove('filled');
        updatePinButton();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      pasted.split('').forEach((ch, i) => {
        if (pinInputs[i]) {
          pinInputs[i].value = ch;
          pinInputs[i].classList.add('filled');
        }
      });
      if (pasted.length > 0) {
        const focusIdx = Math.min(pasted.length, pinInputs.length - 1);
        pinInputs[focusIdx].focus();
      }
      updatePinButton();
    });
  });

  function updatePinButton() {
    const pin = getPin();
    pinSubmit.disabled = pin.length !== 4;
  }

  function getPin() {
    return Array.from(pinInputs).map(i => i.value).join('');
  }

  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = getPin();
    if (pin.length !== 4) return;

    pinSubmit.disabled = true;
    pinSubmit.innerHTML = '<span class="spinner"></span>';
    pinError.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid PIN');
      }

      token = data.token;
      showScreen('details');
    } catch (err) {
      pinError.textContent = err.message;
      pinError.classList.remove('hidden');
      pinInputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
      pinInputs[0].focus();
    } finally {
      pinSubmit.disabled = false;
      pinSubmit.textContent = 'Continue';
      updatePinButton();
    }
  });

  // ── Details Screen ──

  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = inputName.value.trim();
    const project = inputProject.value.trim();
    if (!name || !project) return;

    detailsSubmit.disabled = true;
    detailsSubmit.innerHTML = '<span class="spinner"></span>';
    detailsError.classList.add('hidden');

    try {
      const res = await fetch('/api/session/web-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ name, projectName: project })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      sessionId = data.session.id;
      sessionName = name;
      sessionProject = project;
      uploadSessionInfo.textContent = project + ' — ' + name;
      showScreen('upload');
    } catch (err) {
      detailsError.textContent = err.message;
      detailsError.classList.remove('hidden');
    } finally {
      detailsSubmit.disabled = false;
      detailsSubmit.textContent = 'Continue to Upload';
    }
  });

  // ── Upload Screen ──

  // Drag and drop
  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  });

  dropZone.addEventListener('click', () => {
    if (!uploading) fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (uploading) return;
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  function addFiles(files) {
    files.forEach(f => {
      // Avoid duplicates by name+size
      const exists = selectedFiles.some(s => s.name === f.name && s.size === f.size);
      if (!exists) selectedFiles.push(f);
    });
    renderFileList();
  }

  function removeFile(idx) {
    if (uploading) return;
    selectedFiles.splice(idx, 1);
    renderFileList();
  }

  function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((f, idx) => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.id = 'file-item-' + idx;
      div.innerHTML =
        '<span class="file-name" title="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + '</span>' +
        '<span class="file-size">' + formatBytes(f.size) + '</span>' +
        '<div class="file-progress" id="file-progress-' + idx + '"></div>' +
        (uploading ? '' : '<button class="file-remove" data-idx="' + idx + '">&times;</button>');
      fileList.appendChild(div);
    });

    // Bind remove buttons
    fileList.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(parseInt(btn.dataset.idx));
      });
    });

    if (selectedFiles.length > 0 && !uploading) {
      uploadBtn.classList.remove('hidden');
      uploadBtnCount.textContent = selectedFiles.length;
      dropZone.classList.add('has-files');
    } else if (selectedFiles.length === 0) {
      uploadBtn.classList.add('hidden');
      dropZone.classList.remove('has-files');
    }
  }

  // Upload button
  uploadBtn.addEventListener('click', startUpload);

  async function startUpload() {
    if (selectedFiles.length === 0 || uploading) return;
    uploading = true;
    completedCount = 0;
    failedCount = 0;

    uploadBtn.classList.add('hidden');
    overallProgress.classList.remove('hidden');
    dropZone.style.pointerEvents = 'none';
    dropZone.style.opacity = '0.5';

    // Remove all remove buttons
    fileList.querySelectorAll('.file-remove').forEach(b => b.remove());

    const totalFiles = selectedFiles.length;
    const totalBytes = selectedFiles.reduce((s, f) => s + f.size, 0);
    filesCount.textContent = '0 / ' + totalFiles + ' files';

    // Register and start uploads
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        // Register upload with server
        const regRes = await fetch('/api/session/' + sessionId + '/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream'
          })
        });

        if (!regRes.ok) {
          markFileFailed(i, 'Registration failed');
          continue;
        }

        const regData = await regRes.json();

        // Start TUS upload
        startTusUpload(i, file, regData.upload.id);
      } catch (err) {
        markFileFailed(i, err.message);
      }
    }
  }

  function startTusUpload(idx, file, uploadId) {
    const upload = new tus.Upload(file, {
      endpoint: '/files',
      headers: { 'Authorization': 'Bearer ' + token },
      metadata: {
        sessionId: sessionId,
        filename: file.name,
        originalPath: file.name
      },
      chunkSize: 10 * 1024 * 1024, // 10MB
      retryDelays: [0, 1000, 3000, 5000],
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = Math.round((bytesUploaded / bytesTotal) * 100);
        updateFileProgress(idx, pct);
        updateOverallProgress();
      },
      onSuccess: () => {
        // Update upload record on server
        fetch('/api/session/' + sessionId + '/upload/' + uploadId, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            tusUploadId: upload.url ? upload.url.split('/').pop() : null,
            status: 'completed',
            bytesUploaded: file.size,
            progress: 100
          })
        }).catch(() => {});

        markFileComplete(idx);
        checkAllDone();
      },
      onError: (error) => {
        // Update server
        fetch('/api/session/' + sessionId + '/upload/' + uploadId, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            status: 'failed',
            errorMessage: error.message || 'Upload failed'
          })
        }).catch(() => {});

        markFileFailed(idx, error.message);
        checkAllDone();
      }
    });

    activeUploads.set(idx, upload);
    upload.start();

    // Show spinner initially
    const progressEl = document.getElementById('file-progress-' + idx);
    if (progressEl) {
      progressEl.innerHTML = '<span class="spinner"></span>';
    }
  }

  function updateFileProgress(idx, pct) {
    const progressEl = document.getElementById('file-progress-' + idx);
    if (progressEl) {
      progressEl.innerHTML =
        '<div class="progress-bar-bg" style="height:4px">' +
        '<div class="progress-bar-fill" style="width:' + pct + '%"></div>' +
        '</div>';
    }
  }

  function markFileComplete(idx) {
    completedCount++;
    const progressEl = document.getElementById('file-progress-' + idx);
    if (progressEl) {
      progressEl.innerHTML = '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    }
    activeUploads.delete(idx);
  }

  function markFileFailed(idx, msg) {
    failedCount++;
    const progressEl = document.getElementById('file-progress-' + idx);
    if (progressEl) {
      progressEl.innerHTML = '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="' + escapeHtml(msg) + '"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
    }
    activeUploads.delete(idx);
  }

  function updateOverallProgress() {
    const totalBytes = selectedFiles.reduce((s, f) => s + f.size, 0);
    let uploadedBytes = 0;

    selectedFiles.forEach((f, idx) => {
      const upload = activeUploads.get(idx);
      if (upload && upload._offset !== undefined) {
        uploadedBytes += upload._offset;
      }
      // Completed files
      const progressEl = document.getElementById('file-progress-' + idx);
      if (progressEl && progressEl.querySelector('.text-green-500')) {
        uploadedBytes += f.size;
      }
    });

    // Simpler calculation: use completed count + active progress
    const done = completedCount + failedCount;
    const total = selectedFiles.length;
    const pct = total > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

    overallPercent.textContent = pct + '%';
    overallBar.style.width = pct + '%';
    filesCount.textContent = completedCount + ' / ' + total + ' files';

    if (done === total) {
      overallBar.classList.add('complete');
    }
  }

  function checkAllDone() {
    const done = completedCount + failedCount;
    if (done < selectedFiles.length) return;

    // Mark session complete
    fetch('/api/session/' + sessionId, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ status: 'completed' })
    }).catch(() => {});

    // Show complete state
    updateOverallProgress();

    let summary = completedCount + ' file' + (completedCount !== 1 ? 's' : '') + ' uploaded successfully';
    if (failedCount > 0) {
      summary += ', ' + failedCount + ' failed';
    }
    completeSummary.textContent = summary;
    uploadComplete.classList.remove('hidden');
    uploading = false;
  }

  // Upload more button
  uploadMoreBtn.addEventListener('click', () => {
    // Create a new session for more uploads
    selectedFiles = [];
    activeUploads.clear();
    completedCount = 0;
    failedCount = 0;
    uploading = false;

    fileList.innerHTML = '';
    overallProgress.classList.add('hidden');
    overallPercent.textContent = '0%';
    overallBar.style.width = '0%';
    overallBar.classList.remove('complete');
    uploadComplete.classList.add('hidden');
    uploadBtn.classList.add('hidden');
    dropZone.style.pointerEvents = '';
    dropZone.style.opacity = '';
    dropZone.classList.remove('has-files');

    // Go back to details to create a new session
    showScreen('details');
  });

  // ── Screen Navigation ──

  function showScreen(name) {
    screenPin.classList.add('hidden');
    screenDetails.classList.add('hidden');
    screenUpload.classList.add('hidden');

    if (name === 'pin') screenPin.classList.remove('hidden');
    if (name === 'details') {
      screenDetails.classList.remove('hidden');
      inputName.focus();
    }
    if (name === 'upload') screenUpload.classList.remove('hidden');
  }

  // ── Beforeunload Warning ──

  window.addEventListener('beforeunload', (e) => {
    if (uploading && activeUploads.size > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ── Utilities ──

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  pinInputs[0].focus();
})();
