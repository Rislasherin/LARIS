const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    logo: {
        type: String, // Store image path or URL
        required: false
    },
    isListed: {
        type: Boolean,
        default: true // Used for listing/unlisting brands
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Brand', brandSchema);
