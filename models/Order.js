const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number
  }],
  shippingZone: String,
  shippingCost: Number,
  total: Number,
  buyerEmail: String,
  buyerName: String,
  buyerAddress: String,
  mpPaymentId: String,
  status: { type: String, default: 'pending' }, // pending | approved | rejected
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
