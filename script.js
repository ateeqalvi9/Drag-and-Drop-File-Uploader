const STORAGE_KEY = 'premiumUploaderState';
const THEME_KEY = 'premiumUploaderTheme';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];

const elements = {
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  errorCard: document.getElementById('errorCard'),
  previewContent: document.getElementById('previewContent'),
  emptyState: document.getElementById('emptyState'),
  previewImage: document.getElementById('previewImage'),
  metaName: document.getElementById('metaName'),
  metaSize: document.getElementById('metaSize'),
  metaType: document.getElementById('metaType'),
  metaResolution: document.getElementById('metaResolution'),
  metaUploadTime: document.getElementById('metaUploadTime'),
  metaStatus: document.getElementById('metaStatus'),
  uploadStatus: document.getElementById('uploadStatus'),
  uploadPercent: document.getElementById('uploadPercent'),
  uploadSpeed: document.getElementById('uploadSpeed'),
  progressFill: document.getElementById('progressFill'),
  removeBtn: document.getElementById('removeBtn'),
  uploadAnotherBtn: document.getElementById('uploadAnotherBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  copyNameBtn: document.getElementById('copyNameBtn'),
  zoomBtn: document.getElementById('zoomBtn'),
  restoredBadge: document.getElementById('restoredBadge'),
  statCount: document.getElementById('statCount'),
  statSize: document.getElementById('statSize'),
  statLast: document.getElementById('statLast'),
  galleryList: document.getElementById('galleryList'),
  themeToggle: document.getElementById('themeToggle'),
  toastContainer: document.getElementById('toastContainer'),
  zoomModal: document.getElementById('zoomModal'),
  modalImage: document.getElementById('modalImage'),
  closeModalBtn: document.getElementById('closeModalBtn')
};

let currentImage = null;
let uploadHistory = [];
let progressTimer = null;
let dragCounter = 0;

function init() {
  bindEvents();
  const theme = localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(theme);
  restoreFromStorage();
}

function bindEvents() {
  elements.dropZone.addEventListener('click', () => elements.fileInput.click());
  elements.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
  elements.fileInput.addEventListener('change', (event) => handleFiles(Array.from(event.target.files || [])));

  elements.dropZone.addEventListener('dragenter', handleDragEnter);
  elements.dropZone.addEventListener('dragover', handleDragOver);
  elements.dropZone.addEventListener('dragleave', handleDragLeave);
  elements.dropZone.addEventListener('drop', handleDrop);

  elements.removeBtn.addEventListener('click', removeImage);
  elements.uploadAnotherBtn.addEventListener('click', () => resetUploader());
  elements.downloadBtn.addEventListener('click', downloadCurrentImage);
  elements.copyNameBtn.addEventListener('click', copyCurrentName);
  elements.zoomBtn.addEventListener('click', openZoomModal);
  elements.closeModalBtn.addEventListener('click', closeZoomModal);
  elements.zoomModal.addEventListener('click', closeZoomModal);
  elements.themeToggle.addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeZoomModal();
    }
  });

  document.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', createRipple);
  });
}

function createRipple(event) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.1;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  ripple.className = 'ripple';
  button.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 520);
}

function handleDragEnter(event) {
  event.preventDefault();
  dragCounter += 1;
  elements.dropZone.classList.add('drag-over');
}

function handleDragOver(event) {
  event.preventDefault();
  elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(event) {
  event.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) {
    elements.dropZone.classList.remove('drag-over');
  }
}

function handleDrop(event) {
  event.preventDefault();
  dragCounter = 0;
  elements.dropZone.classList.remove('drag-over');
  const files = Array.from(event.dataTransfer?.files || []);
  handleFiles(files);
}

function handleFiles(files) {
  clearError();
  if (files.length === 0) {
    showError('No file selected. Please choose an image.');
    return;
  }

  if (files.length > 1) {
    showError('Only one image can be uploaded at a time.');
    return;
  }

  const file = files[0];
  const validation = validateFile(file);
  if (!validation.valid) {
    showError(validation.message);
    return;
  }

  elements.dropZone.classList.add('is-uploading');
  readFile(file);
}

function validateFile(file) {
  if (!file) {
    return { valid: false, message: 'No file selected. Please choose an image.' };
  }

  const ext = `.${file.name.split('.').pop().toLowerCase()}`;
  const isSupportedMime = ALLOWED_TYPES.includes(file.type);
  const isSupportedExt = ALLOWED_EXTENSIONS.includes(ext);

  if (!isSupportedMime && !isSupportedExt) {
    return { valid: false, message: 'Unsupported file type. Please upload JPG, JPEG, PNG, or GIF.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: 'The selected image is too large. Please keep it under 5 MB.' };
  }

  return { valid: true };
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (typeof dataUrl !== 'string') {
      showError('The image could not be read. Please try another file.');
      return;
    }

    const image = new Image();
    image.onload = () => {
      const imageMeta = {
        dataUrl,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        size: file.size,
        type: file.type || 'image/jpeg',
        width: image.width,
        height: image.height
      };
      displayPreview(imageMeta);
      simulateUpload(imageMeta);
    };
    image.onerror = () => {
      showError('The file appears to be corrupt or unreadable.');
      elements.dropZone.classList.remove('is-uploading');
    };
    image.src = dataUrl;
  };

  reader.onerror = () => {
    showError('The file could not be read. Please try again.');
    elements.dropZone.classList.remove('is-uploading');
  };

  reader.readAsDataURL(file);
}

function displayPreview(meta) {
  elements.emptyState.classList.add('hidden');
  elements.previewContent.classList.remove('hidden');
  elements.previewImage.src = meta.dataUrl;
  elements.previewImage.alt = `Preview of ${meta.fileName}`;
  elements.metaName.textContent = meta.fileName;
  elements.metaSize.textContent = formatBytes(meta.size);
  elements.metaType.textContent = (meta.type || 'image/jpeg').split('/')[1]?.toUpperCase() || 'JPEG';
  elements.metaResolution.textContent = `${meta.width} × ${meta.height}`;
  elements.metaUploadTime.textContent = formatDate(meta.uploadedAt);
  elements.metaStatus.textContent = 'Preview ready';
  elements.restoredBadge.classList.add('hidden');
  elements.modalImage.src = meta.dataUrl;
  elements.modalImage.alt = `Fullscreen preview of ${meta.fileName}`;
  elements.removeBtn.disabled = false;
  elements.downloadBtn.disabled = false;
  elements.copyNameBtn.disabled = false;
  elements.zoomBtn.disabled = false;
  elements.uploadAnotherBtn.disabled = true;
}

function simulateUpload(meta) {
  clearProgressInterval();
  elements.uploadStatus.textContent = 'Uploading...';
  elements.uploadPercent.textContent = '0%';
  elements.uploadSpeed.textContent = 'Preparing transfer…';
  elements.progressFill.style.width = '0%';
  elements.metaStatus.textContent = 'Uploading';

  let progress = 0;
  progressTimer = window.setInterval(() => {
    const increment = Math.floor(Math.random() * 16) + 7;
    progress = Math.min(progress + increment, 100);
    updateProgress(progress);

    if (progress >= 100) {
      completeUpload(meta);
    }
  }, 180);
}

function updateProgress(progress) {
  const percent = Math.max(0, Math.min(100, progress));
  elements.progressFill.style.width = `${percent}%`;
  elements.uploadPercent.textContent = `${percent}%`;
  elements.uploadStatus.textContent = percent < 100 ? 'Uploading...' : 'Upload Complete ✓';
  elements.uploadSpeed.textContent = percent < 100 ? `${(1.2 + percent / 120).toFixed(1)} MB/s` : 'Transfer finished';
}

function completeUpload(meta) {
  clearProgressInterval();
  currentImage = meta;
  updateProgress(100);
  elements.metaStatus.textContent = 'Uploaded';
  elements.uploadStatus.textContent = 'Upload Complete ✓';
  elements.uploadAnotherBtn.disabled = false;
  elements.dropZone.classList.remove('is-uploading');
  saveToStorage(meta);
  showToast('Image uploaded successfully');
  celebrate();
}

function saveToStorage(meta) {
  const nextHistory = [meta, ...uploadHistory.filter((item) => item.fileName !== meta.fileName)].slice(0, 6);
  uploadHistory = nextHistory;
  const state = { currentImage: meta, history: nextHistory };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateStats();
}

function restoreFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      resetUploader();
      return;
    }

    const parsed = JSON.parse(saved);
    if (!parsed?.currentImage) {
      resetUploader();
      return;
    }

    currentImage = parsed.currentImage;
    uploadHistory = parsed.history || [];
    displayPreview(parsed.currentImage);
    elements.uploadStatus.textContent = 'Restored from previous session';
    elements.uploadPercent.textContent = '100%';
    elements.progressFill.style.width = '100%';
    elements.uploadSpeed.textContent = 'Restored';
    elements.metaStatus.textContent = 'Restored';
    elements.restoredBadge.classList.remove('hidden');
    elements.uploadAnotherBtn.disabled = false;
    elements.removeBtn.disabled = false;
    elements.downloadBtn.disabled = false;
    elements.copyNameBtn.disabled = false;
    elements.zoomBtn.disabled = false;
    updateStats();
    showToast('Image restored from previous session');
  } catch (error) {
    console.error('Unable to restore uploader state', error);
    resetUploader();
  }
}

function removeImage() {
  currentImage = null;
  uploadHistory = [];
  localStorage.removeItem(STORAGE_KEY);
  resetUploader();
  showToast('Image removed');
}

function resetUploader() {
  clearProgressInterval();
  elements.dropZone.classList.remove('drag-over', 'is-uploading');
  elements.previewContent.classList.add('hidden');
  elements.emptyState.classList.remove('hidden');
  elements.previewImage.removeAttribute('src');
  elements.previewImage.alt = 'Upload preview';
  elements.metaName.textContent = '—';
  elements.metaSize.textContent = '—';
  elements.metaType.textContent = '—';
  elements.metaResolution.textContent = '—';
  elements.metaUploadTime.textContent = '—';
  elements.metaStatus.textContent = 'Ready';
  elements.uploadStatus.textContent = 'Ready';
  elements.uploadPercent.textContent = '0%';
  elements.uploadSpeed.textContent = 'Waiting for upload…';
  elements.progressFill.style.width = '0%';
  elements.fileInput.value = '';
  elements.restoredBadge.classList.add('hidden');
  elements.removeBtn.disabled = true;
  elements.downloadBtn.disabled = true;
  elements.copyNameBtn.disabled = true;
  elements.zoomBtn.disabled = true;
  elements.uploadAnotherBtn.disabled = true;
  elements.modalImage.removeAttribute('src');
  updateStats();
}

function updateStats() {
  elements.statCount.textContent = String(uploadHistory.length);
  const totalSize = uploadHistory.reduce((sum, item) => sum + item.size, 0);
  elements.statSize.textContent = formatBytes(totalSize);
  elements.statLast.textContent = uploadHistory[0]?.uploadedAt ? formatDate(uploadHistory[0].uploadedAt) : '—';

  if (uploadHistory.length === 0) {
    elements.galleryList.innerHTML = '<p class="empty-state__hint">No recent uploads yet.</p>';
    return;
  }

  elements.galleryList.innerHTML = uploadHistory.map((item) => `
    <button class="gallery-item" type="button" data-file="${item.fileName}">
      <img class="gallery-item__thumb" src="${item.dataUrl}" alt="${item.fileName}" />
      <span>
        <span class="gallery-item__name">${escapeHtml(item.fileName)}</span>
        <span class="gallery-item__time">${formatDate(item.uploadedAt)}</span>
      </span>
    </button>
  `).join('');

  elements.galleryList.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => {
      const match = uploadHistory.find((entry) => entry.fileName === item.dataset.file);
      if (match) {
        displayPreview(match);
        elements.uploadStatus.textContent = 'Restored from gallery';
        elements.uploadPercent.textContent = '100%';
        elements.progressFill.style.width = '100%';
        elements.uploadSpeed.textContent = 'Ready';
        elements.metaStatus.textContent = 'Loaded';
        elements.restoredBadge.classList.remove('hidden');
        showToast('Image loaded from gallery');
      }
    });
  });
}

function downloadCurrentImage() {
  if (!currentImage) {
    return;
  }
  const link = document.createElement('a');
  link.href = currentImage.dataUrl;
  link.download = currentImage.fileName;
  link.click();
  showToast('Image download started');
}

function copyCurrentName() {
  if (!currentImage) {
    return;
  }
  navigator.clipboard.writeText(currentImage.fileName).then(() => showToast('Image name copied')).catch(() => showToast('Copy failed'));
}

function openZoomModal() {
  if (!currentImage) {
    return;
  }
  elements.zoomModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeZoomModal() {
  elements.zoomModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function toggleTheme() {
  const nextTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  elements.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  elements.themeToggle.querySelector('.theme-toggle__icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  elements.themeToggle.querySelector('.theme-toggle__label').textContent = theme === 'dark' ? 'Light' : 'Dark';
  localStorage.setItem(THEME_KEY, theme);
}

function showError(message) {
  elements.errorCard.innerHTML = `
    <span aria-hidden="true">⚠️</span>
    <div>
      <strong>Upload failed</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
  elements.errorCard.classList.remove('hidden');
  window.setTimeout(() => {
    elements.errorCard.classList.add('hidden');
  }, 4200);
}

function clearError() {
  elements.errorCard.classList.add('hidden');
  elements.errorCard.innerHTML = '';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2600);
}

function celebrate() {
  const colors = ['#76b9ff', '#7f5cff', '#47d6a0', '#ff6b7a'];
  for (let i = 0; i < 16; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty('--x', `${(Math.random() - 0.5) * 240}px`);
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1300);
  }
}

function clearProgressInterval() {
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 KB';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.addEventListener('DOMContentLoaded', init);
