```javascript
// API Base URL - FIXED
const API_BASE_URL = "https://url-shortener2-uoz1.onrender.com";

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
  
  if (!isValidUrl(longUrl)) {
    showError('Please enter a valid URL (include http:// or https://)');
    return;
  }
  
  shortenBtn.textContent = 'Shortening...';
  shortenBtn.disabled = true;
  
  try {
    const requestBody = { longUrl };

    if (customAliasInput.value.trim()) {
      const alias = customAliasInput.value.trim();
      if (!/^[a-zA-Z0-9]{3,20}$/.test(alias)) {
        throw new Error('Custom alias must be 3-20 alphanumeric characters');
      }
      requestBody.customAlias = alias;
    }
    
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
    
    currentShortUrl = data.shortUrl;
    shortenedUrlInput.value = data.shortUrl;
    currentStats = { clickCount: 0, expiresAt: data.expiresAt };
    
    clickCountSpan.textContent = '0 clicks';
    
    if (data.expiresAt) {
      const expiryDate = new Date(data.expiresAt);
      expiryInfoSpan.textContent = `Expires: ${expiryDate.toLocaleDateString()}`;
    } else {
      expiryInfoSpan.textContent = 'Never expires';
    }
    
    if (data.qrCode) {
      qrCodeContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
    } else {
      qrCodeContainer.innerHTML = '';
    }
    
    resultDiv.style.display = 'block';
    
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
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied! ✅';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (err) {
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
          <a href="${link.shortUrl}" target="_blank">${link.shortUrl}</a>
          <button onclick="copyToClipboard('${link.shortUrl}')">Copy</button>
        </div>
        <div>${truncateUrl(link.originalUrl, 60)}</div>
        <div>
          👁️ ${link.clickCount} clicks |
          📅 ${new Date(link.createdAt).toLocaleDateString()}
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    recentLinksList.innerHTML = '<div>Failed to load recent links.</div>';
  }
}

// Copy helper
window.copyToClipboard = async (text) => {
  await navigator.clipboard.writeText(text);
  alert('Copied!');
};

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Truncate URL
function truncateUrl(url, maxLength) {
  return url.length <= maxLength ? url : url.substring(0, maxLength) + '...';
}

// Show error
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.textContent = message;
  errorDiv.style.color = 'red';
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 3000);
}
```
