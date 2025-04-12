const Cart = require('../../models/CartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Category = require('../../models/CategorySchema');
const Address = require('../../models/addressSchema');
const  Order  = require('../../models/orderSchema');
const Coupon = require('../../models/CouponSchema');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();



const getAvailableCoupons = async (req, res) => {
  try {
      const userId = req.session.user?._id;
      if (!userId) {
          return res.status(401).json({ success: false, message: 'Please login' });
      }

      const coupons = await Coupon.find({
          isActive: true,
          expiryDate: { $gte: new Date() }
      });

      res.json({ success: true, coupons });
  } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// Apply a coupon
const applyCoupon = async (req, res) => {
  try {
      const userId = req.session.user?._id;
      if (!userId) {
          return res.status(401).json({ success: false, message: 'Please login' });
      }

      const { couponCode } = req.body;
      if (!couponCode) {
          return res.status(400).json({ success: false, message: 'Coupon code is required' });
      }

      const coupon = await Coupon.findOne({
          code: couponCode,
          isActive: true,
          expiryDate: { $gte: new Date() }
      });

      if (!coupon) {
          return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
      }

      // Store the applied coupon in the session for use in payment page
      req.session.appliedCoupon = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderValue: coupon.minOrderValue
      };

      res.json({
          success: true,
          message: `Coupon "${coupon.code}" applied successfully!`,
          discountValue: coupon.discountValue,
          discountType: coupon.discountType,
          minOrderValue: coupon.minOrderValue // Include this in the response
      });
  } catch (error) {
      console.error("Error applying coupon:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


const removeCoupon = async (req, res) => {
  try {
      const userId = req.session.user?._id;
      if (!userId) {
          return res.status(401).json({ success: false, message: 'Please login' });
      }

      delete req.session.appliedCoupon; // Remove the coupon from the session
      res.json({ success: true, message: 'Coupon removed successfully' });
  } catch (error) {
      console.error("Error removing coupon:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


const getCheckoutAddressPage = async (req, res) => {
  try {
      const userId = req.session.user?._id;
      if (!userId) {
          return res.redirect("/user/login");
      }

      const cart = await Cart.findOne({ user: userId }).populate({
          path: 'items.product',
          populate: { path: 'category' }
      });

      if (!cart || !cart.items.length) {
          return res.redirect('/cart');
      }

      const userAddresses = await Address.find({ userId: userId });

      let subtotal = 0;
      let shippingCost = 50;
      let discount = 0;

      subtotal = cart.items.reduce((sum, item) => {
          if (item.product && item.product.regularPrice) {
              const regularPrice = item.product.regularPrice;
              const productOffer = item.product.productOffer || 0;
              const categoryOffer = item.product.category?.categoryOffer || 0;
              const effectiveOffer = Math.max(productOffer, categoryOffer);
              const effectivePrice = regularPrice * (1 - effectiveOffer / 100);
              discount += (regularPrice - effectivePrice) * item.quantity;
              return sum + (effectivePrice * item.quantity);
          }
          return sum;
      }, 0);

      let couponDiscount = 0;
      const appliedCoupon = req.session.appliedCoupon;
      if (appliedCoupon && subtotal >= appliedCoupon.minOrderValue) {
          if (appliedCoupon.discountType === 'percentage') {
              couponDiscount = subtotal * (appliedCoupon.discountValue / 100);
          } else {
              couponDiscount = appliedCoupon.discountValue;
          }
          discount += couponDiscount;
      }

      shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const total = subtotal + shippingCost + tax - couponDiscount;

      res.render('checkout-address', {
          cart,
          user: req.session.user,
          userAddresses,
          subtotal,
          shippingCost,
          tax,
          total,
          discount,
          appliedCoupon: appliedCoupon || null // Pass the applied coupon details
      });
  } catch (error) {
      console.error("Error loading checkout address page:", error);
      res.status(500).send("Internal Server Error");
  }
};
  
const getPaymentPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.redirect("/user/login");
    }

    const { selectedAddress } = req.body;
    if (!selectedAddress) {
      return res.redirect('/checkout/address');
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      populate: { path: 'category' }
    });

    if (!cart || !cart.items.length) {
      return res.redirect('/cart');
    }

    let subtotal = 0;
    let discount = 0;

    subtotal = cart.items.reduce((sum, item) => {
      const regularPrice = item.product.regularPrice;
      const productOffer = item.product.productOffer || 0;
      const categoryOffer = item.product.category?.categoryOffer || 0;
      const effectiveOffer = Math.max(productOffer, categoryOffer);
      const effectivePrice = regularPrice * (1 - effectiveOffer / 100);
      discount += (regularPrice - effectivePrice) * item.quantity;
      return sum + (effectivePrice * item.quantity);
    }, 0);

    let couponDiscount = 0;
    const appliedCoupon = req.session.appliedCoupon;
    if (appliedCoupon && subtotal >= appliedCoupon.minOrderValue) {
      if (appliedCoupon.discountType === 'percentage') {
        couponDiscount = subtotal * (appliedCoupon.discountValue / 100);
      } else {
        couponDiscount = appliedCoupon.discountValue;
      }
      discount += couponDiscount;
    }

    const shippingCost = subtotal > 1000 ? 0 : 50;
    const tax = subtotal * 0.1;
    const total = subtotal - couponDiscount + shippingCost + tax;

    res.render('payment', {
      cart,
      user: req.session.user,
      selectedAddress,
      subtotal,
      shippingCost,
      tax,
      total,
      discount,
      appliedCoupon: appliedCoupon ? appliedCoupon.code : null
    });
  } catch (error) {
    console.error("Error loading payment page:", error);
    res.status(500).send("Internal Server Error");
  }
};
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login' });
        }

        const { fullName, phone, address, city, state, country, pincode, addressType, isDefault } = req.body;

        if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }


        if (isDefault) {
            await Address.updateMany({ userId: userId, isDefault: true }, { isDefault: false });
        }

        const newAddress = new Address({
            userId,
            fullName,
            phone,
            address,
            city,
            state,
            country,
            pincode,
            addressType,
            isDefault: isDefault || false
        });

        await newAddress.save();
        res.json({ success: true, message: 'Address saved successfully' });
    } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Please log in' });
    }

    const { paymentMethod, selectedAddress } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method is required' });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      populate: { path: 'category' }
    });
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const shippingAddress = await Address.findById(selectedAddress);
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Please select a shipping address' });
    }

    // Validate stock availability
    for (const item of cart.items) {
      if (item.product.quantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${item.product.productName}. Only ${item.product.quantity} left.`
        });
      }
    }

    // Calculate totals
    let subtotal = 0;
    let discount = 0;
    const orderItems = cart.items.map(item => {
      const regularPrice = item.product.regularPrice;
      const productOffer = item.product.productOffer || 0;
      const categoryOffer = item.product.category?.categoryOffer || 0;
      const effectiveOffer = Math.max(productOffer, categoryOffer);
      const effectivePrice = regularPrice * (1 - effectiveOffer / 100);

      discount += (regularPrice - effectivePrice) * item.quantity;
      subtotal += effectivePrice * item.quantity;

      return {
        productId: item.product._id,
        quantity: item.quantity,
        productName: item.product.productName,
        variantIndex: item.variantIndex,
        productImage: item.product.productImage ? item.product.productImage[0] : null,
        price: effectivePrice,
        status: 'Pending'
      };
    });

    // Apply coupon discount
    let couponDiscount = 0;
    let couponCode = null;
    const appliedCoupon = req.session.appliedCoupon;
    if (appliedCoupon && subtotal >= appliedCoupon.minOrderValue) {
      if (appliedCoupon.discountType === 'percentage') {
        couponDiscount = subtotal * (appliedCoupon.discountValue / 100);
      } else {
        couponDiscount = appliedCoupon.discountValue;
      }
      discount += couponDiscount;
      couponCode = appliedCoupon.code;
    }

    const shippingCost = subtotal > 1000 ? 0 : 50;
    const tax = subtotal * 0.1;
    const totalPrice = subtotal - couponDiscount;
    const finalAmount = totalPrice + shippingCost + tax;

    // For Razorpay, create order without reducing stock yet
    if (paymentMethod === 'razorpay') {
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: 'INR',
        receipt: uuidv4()
      });

      req.session.pendingOrder = {
        user: userId,
        orderItems,
        totalPrice,
        discount,
        finalAmount,
        address: shippingAddress._id,
        paymentMethod,
        razorpayOrderId: razorpayOrder.id,
        couponCode,
        couponDiscount,
        shipping: shippingCost,
        tax
      };

      return res.json({
        orderId: razorpayOrder.id,
        key_id: process.env.RAZORPAY_KEY_ID,
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        },
        finalAmount
      });
    }

    // For COD, reduce stock and save order
    const updatedProducts = [];
    try {
      for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        product.quantity -= item.quantity;
        if (product.quantity < 0) {
          throw new Error(`Stock issue for ${item.product.productName}`);
        }
        await product.save();
        updatedProducts.push({ productId: item.product._id, quantity: item.quantity });
      }

      const order = new Order({
        user: userId,
        orderID: uuidv4(),
        orderItems,
        totalPrice,
        discount,
        finalAmount,
        address: shippingAddress._id,
        status: 'Pending',
        paymentMethod,
        couponCode,
        couponDiscount,
        shipping: shippingCost,
        tax,
        timeline: [
          {
            title: 'Order Placed',
            text: 'Your order has been placed successfully.',
            date: new Date(),
            completed: true
          }
        ]
      });

      await order.save();
      await Cart.deleteOne({ user: userId });

      delete req.session.appliedCoupon;

      return res.json({
        orderId: order._id.toString(),
        message: 'Order placed successfully'
      });
    } catch (error) {
      // Rollback stock changes
      for (const { productId, quantity } of updatedProducts) {
        const product = await Product.findById(productId);
        if (product) {
          product.quantity += quantity;
          await product.save();
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Error placing order:", error.stack);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
const verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const userId = req.session.user?._id;

    if (!req.session.pendingOrder || req.session.pendingOrder.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Invalid payment attempt' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      delete req.session.pendingOrder;
      return res.status(400).json({ success: false, message: 'Payment verification failed', orderId: razorpay_order_id });
    }

    // Validate and reduce stock
    const updatedProducts = [];
    try {
      for (const item of req.session.pendingOrder.orderItems) {
        const product = await Product.findById(item.productId);
        if (!product || product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.productName}. Only ${product?.quantity || 0} left.`);
        }
        product.quantity -= item.quantity;
        await product.save();
        updatedProducts.push({ productId: item.productId, quantity: item.quantity });
      }

      // Save order
      const order = new Order({
        user: userId,
        orderID: uuidv4(),
        orderItems: req.session.pendingOrder.orderItems,
        totalPrice: req.session.pendingOrder.totalPrice,
        discount: req.session.pendingOrder.discount,
        finalAmount: req.session.pendingOrder.finalAmount,
        address: req.session.pendingOrder.address,
        status: 'Confirmed',
        paymentMethod: 'razorpay',
        paymentStatus: 'Paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        couponCode: req.session.pendingOrder.couponCode,
        couponDiscount: req.session.pendingOrder.couponDiscount,
        shipping: req.session.pendingOrder.shipping || 0,
        tax: req.session.pendingOrder.tax || 0,
        timeline: [
          {
            title: 'Order Placed',
            text: 'Your order has been placed successfully.',
            date: new Date(),
            completed: true
          },
          {
            title: 'Payment Confirmed',
            text: 'Payment has been verified.',
            date: new Date(),
            completed: true
          }
        ]
      });

      await order.save();
      await Cart.deleteOne({ user: userId });

      delete req.session.pendingOrder;
      delete req.session.appliedCoupon;

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        orderId: order._id.toString()
      });
    } catch (error) {
      // Rollback stock changes
      for (const { productId, quantity } of updatedProducts) {
        const product = await Product.findById(productId);
        if (product) {
          product.quantity += quantity;
          await product.save();
        }
      }
      delete req.session.pendingOrder;
      throw error;
    }
  } catch (error) {
    console.error("Error verifying payment:", error.stack);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
  const getOrderSuccessPage = async (req, res) => {
    try {
      const orderId = req.query.orderId || 'N/A';
      const message = req.session.lastOrder?.message || 'Order Placed Successfully';
  
      delete req.session.lastOrder;
  
      res.render('order-success', { 
        orderId,
        message
      });
    } catch (error) {
      console.error("Error rendering order success page:", error);
      res.redirect('/');
    }
  };

  const getOrderErrorPage = async (req, res) => {
    try {
      const errorMessage = req.query.message || "We couldn't process your order";
      const errorDetails = req.query.details || "There was an issue with your transaction. Please try again.";
      const errorCode = req.query.code || null;
      const orderId = req.query.orderId || 'N/A'; // Add orderId from query params or default to 'N/A'
      const finalAmount = req.query.finalAmount || req.session.pendingOrder?.finalAmount || undefined;
      
      res.render('order-error', { 
        errorMessage,
        errorDetails,
        errorCode,
        orderId ,
        finalAmount: finalAmount ? parseFloat(finalAmount) : undefined
      });
    } catch (error) {
      console.error("Error rendering error page:", error);
      res.redirect('/');
    }
  };


  const retryPayment = async (req, res) => {
    try {
      const { orderId } = req.body; // This is the Razorpay order ID from the error page
      const userId = req.session.user?._id;
  
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      if (!req.session.pendingOrder || req.session.pendingOrder.razorpayOrderId !== orderId) {
        return res.status(400).json({ success: false, message: 'No pending order found for retry' });
      }
  
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(req.session.pendingOrder.finalAmount * 100),
        currency: 'INR',
        receipt: req.session.pendingOrder.razorpayOrderId
      });
  
      req.session.pendingOrder.razorpayOrderId = razorpayOrder.id; // Update with new Razorpay order ID
  
      res.json({
        success: true,
        orderId: razorpayOrder.id,
        key_id: process.env.RAZORPAY_KEY_ID,
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        }
      });
    } catch (error) {
      console.error("Error retrying payment:", error.stack);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };

  const getAddress = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      const addressId = req.params.addressId;
      const address = await Address.findOne({ _id: addressId, userId: userId });
  
      if (!address) {
        return res.status(404).json({ success: false, message: 'Address not found' });
      }
  
      res.json({ success: true, data: address });
    } catch (error) {
      console.error("Error fetching address:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  

  const editAddress = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      const addressId = req.params.addressId;
      const { fullName, phone, address, city, state, country, pincode, addressType, isDefault } = req.body;
  
      if (!fullName || !phone || !address || !city || !state || !country || !pincode || !addressType) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }
  
      // If setting this as default, unset others
      if (isDefault) {
        await Address.updateMany({ userId: userId, isDefault: true }, { isDefault: false });
      }
  
      const updatedAddress = await Address.findOneAndUpdate(
        { _id: addressId, userId: userId },
        {
          fullName,
          phone,
          address,
          city,
          state,
          country,
          pincode,
          addressType,
          isDefault: isDefault || false
        },
        { new: true }
      );
  
      if (!updatedAddress) {
        return res.status(404).json({ success: false, message: 'Address not found' });
      }
  
      res.json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
      console.error("Error editing address:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  
  // Remove Address
  const removeAddress = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      const addressId = req.params.addressId;
  
      const deletedAddress = await Address.findOneAndDelete({ _id: addressId, userId: userId });
  
      if (!deletedAddress) {
        return res.status(404).json({ success: false, message: 'Address not found' });
      }
  
      // If the deleted address was default, set another as default (optional logic)
      if (deletedAddress.isDefault) {
        const nextAddress = await Address.findOne({ userId: userId });
        if (nextAddress) {
          nextAddress.isDefault = true;
          await nextAddress.save();
        }
      }
  
      res.json({ success: true, message: 'Address removed successfully' });
    } catch (error) {
      console.error("Error removing address:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };


  

module.exports = {
    getCheckoutAddressPage,
    getPaymentPage,
    addAddress,
    placeOrder,
    getOrderSuccessPage,
    editAddress,
    removeAddress,
    getAddress,
    verifyPayment,
    getOrderErrorPage,
    getAvailableCoupons, 
    applyCoupon,
    removeCoupon ,
    retryPayment

   
};