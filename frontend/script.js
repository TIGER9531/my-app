// API Base URL - change this to your deployed backend URL
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

// Current shortened data
let currentShortUrl = '';
let currentStats = null;

// Load recent links on page load
document.addEventListener('DOMContentLoaded', () => {
  loadRecentLinks();
});

// Shorten URL button click
shortenBtn.addEventListener('click', async () => {
  const longUrl = longUrlInput.value.trim();
  
  if (!longUrl) {
    showError('Please enter a URL');
    return;
  }
  
  // Basic URL validation
  if (!isValidUrl(longUrl)) {
    showError('Please enter a valid URL (include http:// or https://)');
    return;
  }
  
  // Show loading state
  shortenBtn.textContent = 'Shortening...';
  shortenBtn.disabled = true;
  
  try {
    const requestBody = {
      longUrl: longUrl,
    };
    
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to shorten URL');
    }
    
    // Display result
    currentShortUrl = data.shortUrl;
    shortenedUrlInput.value = data.shortUrl;
    currentStats = {
      clickCount: 0,
      expiresAt: data.expiresAt
    };
    
    // Update click count display
    clickCountSpan.textContent = '0 clicks';
    
    // Update expiry info
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      expiryInfoSpan.textContent = `Expires: ${expiryDate.toLocaleDateString()}`;
    } else {
      expiryInfoSpan.textContent = 'Never expires';
    }
    
    // Show QR code if available
    if (data.qrCode) {
      qrCodeContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
    } else {
      qrCodeContainer.innerHTML = '';
    }
    
    // Show result
    resultDiv.style.display = 'block';
    
    // Clear input and reload recent links
    longUrlInput.value = '';
    customAliasInput.value = '';
    expiresInSelect.value = '';
    loadRecentLinks();
    
  } catch (error) {
    showError(error.message);
  } finally {
    shortenBtn.textContent = 'Shorten URL ✨';
    shortenBtn.disabled = false;
  }
});

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
  if (!currentShortUrl) return;
  
  try {
    await navigator.clipboard.writeText(currentShortUrl);
    
    // Show temporary success feedback
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied! ✅';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    showError('Failed to copy to clipboard');
  }
});

// Close result
closeResultBtn.addEventListener('click', () => {
  resultDiv.style.display = 'none';
  currentShortUrl = '';
});

// Load recent links
async function loadRecentLinks() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/links`);
    const links = await response.json();
    
    if (!response.ok) {
      throw new Error('Failed to load recent links');
    }
    
    if (links.length === 0) {
      recentLinksList.innerHTML = '<div class="loading">No links yet. Create your first short link above!</div>';
      return;
    }
    
    recentLinksList.innerHTML = links.map(link => `
      <div class="link-item">
        <div class="link-item-header">
          <a href="${link.shortUrl}" class="link-short" target="_blank">${link.shortUrl}</a>
          <button class="btn-secondary" onclick="copyToClipboard('${link.shortUrl}')" style="padding: 5px 10px; font-size: 0.8rem;">Copy</button>
        </div>
        <div class="link-original" title="${link.originalUrl}">
          ${truncateUrl(link.originalUrl, 60)}
        </div>
        <div class="link-stats">
          <span>👁️ ${link.clickCount} clicks</span>
          <span>📅 ${new Date(link.createdAt).toLocaleDateString()}</span>
          ${link.expiresAt ? `<span>⏰ Expires: ${new Date(link.expiresAt).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error loading recent links:', error);
    recentLinksList.innerHTML = '<div class="loading">Failed to load recent links. Please refresh the page.</div>';
  }
}

// Helper function to copy to clipboard (global for buttons)
window.copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Truncate long URLs
function truncateUrl(url, maxLength) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

// Show error message
function showError(message) {
  // Remove existing error
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  // Create error element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  // Insert after input group
  const inputGroup = document.querySelector('.input-group');
  inputGroup.parentNode.insertBefore(errorDiv, inputGroup.nextSibling);
  
  // Remove after 3 seconds
  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}