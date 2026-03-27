const mongoose = require('mongoose');

// Define the URL schema
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

// Create an index on shortId for faster lookups
urlSchema.index({ shortId: 1 });
urlSchema.index({ customAlias: 1 });

module.exports = mongoose.model('Url', urlSchema);