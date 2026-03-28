const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const validUrl = require('valid-url');
const shortid = require('shortid');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `https://your-app.onrender.com`; // Update this with your Render URL

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Define URL Schema (if not already defined)
const urlSchema = new mongoose.Schema({
  shortId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  originalUrl: {
    type: String,
    required: true,
    trim: true
  },
  customAlias: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    default: undefined
  },
  clickCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  qrCode: {
    type: String,
    default: null
  }
});

// Create indexes
urlSchema.index({ shortId: 1 });
urlSchema.index({ customAlias: 1 });

const Url = mongoose.model('Url', urlSchema);

// Helper function to generate QR code
const generateQRCode = (shortUrl) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}`;
};

// API Routes

// 1. Shorten URL endpoint
app.post('/api/shorten', async (req, res) => {
  try {
    const { longUrl, customAlias, expiresIn } = req.body;

    // Validate URL
    if (!validUrl.isWebUri(longUrl)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check for custom alias
    let shortId;
    if (customAlias) {
      // Validate custom alias format
      if (!/^[a-zA-Z0-9]{3,20}$/.test(customAlias)) {
        return res.status(400).json({ error: 'Custom alias must be 3-20 alphanumeric characters' });
      }
      
      // Check if custom alias already exists
      const existingAlias = await Url.findOne({ customAlias });
      if (existingAlias) {
        return res.status(400).json({ error: 'Custom alias already taken' });
      }
      shortId = customAlias;
    } else {
      // Generate unique short ID
      shortId = shortid.generate();
      
      // Ensure uniqueness
      let existingUrl = await Url.findOne({ shortId });
      while (existingUrl) {
        shortId = shortid.generate();
        existingUrl = await Url.findOne({ shortId });
      }
    }

    // Calculate expiration date
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
    }

    // Create new URL document
    const newUrl = new Url({
      shortId: customAlias ? null : shortId,
      customAlias: customAlias || undefined,
      originalUrl: longUrl,
      expiresAt,
    });

    await newUrl.save();

    // Generate short URL
    const shortUrl = `${BASE_URL}/${customAlias || shortId}`;
    
    // Generate QR code
    const qrCode = generateQRCode(shortUrl);

    res.status(201).json({
      success: true,
      shortUrl,
      shortId: customAlias || shortId,
      originalUrl: longUrl,
      qrCode,
      expiresAt,
      clickCount: 0
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// 2. Get all recent links
app.get('/api/links', async (req, res) => {
  try {
    const links = await Url.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('shortId customAlias originalUrl clickCount createdAt expiresAt');
    
    const formattedLinks = links.map(link => ({
      id: link.customAlias || link.shortId,
      originalUrl: link.originalUrl,
      shortUrl: `${BASE_URL}/${link.customAlias || link.shortId}`,
      clickCount: link.clickCount,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
    }));
    
    res.json(formattedLinks);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Get link stats
app.get('/api/stats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const url = await Url.findOne({
      $or: [{ shortId: id }, { customAlias: id }]
    });
    
    if (!url) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    res.json({
      originalUrl: url.originalUrl,
      clickCount: url.clickCount,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. Redirect endpoint
app.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Skip API routes
    if (id === 'api' || id === 'favicon.ico') {
      return res.status(404).send('Not found');
    }
    
    // Find URL by shortId or customAlias
    const url = await Url.findOne({
      $or: [{ shortId: id }, { customAlias: id }]
    });
    
    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            h1 { color: #ff4444; margin-bottom: 20px; }
            p { color: #666; margin-bottom: 30px; }
            a { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔗 Link Not Found</h1>
            <p>The short link you're looking for doesn't exist or has been removed.</p>
            <a href="${BASE_URL}">Go to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }
    
    // Check if link has expired
    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Expired</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            h1 { color: #ff4444; margin-bottom: 20px; }
            p { color: #666; margin-bottom: 30px; }
            a { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⏰ Link Expired</h1>
            <p>This short link has expired and is no longer valid.</p>
            <a href="${BASE_URL}">Go to Homepage</a>
          </div>
        </body>
        </html>
      `);
    }
    
    // Increment click count
    url.clickCount += 1;
    await url.save();
    
    // Redirect to original URL
    res.redirect(url.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).send('Server error');
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Base URL: ${BASE_URL}`);
});
