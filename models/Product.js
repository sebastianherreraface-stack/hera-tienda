const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  stock: { type: Number, default: 999 },
  imageUrl: String,
  imagePublicId: String,
  category: { type: String, default: 'general' }, // 'anillo', 'collar', 'aro', etc.
  sizes: [String], // Para anillos: ['12', '13', '14', '15', '16', '17', '18']
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
