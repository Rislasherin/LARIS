const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        match: [/^\d{10}$/, 'Phone number must be exactly 10 digits'],
        validate: {
            validator: function (value) {
                return value !== '0000000000';
            },
            message: 'Phone number cannot be all zeros'
        }
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true
    },
    pincode: {
        type: String,
        required: true,
        trim: true,
        match: [/^\d{6}$/, 'Pincode must be exactly 6 digits'],
        validate: {
            validator: function (value) {
                return value !== '000000';
            },
            message: 'Pincode cannot be all zeros'
        }
    },
    addressType: {
        type: String,
        enum: ['Home', 'Work'],
        required: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;