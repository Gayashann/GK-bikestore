const mongoose = require('mongoose');

const BikeSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  numberPlate: { type: String },
  year: { type: Number },
  condition: { type: String, enum: ['New', 'Excellent', 'Good', 'Fair'], default: 'Good' },
  buyingPrice: { type: Number, required: true },
  askingPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  status: { type: String, enum: ['Available', 'Sold'], default: 'Available' },
  purchaseDate: { type: Date, default: Date.now },
  saleDate: { type: Date },
  mileage: { type: Number },
  color: { type: String },
  image: { type: String } // Base64 string or preset image filename
}, { timestamps: true });

module.exports = mongoose.model('Bike', BikeSchema);
