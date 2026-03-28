// API Base URL - Auto-detect (works locally and on Render)
const API_BASE_URL = window.location.origin;

// DOM Elements
const longUrlInput = document.getElementById('longUrl');
const shortenBtn = document.getElementById('shortenBtn');
const resultDiv = document.getElementById('result');
const shortenedUrlInput = document.getElementById('shortenedUrl');
const copyBtn = document.getElementById('copyBtn');
const closeResultBtn = document.getElementById('closeResult');
const recentLinksList = document.getElementById('recentLinksList');
const customAliasInput = document.getElementById('customAlias');
const expiresInSelect = document.getElementById('expiresIn');
const qrCodeContainer = document.getElementById('qrCodeContainer');
const clickCountSpan = document.getElementById('clickCount');
const expiryInfoSpan = document.getElementById('expiryInfo');

// State
let currentShortUrl = '';

// Load recent links on page load
document.addEventListener('DOMContentLoaded', () => {
  loadRecentLinks();
  
  // Add enter key support
  longUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      shortenBtn.click();
    }
  });
});

// Shorten URL button click
shortenBtn.addEventListener('click', async () => {
  const longUrl = longUrlInput.value.trim();
  
  if (!longUrl) {
    showError('Please enter a URL');
    return;
  }
  
  if (!isValidUrl(longUrl)) {
    showError('Please enter a valid URL (include http:// or https://)');
    return;
  }
  
  // Disable button and show loading state
  shortenBtn.textContent = 'Shortening...';
  shortenBtn.disabled = true;
  
  try {
    const requestBody = { longUrl };

    // Add custom alias if provided
    if (customAliasInput.value.trim()) {
      const alias = customAliasInput.value.trim();
      if (!/^[a-zA-Z0-9]{3,20}$/.test(alias)) {
        throw new Error('Custom alias must be 3-20 alphanumeric characters');
      }
      requestBody.customAlias = alias;
    }
    
    // Add expiration if selected
    if (expiresInSelect.value) {
      requestBody.expiresIn = expiresInSelect.value;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to shorten URL');
    }
    
    // Display result
    currentShortUrl = data.shortUrl;
    shortenedUrlInput.value = data.shortUrl;
    clickCountSpan.textContent = '0 clicks';
    
    // Set expiration info
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      expiryInfoSpan.textContent = `Expires: ${expiryDate.toLocaleDateString()}`;
    } else {
      expiryInfoSpan.textContent = 'Never expires';
    }
    
    // Display QR code
    if (data.qrCode) {
      qrCodeContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code" style="max-width: 150px;">`;
    } else {
      qrCodeContainer.innerHTML = '';
    }
    
    // Show result and clear inputs
    resultDiv.style.display = 'block';
    longUrlInput.value = '';
    customAliasInput.value = '';
    expiresInSelect.value = '';
    
    // Refresh recent links
    loadRecentLinks();
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    showError(error.message);
  } finally {
    // Re-enable button
    shortenBtn.textContent = 'Shorten URL ✨';
    shortenBtn.disabled = false;
  }
});

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
  if (!currentShortUrl) return;
  
  try {
    await navigator.clipboard.writeText(currentShortUrl);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied! ✅';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (err) {
    // Fallback for older browsers
    shortenedUrlInput.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Copied! ✅';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  }
});

// Close result
closeResultBtn.addEventListener('click', () => {
  resultDiv.style.display = 'none';
  currentShortUrl = '';
});

// Load recent links from API
async function loadRecentLinks() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/links`);
    const links = await response.json();
    
    if (!response.ok) {
      throw new Error('Failed to load recent links');
    }
    
    if (links.length === 0) {
      recentLinksList.innerHTML = '<div class="loading">✨ No links yet. Create your first short link above!</div>';
      return;
    }
    
    recentLinksList.innerHTML = links.map(link => `
      <div class="link-item">
        <div class="link-item-header">
          <a href="${link.shortUrl}" target="_blank" class="link-short">${link.shortUrl}</a>
          <button onclick="copyToClipboard('${link.shortUrl}')" class="btn-secondary" style="padding: 5px 10px; font-size: 0.75rem;">Copy</button>
        </div>
        <div class="link-original">${truncateUrl(link.originalUrl, 70)}</div>
        <div class="link-stats">
          <span>👁️ ${link.clickCount} clicks</span>
          <span>📅 ${new Date(link.createdAt).toLocaleDateString()}</span>
          ${link.expiresAt ? `<span>⏰ Expires: ${new Date(link.expiresAt).toLocaleDateString()}</span>` : '<span>✨ Never expires</span>'}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading links:', error);
    recentLinksList.innerHTML = '<div class="loading">⚠️ Failed to load recent links. Please refresh the page.</div>';
  }
}

// Global copy function for recent links
window.copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    showTemporaryMessage('✅ Link copied to clipboard!');
  } catch (err) {
    // Fallback
    prompt('Copy this link:', text);
  }
};

// Show temporary success message
function showTemporaryMessage(message) {
  const msgDiv = document.createElement('div');
  msgDiv.textContent = message;
  msgDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4caf50;
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.9rem;
    z-index: 1000;
    animation: fadeIn 0.3s ease-out;
  `;
  document.body.appendChild(msgDiv);
  setTimeout(() => {
    msgDiv.remove();
  }, 2000);
}

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Truncate long URLs
function truncateUrl(url, maxLength) {
  if (!url) return '';
  return url.length <= maxLength ? url : url.substring(0, maxLength) + '...';
}

// Show error message
function showError(message) {
  // Remove any existing error messages
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = `⚠️ ${message}`;
  
  const inputGroup = document.querySelector('.input-group');
  inputGroup.parentNode.insertBefore(errorDiv, inputGroup.nextSibling);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 4000);
}
