const mongoose = require('mongoose');

const shippingZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },   // ej: "Cordoba Capital", "Interior", "CABA"
  cost: { type: Number, required: true }
});

module.exports = mongoose.model('ShippingZone', shippingZoneSchema);
