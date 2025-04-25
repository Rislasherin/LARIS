// models/OrderSchema.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderID: { 
        type: String, 
        default: () => uuidv4(), 
        unique: true 
    },
    orderItems: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true },
        productName: String,
        variantIndex: { type: Number },
        productImage: String,
        price: { type: Number, required: true },
        status: {
            type: String,
            enum: [
                'Pending', 
                'Processing', 
                'Shipped', 
                'Delivered', 
                'Cancelled', 
                'Return Requested', 
                'Returned',
                'Cancellation Requested'
            ],
            default: 'Pending'
        },
        deliveryDate: { type: Date },
    }],
    totalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    address: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
    status: { 
        type: String, 
        default: 'Pending', 
        enum: [
            'Pending', 
            'Processing', 
            'Shipped', 
            'Delivered', 
            'Cancelled', 
            'Payment Pending',
            'Partially Delivered',
            'Partially Cancelled',
            'Return Requested',
            'Returned',
            'Partially Returned',
            'Confirmed',
            'Payment Failed'
        ]
    },
    paymentMethod: { type: String, required: true, enum: ['cod', 'bank', 'credit', 'razorpay', 'paylater','wallet'] },
    transactionId: { type: String, default: () => uuidv4() },
    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    timeline: [{
        title: { type: String, required: true },
        text: { type: String, required: true },
        date: { type: Date },
        completed: { type: Boolean, default: false }
    }],
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Completed'],
        default: 'Pending'
      },
    createdAt: { type: Date, default: Date.now },
    refundStatus: {
        type: String,
        enum: ['Pending', 'Processed', 'Partially Processed', 'Not Applicable'],
        default: 'Not Applicable'
    },
    history: [{
        status: String,
        timestamp: Date,
        notes: String,
        updatedBy: String
    }],
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String }
});

// Use existing model if compiled, otherwise create it
module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);