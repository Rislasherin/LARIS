const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    description: { type: String, required: true },
    brand: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    regularPrice: { type: Number, required: true },
    salePrice: { type: Number },
    quantity: { type: Number, required: true },
    skintype: { type: String },
    skinConcern: { type: String },
    productOffer:{type:Number,default:0},
    productImage: [{ type: String }],  // Ensure this is an array
    status: { type: String, default: 'Available' }
});

module.exports = mongoose.model('Product', productSchema);
