const Cart = require('../../models/CartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Category = require('../../models/CategorySchema');
const Address = require('../../models/addressSchema');

const getCartPage = async (req, res) => {
    try {
        const userId = req.user._id;

        const cart = await Cart.findOne({ user: userId })
          .populate({
            path: 'items.product',
            populate: { path: 'category' }
          });
  
        let subtotal = 0;
        let shippingCost = 50;
        let discount = 0;
  
        if (cart && cart.items.length > 0) {
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
        } else {
            shippingCost = 0;
        }
  
        const tax = subtotal * 0.1;
        const total = subtotal + shippingCost + tax;
  
        const relatedProducts = cart && cart.items.length > 0
            ? await Product.find({
                category: cart.items[0].product?.category?._id,
                _id: { $nin: cart.items.map(item => item.product?._id).filter(Boolean) }
            }).limit(4)
            : await Product.find().limit(4);
  
        res.render("cart", { 
            cart, 
            user: req.user,
            subtotal,
            shippingCost,
            tax,
            total,
            discount,
            relatedProducts 
        });
    } catch (error) {
        console.error("Error loading cart page:", error);
        res.status(500).send("Internal Server Error");
    }
  };

const addToCart = async (req, res) => {
  try {
      const userId = req.session.user?._id || 
                    (typeof req.session.user === 'string' ? req.session.user : null);
      
      if (!userId) {
          return res.status(401).json({ 
              success: false, 
              message: 'Please login to add products to cart',
              redirectUrl: '/login'
          });
      }

      const { productId, quantity } = req.body;
      
      if (!productId) {
          return res.status(400).json({ success: false, message: 'Product ID is required' });
      }

      const parsedQuantity = parseInt(quantity, 10) || 1;
      const product = await Product.findById(productId).populate('category');
      
      if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found' });
      }

      if (product.quantity < parsedQuantity) {
          return res.status(400).json({ success: false, message: 'Insufficient stock' });
      }

      let cart = await Cart.findOne({ user: userId });
      if (!cart) {
          cart = new Cart({ user: userId, items: [] });
      }

      const existingItemIndex = cart.items.findIndex(
          item => item.product.toString() === productId
      );

      if (existingItemIndex > -1) {
          cart.items[existingItemIndex].quantity = Math.min(
              cart.items[existingItemIndex].quantity + parsedQuantity,
              product.quantity
          );
      } else {
          const effectivePrice = product.regularPrice * (1 - Math.max(product.productOffer || 0, product.category?.categoryOffer || 0) / 100);
          cart.items.push({ 
              product: productId, 
              quantity: parsedQuantity,
              price: effectivePrice
          });
      }

      await cart.save();
      product.quantity -= parsedQuantity;
      await product.save();

      const subtotal = cart.items.reduce((sum, item) => {
          const product = item.product;
          const effectivePrice = product.regularPrice * (1 - Math.max(product.productOffer || 0, product.category?.categoryOffer || 0) / 100);
          return sum + (effectivePrice * item.quantity);
      }, 0);
      const shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const total = subtotal + shippingCost + tax;
      const discount = cart.items.reduce((sum, item) => {
          const regularPrice = item.product.regularPrice;
          const effectivePrice = item.price;
          return sum + (regularPrice - effectivePrice) * item.quantity;
      }, 0);

      res.status(200).json({ 
          success: true, 
          message: 'Product added to cart',
          cartCount: cart.items.length,
          subtotal,
          shippingCost,
          tax,
          total,
          discount
      });
  } catch (error) {
      console.error('Add to Cart Error:', error);
      res.status(500).json({ 
          success: false, 
          message: 'Server error',
          errorDetails: error.message 
      });
  }
};

const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login' });
        }

        const { productId, action } = req.body;
        const cart = await Cart.findOne({ user: userId }).populate({
          path: 'items.product',
          populate: { path: 'category' }
        });
        
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const cartItem = cart.items.find(item => item.product._id.toString() === productId);
        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Item not found in cart' });
        }

        const product = await Product.findById(productId);
        if (action === 'increase') {
            if (cartItem.quantity < product.quantity) {
                cartItem.quantity += 1;
                product.quantity -= 1;
            } else {
                return res.status(400).json({ success: false, message: 'Maximum stock reached' });
            }
        } else if (action === 'decrease' && cartItem.quantity > 1) {
            cartItem.quantity -= 1;
            product.quantity += 1;
        } else if (action === 'decrease' && cartItem.quantity === 1) {
            return res.status(400).json({ success: false, message: 'Minimum quantity is 1. Use remove to delete.' });
        }

        await cart.save();
        await product.save();

        const subtotal = cart.items.reduce((sum, item) => {
            const regularPrice = item.product.regularPrice;
            const effectivePrice = regularPrice * (1 - Math.max(item.product.productOffer || 0, item.product.category?.categoryOffer || 0) / 100);
            return sum + (effectivePrice * item.quantity);
        }, 0);
        const shippingCost = subtotal > 1000 ? 0 : 50;
        const tax = subtotal * 0.1;
        const total = subtotal + shippingCost + tax;
        const discount = cart.items.reduce((sum, item) => {
            const regularPrice = item.product.regularPrice;
            const effectivePrice = regularPrice * (1 - Math.max(item.product.productOffer || 0, item.product.category?.categoryOffer || 0) / 100);
            return sum + (regularPrice - effectivePrice) * item.quantity;
        }, 0);

        res.json({
            success: true,
            subtotal,
            shippingCost,
            tax,
            total,
            discount,
            cartCount: cart.items.length
        });
    } catch (error) {
        console.error("Error updating cart:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const removeFromCart = async (req, res) => {
  try {
      const userId = req.session.user?._id;
      if (!userId) {
          return res.status(401).json({ success: false, message: 'Please login' });
      }

      const { productId } = req.body;
      const cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
      });
      
      if (!cart) {
          return res.status(404).json({ success: false, message: 'Cart not found' });
      }

      const removedItem = cart.items.find(item => item.product._id.toString() === productId);
      if (removedItem) {
          const product = await Product.findById(productId);
          product.quantity += removedItem.quantity;
          await product.save();
      }

      cart.items = cart.items.filter(item => item.product._id.toString() !== productId);
      await cart.save();

      const subtotal = cart.items.reduce((sum, item) => {
          const regularPrice = item.product.regularPrice;
          const effectivePrice = regularPrice * (1 - Math.max(item.product.productOffer || 0, item.product.category?.categoryOffer || 0) / 100);
          return sum + (effectivePrice * item.quantity);
      }, 0);
      const shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const total = subtotal + shippingCost + tax;
      const discount = cart.items.reduce((sum, item) => {
          const regularPrice = item.product.regularPrice;
          const effectivePrice = regularPrice * (1 - Math.max(item.product.productOffer || 0, item.product.category?.categoryOffer || 0) / 100);
          return sum + (regularPrice - effectivePrice) * item.quantity;
      }, 0);

      res.json({
          success: true,
          subtotal,
          shippingCost,
          tax,
          total,
          discount,
          cartCount: cart.items.length
      });
  } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getCartContents = async (req, res) => {
  try {
      if (!req.session.user) {
          return res.status(401).send('');
      }

      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
      });

      if (!cart || !cart.items.length) {
          return res.send('<p class="text-gray-500">Your cart is empty</p>');
      }

      let html = '';
      cart.items.forEach(item => {
          const regularPrice = item.product?.regularPrice || 0;
          const effectivePrice = regularPrice * (1 - Math.max(item.product?.productOffer || 0, item.product?.category?.categoryOffer || 0) / 100);

          html += `
            <div class="flex items-center justify-between py-2">
              <div class="flex items-center">
                <img src="/uploads/product-images/${item.product?.productImage?.[0] || ''}" 
                     alt="${item.product?.productName || 'Product'}" 
                     class="w-12 h-12 object-cover rounded mr-2" 
                     onerror="this.src='/images/placeholder.jpg'">
                <span>${item.product?.productName || 'Unnamed Product'}</span>
              </div>
              <span>₹${(effectivePrice * item.quantity).toFixed(2)} (x${item.quantity})</span>
            </div>
          `;
      });
      res.send(html);
  } catch (error) {
      console.error('Error fetching cart contents:', error);
      res.status(500).send('<p class="text-red-500">Error loading cart</p>');
  }
};

module.exports = {
    getCartPage,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    getCartContents
};