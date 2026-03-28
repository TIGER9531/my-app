const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const validUrl = require('valid-url');
const shortid = require('shortid');
const Url = require('./models/Url');

// Load env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// 🔥 IMPORTANT: use your real deployed URL
const BASE_URL = "https://url-shortener2-uoz1.onrender.com";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// MongoDB connect
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// QR generator
const generateQRCode = (shortUrl) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}`;
};

//
// ================= ROUTES =================
//

// ✅ Shorten URL
app.post('/api/shorten', async (req, res) => {
  try {
    const { longUrl, customAlias, expiresIn } = req.body;

    if (!validUrl.isWebUri(longUrl)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    let shortId;

    if (customAlias) {
      if (!/^[a-zA-Z0-9]{3,20}$/.test(customAlias)) {
        return res.status(400).json({ error: 'Invalid alias' });
      }

      const exists = await Url.findOne({ customAlias });
      if (exists) {
        return res.status(400).json({ error: 'Alias taken' });
      }

      shortId = customAlias;
    } else {
      shortId = shortid.generate();
    }

    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
    }

    const newUrl = new Url({
      shortId: customAlias ? null : shortId,
      customAlias: customAlias || undefined,
      originalUrl: longUrl,
      expiresAt,
      clickCount: 0
    });

    await newUrl.save();

    const shortUrl = `${BASE_URL}/${customAlias || shortId}`;

    res.json({
      shortUrl,
      originalUrl: longUrl,
      expiresAt,
      qrCode: generateQRCode(shortUrl)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ✅ Get recent links
app.get('/api/links', async (req, res) => {
  try {
    const links = await Url.find().sort({ createdAt: -1 }).limit(10);

    const formatted = links.map(link => ({
      originalUrl: link.originalUrl,
      shortUrl: `${BASE_URL}/${link.customAlias || link.shortId}`,
      clickCount: link.clickCount,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt
    }));

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ✅ Redirect (THIS IS THE IMPORTANT ONE)
app.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const url = await Url.findOne({
      $or: [{ shortId: id }, { customAlias: id }]
    });

    if (!url) {
      return res.status(404).send("❌ Short URL not found");
    }

    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(410).send("⏰ Link expired");
    }

    url.clickCount++;
    await url.save();

    res.redirect(url.originalUrl);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
