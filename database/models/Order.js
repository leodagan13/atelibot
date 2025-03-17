// Order model schema
const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderid: {
    type: String,
    required: true,
    unique: true
  },
  adminid: {
    type: String,
    required: true
  },
  compensation: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED'],
    default: 'OPEN'
  },
  assignedTo: {
    type: String,
    default: null
  },
  messageid: {
    type: String,
    required: true
  },
  channelid: {
    type: String,
    required: true
  },
  privateChannelid: {
    type: String,
    default: null
  },
  clientName: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on change
OrderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', OrderSchema);