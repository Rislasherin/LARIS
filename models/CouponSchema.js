const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountValue: { type: Number, required: true },
  minOrderValue: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' } // Add this
}, { timestamps: true });

module.exports = mongoose.model("Coupon", couponSchema);