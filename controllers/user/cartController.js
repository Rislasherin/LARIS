const Cart = require('../../models/CartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Category = require('../../models/CategorySchema');
const Address = require('../../models/addressSchema');

const getCartPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1; // Get page number from query, default to 1
    const limit = 5; // Number of items per page
    const skip = (page - 1) * limit; // Calculate items to skip

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      populate: { path: 'category' },
    });

    let subtotal = 0;
    let shippingCost = 50;
    let discount = 0;
    let totalItems = 0;
    let paginatedItems = [];

    if (cart && cart.items && cart.items.length > 0) {
      totalItems = cart.items.length; // Total items in cart
      cart.items = cart.items.reverse(); // Reverse for display order
      paginatedItems = cart.items.slice(skip, skip + limit); // Slice items for current page

      // Calculate totals based on all items (not just paginated)
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

    const relatedProducts =
      cart && cart.items.length > 0
        ? await Product.find({
            category: cart.items[0].product?.category?._id,
            _id: { $nin: cart.items.map((item) => item.product?._id).filter(Boolean) },
          }).limit(4)
        : await Product.find().limit(4);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      totalItems: totalItems,
    };

    res.render('cart', {
      cart: { ...cart, items: paginatedItems }, // Pass only paginated items
      user: req.user,
      subtotal,
      shippingCost,
      tax,
      total,
      discount,
      relatedProducts,
      pagination, // Pass pagination data to template
    });
  } catch (error) {
    console.error('Error loading cart page:', error);
    res.status(500).send('Internal Server Error');
  }
};
  const addToCart = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login', redirectUrl: '/login' });
      }
  
      const { productId, quantity } = req.body;
      const parsedQuantity = parseInt(quantity, 10) || 1;
  
      const product = await Product.findById(productId).populate('category');
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
  
      let cart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
      });
      if (!cart) {
        cart = new Cart({ user: userId, items: [] });
      }
  
      const existingItemIndex = cart.items.findIndex(item => item.product._id.toString() === productId);
      const currentCartQuantity = existingItemIndex > -1 ? cart.items[existingItemIndex].quantity : 0;
      const availableStock = product.quantity; // Use current stock
      const maxAllowed = Math.min(availableStock, 5); // Cap at 5 or available stock
  
      const totalRequested = currentCartQuantity + parsedQuantity;
      if (totalRequested > maxAllowed) {
        return res.status(400).json({
          success: false,
          message: `Only ${maxAllowed} items available. You already have ${currentCartQuantity} in your cart.`
        });
      }
  
      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += parsedQuantity;
      } else {
        const effectivePrice = product.regularPrice * (1 - Math.max(product.productOffer || 0, product.category?.categoryOffer || 0) / 100);
        cart.items.push({ product: productId, quantity: parsedQuantity, price: effectivePrice });
      }
  
      const updatedCart = await cart.save();
      if (!updatedCart) {
        return res.status(500).json({ success: false, message: 'Cart update error' });
      }
  
      // Recalculate totals
      const populatedCart = await Cart.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
      });
      const subtotal = populatedCart.items.reduce((sum, item) => {
        const effectivePrice = item.product.regularPrice * (1 - Math.max(item.product.productOffer || 0, item.product.category?.categoryOffer || 0) / 100);
        return sum + (effectivePrice * item.quantity);
      }, 0);
      const shippingCost = subtotal > 1000 ? 0 : 50;
      const tax = subtotal * 0.1;
      const total = subtotal + shippingCost + tax;
  
      res.status(200).json({
        success: true,
        message: 'Product added to cart',
        cartCount: populatedCart.items.length,
        subtotal,
        shippingCost,
        tax,
        total
      });
    } catch (error) {
      console.error('Add to Cart Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
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
      const availableStock = product.quantity; // Total stock
      const maxAllowed = Math.min(availableStock, 5);
  
      if (action === 'increase') {
        if (cartItem.quantity < maxAllowed) {
          cartItem.quantity += 1;
        } else {
          return res.status(400).json({
            success: false,
            message: availableStock <= 5 ? `Only ${availableStock} available` : 'Maximum limit of 5 reached'
          });
        }
      } else if (action === 'decrease' && cartItem.quantity > 1) {
        cartItem.quantity -= 1;
      } else if (action === 'decrease' && cartItem.quantity === 1) {
        return res.status(400).json({ success: false, message: 'Minimum quantity is 1. Use remove to delete.' });
      }
  
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
  
      cart.items = cart.items.filter(item => item.product._id.toString() !== productId);
      await cart.save();
  
      const subtotal = cart.items.reduce((sum, item) => {
        const effectivePrice = item.product.regularPrice * (1 - Math.max(item.product.productOffer || 0, item.product.category?.categoryOffer || 0) / 100);
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

// In your cart controller
const getCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const { productId } = req.body;
    const cart = await Cart.findOne({ user: userId });
    const cartItem = cart?.items.find(item => item.product.toString() === productId);
    res.json({ quantity: cartItem ? cartItem.quantity : 0 });
  } catch (error) {
    console.error('Error fetching cart quantity:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const cleanupCartsForZeroQuantity = async (productId) => {
  try {
    const product = await Product.findById(productId);
    if (product && product.quantity === 0) {
      await Cart.updateMany(
        { 'items.product': productId },
        { $pull: { items: { product: productId } } }
      );
      console.log(`Cleaned up carts for product ${productId} with zero quantity`);
    }
  } catch (error) {
    console.error('Error cleaning up carts:', error);
  }
};

const getCartSummary = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login' });
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      populate: { path: 'category' }
    });

    let subtotal = 0;
    let shippingCost = 50;
    let discount = 0;

    if (cart && cart.items && cart.items.length > 0) {
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

    res.json({
      success: true,
      subtotal,
      shippingCost,
      tax,
      total,
      discount,
      cartCount: cart?.items.length || 0
    });
  } catch (error) {
    console.error('Error fetching cart summary:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
module.exports = {
    getCartPage,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    getCartContents,
    getCartQuantity,
    getCartSummary
};