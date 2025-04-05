const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    description: { type: String, required: true },
    brand: { type: String },
    features: [String],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    regularPrice: { type: Number, required: true },
    salePrice: { type: Number,required:true },
    quantity: { type: Number, required: true },
    skintype: { type: String ,default :'', required:true},
    skinConcern: { type: [String] ,required:true},
    reviewCount: { type: Number, default: 0 },
    productOffer:{type:Number,default:0},
    productImage: [{ type: String }],  
    salesCount: { type: Number, default: 0,required:true },
    status: { type: String, default: 'Available' },
    isBlocked: { type: Boolean, default: false, required: true },
    rating: { type: Number, default: 0 }, 
    offerPercentage: { type: Number },
    ingredients: [String],
    brand: { type: String },
    howToUse: {type: String,default :'',required: false},
    variants: [{
        size: { type: String,}, // e.g., "30ml", "50ml", "100ml"
        quantity: { type: Number,  default: 0 },
        regularPrice: { type: Number }, // Optional: variant-specific pricing
        salePrice: { type: Number }     // Optional: variant-specific pricing
    }],

});

module.exports = mongoose.model('Product', productSchema);
