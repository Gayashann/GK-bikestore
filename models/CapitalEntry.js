const mongoose = require('mongoose');

// Each document represents one injection of capital into the business pool
const CapitalEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true },            // Amount added (Rs.)
  note: { type: String, default: '' },                 // Optional label e.g. "Initial investment from Lakindu"
  addedAt: { type: Date, default: Date.now }           // When capital was added
}, { timestamps: true });

module.exports = mongoose.model('CapitalEntry', CapitalEntrySchema);
