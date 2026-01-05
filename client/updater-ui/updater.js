/**
 * KMTI FMS - Updater Window JavaScript
 * 
 * Responsibilities:
 * - Listen for update status from main process
 * - Update UI based on status changes
 * - Handle user interactions (install, cancel)
 * - Provide smooth transitions and animations
 */

// DOM Elements
const elements = {
  status: document.getElementById('status'),
  spinner: document.getElementById('spinner'),
  progressContainer: document.getElementById('progressContainer'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  progressDetails: document.getElementById('progressDetails'),
  buttons: document.getElementById('buttons'),
  installBtn: document.getElementById('installBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  errorMessage: document.getElementById('errorMessage')
};

// State
let currentStatus = null;

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted string (e.g., "1.23 MB")
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format download speed
 * @param {number} bytesPerSecond - Bytes per second
 * @returns {string} Formatted speed (e.g., "1.23 MB/s")
 */
function formatSpeed(bytesPerSecond) {
  return formatBytes(bytesPerSecond) + '/s';
}

/**
 * Update the UI based on status
 * @param {string} status - Update status
 * @param {Object} data - Additional data
 */
function updateUI(status, data = {}) {
  currentStatus = status;
  
  switch (status) {
    case 'checking':
      setStatus('Checking for updates...');
      showSpinner(true);
      hideProgress();
      hideButtons();
      hideError();
      break;

    case 'available':
      setStatus(`Update ${data.version || 'available'}`);
      showSpinner(false);
      hideProgress();
      hideButtons();
      hideError();
      break;

    case 'downloading':
      setStatus('Downloading update...');
      showSpinner(false);
      showProgress(data.percent || 0, data);
      hideButtons();
      hideError();
      break;

    case 'downloaded':
      setStatus(`Update ${data.version || ''} ready to install`);
      showSpinner(false);
      hideProgress();
      showButtons();
      hideError();
      break;

    case 'error':
      setStatus('Update failed');
      showSpinner(false);
      hideProgress();
      hideButtons();
      showError(data.message || 'An unknown error occurred');
      break;

    default:
      setStatus('Updating...');
      showSpinner(true);
      hideProgress();
      hideButtons();
      hideError();
  }
}

/**
 * Set status text
 * @param {string} text - Status text to display
 */
function setStatus(text) {
  elements.status.textContent = text;
  elements.status.setAttribute('aria-label', text);
}

/**
 * Show/hide spinner
 * @param {boolean} show - Whether to show spinner
 */
function showSpinner(show) {
  if (show) {
    elements.spinner.classList.remove('hidden');
    elements.spinner.setAttribute('aria-hidden', 'false');
  } else {
    elements.spinner.classList.add('hidden');
    elements.spinner.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Show progress bar with percentage and details
 * @param {number} percent - Progress percentage (0-100)
 * @param {Object} data - Additional progress data
 */
function showProgress(percent, data = {}) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  
  elements.progressContainer.classList.add('visible');
  elements.progressContainer.setAttribute('aria-valuenow', clampedPercent);
  
  elements.progressFill.style.width = `${clampedPercent}%`;
  elements.progressText.textContent = `${Math.round(clampedPercent)}%`;
  
  // Show download details if available
  if (data.transferred && data.total) {
    const transferred = formatBytes(data.transferred);
    const total = formatBytes(data.total);
    const speed = data.bytesPerSecond ? formatSpeed(data.bytesPerSecond) : '';
    
    elements.progressDetails.textContent = speed 
      ? `${transferred} / ${total} • ${speed}`
      : `${transferred} / ${total}`;
  } else {
    elements.progressDetails.textContent = '';
  }
}

/**
 * Hide progress bar
 */
function hideProgress() {
  elements.progressContainer.classList.remove('visible');
  elements.progressContainer.setAttribute('aria-valuenow', '0');
}

/**
 * Show action buttons
 */
function showButtons() {
  elements.buttons.classList.add('visible');
  elements.installBtn.disabled = false;
}

/**
 * Hide action buttons
 */
function hideButtons() {
  elements.buttons.classList.remove('visible');
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.add('visible');
  elements.errorMessage.setAttribute('role', 'alert');
}

/**
 * Hide error message
 */
function hideError() {
  elements.errorMessage.classList.remove('visible');
  elements.errorMessage.textContent = '';
}

/**
 * Handle install button click
 */
function handleInstall() {
  if (currentStatus !== 'downloaded') return;
  
  // Disable button and show loading state
  elements.installBtn.disabled = true;
  elements.installBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Installing...</span>';
  
  // Notify main process
  if (window.updaterAPI) {
    window.updaterAPI.installUpdate();
  }
}

/**
 * Handle cancel button click
 */
function handleCancel() {
  if (window.updaterAPI) {
    window.updaterAPI.cancelUpdate();
  }
}

/**
 * Initialize event listeners
 */
function init() {
  // Listen for update status from main process
  if (window.updaterAPI) {
    window.updaterAPI.onStatus((data) => {
      console.log('📦 Update status received:', data);
      updateUI(data.status, data);
    });
  } else {
    console.warn('⚠️  updaterAPI not available');
    showError('Unable to connect to update system');
  }
  
  // Button event listeners
  elements.installBtn.addEventListener('click', handleInstall);
  elements.cancelBtn.addEventListener('click', handleCancel);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Enter key = Install (if buttons visible)
    if (e.key === 'Enter' && !elements.buttons.classList.contains('hidden')) {
      handleInstall();
    }
    // Escape key = Cancel
    if (e.key === 'Escape') {
      handleCancel();
    }
  });
  
  console.log('✅ Updater UI initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
