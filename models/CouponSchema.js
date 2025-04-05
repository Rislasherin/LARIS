const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // Unique coupon code
  discountValue: { type: Number, required: true }, // Discount amount
  minOrderValue: { type: Number, default: 0 }, // Minimum order amount to apply coupon
 // How many times a coupon can be used
  expiryDate: { type: Date, required: true }, // Expiry date
  isActive: { type: Boolean, default: true }, // Soft delete functionality
},

{timestamps:true}
);

module.exports = mongoose.model("Coupon", couponSchema);