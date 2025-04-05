const Cart = require('../../models/CartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Category = require('../../models/CategorySchema');
const Address = require('../../models/addressSchema');
const  Order  = require('../../models/orderSchema');
const { v4: uuidv4 } = require('uuid');


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

      shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const total = subtotal + shippingCost + tax;

      res.render('checkout-address', {
          cart,
          user: req.session.user,
          userAddresses,
          subtotal,
          shippingCost,
          tax,
          total,
          discount
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
  
      shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const total = subtotal + shippingCost + tax;
  

  
      res.render('payment', {
        cart,
        user: req.session.user,
        selectedAddress,
        subtotal,
        shippingCost,
        tax,
        total,
        discount,

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

const placeOrder = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.redirect('/user/login');
      }
  
      const { paymentMethod, selectedAddress, cardName, cardNumber, cardExpiry, cardCVV } = req.body;
  
      if (!paymentMethod) {
        req.session.errorMessage = 'Payment method is required';
        return res.redirect('/payment');
      }
  
      const cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
      });
  
      if (!cart || !cart.items.length) {
        req.session.errorMessage = 'Cart is empty';
        return res.redirect('/cart');
      }
  
      const shippingAddress = await Address.findById(selectedAddress);
      if (!shippingAddress) {
        req.session.errorMessage = 'Please select a shipping address';
        return res.redirect('/checkout/address');
      }
  
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
          price: effectivePrice
        };
      });
  
      const shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const totalPrice = subtotal;
      const finalAmount = subtotal + shippingCost + tax;
  
      const order = new Order({
        user: userId,
        orderID: uuidv4(),
        orderItems,
        totalPrice,
        discount,
        finalAmount,
        address: shippingAddress._id,
        status: paymentMethod === 'Cash on delivery' ? 'Pending' : 'Payment Pending',
        paymentMethod
      });
  
      if ((paymentMethod === 'bank' || paymentMethod === 'credit') && 
          (!cardName || !cardNumber || !cardExpiry || !cardCVV)) {
        req.session.errorMessage = 'Card details are required for bank or credit payment';
        return res.redirect('/checkout/payment');
      }
  
      await order.save();
      await Cart.deleteOne({ user: userId });
  
      req.session.lastOrder = {
        orderId: order._id.toString(),
        message: 'Order placed successfully'
      };
  
      res.redirect(`/order-success?orderId=${order._id}`);
    } catch (error) {
      console.error("Error placing order:", error.stack);
      req.session.errorMessage = 'Internal Server Error';
      res.redirect('/checkout/payment');
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
    getAddress
   
};