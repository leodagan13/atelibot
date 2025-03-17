// Coder model schema
const mongoose = require('mongoose');

const CoderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  activeOrderId: {
    type: String,
    default: null
  },
  completedOrders: {
    type: Number,
    default: 0
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Coder', CoderSchema);