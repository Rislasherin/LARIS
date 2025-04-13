const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: false
    },
    password: { 
        type: String, 
        required: function() {
            return !this.googleId;
        }
    },
    isBlocked: {
        type: Boolean,
        default: false,
        index: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    referralCode: { // Corrected from 'referelCode'
        type: String,
        unique: true,
        sparse: true // Allows multiple null values
    },
    referredBy: { // New field to track who referred this user
        type: String, // Stores the referral code of the referrer
        default: null
    },
    addresses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    }],
    cart: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1
        }
    }],
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    searchHistory: [{
        query: { type: String },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
        skinType: { type: String, default: null },
        skinConcern: { type: String, default: null },
        searchedOn: { type: Date, default: Date.now }
      }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;