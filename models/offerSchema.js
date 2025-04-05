// models/Offer.js
const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
    title: { type: String, required: false }, // Make optional
    description: { type: String },
    discountValue: { type: Number, required: true },
    applicableTo: { type: String, enum: ["product", "category"], required: true },
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product", 
        required: false // Remove conditional requirement
    },
    categoryId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Category", 
        required: false // Remove conditional requirement
    },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Offer", offerSchema);