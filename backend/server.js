const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const validUrl = require('valid-url');
const shortid = require('shortid');
const Url = require('./models/Url');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend')); // Serve frontend files

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Helper function to generate QR code (simplified - you can integrate actual QR library)
const generateQRCode = (shortUrl) => {
  // In production, you'd use a library like qrcode
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
      // Validate custom alias format (alphanumeric, 3-20 chars)
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
      
      // Ensure uniqueness (very unlikely but check anyway)
      let existingUrl = await Url.findOne({ shortId });
      while (existingUrl) {
        shortId = shortid.generate();
        existingUrl = await Url.findOne({ shortId });
      }
    }

    // Calculate expiration date if provided
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
    
    // Generate QR code (optional)
    const qrCode = generateQRCode(shortUrl);

    res.status(201).json({
      success: true,
      shortUrl,
      shortId: customAlias || shortId,
      originalUrl: longUrl,
      qrCode,
      expiresAt,
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Get all recent links
app.get('/api/links', async (req, res) => {
  try {
    const links = await Url.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('shortId customAlias originalUrl clickCount createdAt expiresAt');
    
    // Format response
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
    
    // Find URL by shortId or customAlias
    const url = await Url.findOne({
      $or: [{ shortId: id }, { customAlias: id }]
    });
    
    // Check if URL exists
    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #ff4444; }
          </style>
        </head>
        <body>
          <h1>🔗 Link Not Found</h1>
          <p>The short link you're looking for doesn't exist or has been removed.</p>
          <a href="/">Go to Homepage</a>
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
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #ff4444; }
          </style>
        </head>
        <body>
          <h1>⏰ Link Expired</h1>
          <p>This short link has expired and is no longer valid.</p>
          <a href="/">Go to Homepage</a>
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Base URL: ${BASE_URL}`);
});
// Redirect short URL
app.get('/:shortCode', async (req, res) => {
  try {
    const shortCode = req.params.shortCode;

    const url = await Url.findOne({ shortCode });

    if (!url) {
      return res.status(404).send("Short URL not found");
    }

    // increase click count
    url.clickCount++;
    await url.save();

    // redirect
    res.redirect(url.originalUrl);

  } catch (err) {
    console.error("Redirect error:", err);
    res.status(500).send("Server error");
  }
});
