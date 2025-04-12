const Product = require("../../models/productSchema");
const Category = require("../../models/CategorySchema");
const User = require("../../models/userSchema");
const Cart = require('../../models/CartSchema');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = userId ? await User.findById(userId) : null;
    const productId = req.query.id || req.params.id;
    if (!productId) {
      return res.redirect("/pageNotFound");
    }

    const product = await Product.findById(productId).populate("category");
    if (!product || product.isBlocked || product.quantity <= 0) {
      return res.redirect("/pageNotFound");
    }

    let isInWishlist = false;
    if (userData && userData.wishlist) {
      isInWishlist = userData.wishlist.some(id => id.toString() === productId.toString());
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const cartCount = cart ? cart.items.length : 0;
    let cartCountForProduct = 0; // Define it here with a default value
    if (cart && cart.items) { // Add check for cart.items to avoid errors
      const cartItem = cart.items.find(item => item.product && item.product._id.toString() === productId);
      if (cartItem) {
        cartCountForProduct = cartItem.quantity;
      }
    }

    if (!req.session.recentlyViewed) {
      req.session.recentlyViewed = [];
    }
    req.session.recentlyViewed = req.session.recentlyViewed.filter(id => id !== productId);
    req.session.recentlyViewed.unshift(productId);
    if (req.session.recentlyViewed.length > 6) {
      req.session.recentlyViewed = req.session.recentlyViewed.slice(0, 6);
    }

    let recentlyViewedProducts = [];
    if (req.session.recentlyViewed && req.session.recentlyViewed.filter(id => id !== productId).length > 0) {
      recentlyViewedProducts = await Product.find({
        _id: { $in: req.session.recentlyViewed.filter(id => id !== productId) },
        isBlocked: false,
        quantity: { $gt: 0 }
      }).limit(5);
    } else {
      recentlyViewedProducts = await Product.find({
        _id: { $ne: productId },
        isBlocked: false,
        quantity: { $gt: 0 }
      }).sort({ rating: -1 }).limit(5);
    }

    let relatedProducts = await Product.find({
      category: product.category._id,
      brand: product.brand,
      _id: { $ne: productId },
      isBlocked: false,
      quantity: { $gt: 0 }
    }).limit(2);

    if (relatedProducts.length < 4) {
      const categoryProducts = await Product.find({
        category: product.category._id,
        _id: { $ne: productId },
        brand: { $ne: product.brand },
        isBlocked: false,
        quantity: { $gt: 0 }
      }).limit(4 - relatedProducts.length);
      relatedProducts = [...relatedProducts, ...categoryProducts];
    }

    if (relatedProducts.length < 4) {
      const popularProducts = await Product.find({
        _id: { $ne: productId },
        category: { $ne: product.category._id },
        isBlocked: false,
        quantity: { $gt: 0 }
      }).sort({ rating: -1 }).limit(4 - relatedProducts.length);
      relatedProducts = [...relatedProducts, ...popularProducts];
    }

    const productData = {
      _id: product._id,
      name: product.productName,
      category: product.category?.name || "Uncategorized",
      price: `₹${product.salePrice.toLocaleString()}`,
      originalPrice: product.regularPrice ? `₹${product.regularPrice.toLocaleString()}` : null,
      image: product.productImage && product.productImage.length > 0
        ? `/uploads/product-images/${product.productImage[0]}`
        : "/images/placeholder.jpg",
      additionalImages: product.productImage && product.productImage.length > 1
        ? product.productImage.slice(1).map((img) => `/uploads/product-images/${img}`)
        : [],
      features: product.features || ["No features listed"],
      description: product.description || "No description available",
      howToUse: product.howToUse || "No usage instructions available",
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      offerPercentage: product.regularPrice && product.regularPrice > product.salePrice 
        ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100) 
        : null,
      skinType: product.skintype ? [product.skintype] : [],
      skinConcerns: product.skinConcern ? [product.skinConcern] : [],
      brand: product.brand || "Unknown Brand",
      quantity: product.quantity,
      maxQuantity: Math.min(product.quantity, 5)
    };

    const relatedProductsData = relatedProducts.map((p) => ({
      _id: p._id,
      name: p.productName,
      category: p.category?.name || "Uncategorized",
      price: `₹${p.salePrice.toLocaleString()}`,
      originalPrice: p.regularPrice ? `₹${p.regularPrice.toLocaleString()}` : null,
      image: p.productImage && p.productImage.length > 0
        ? `/uploads/product-images/${p.productImage[0]}`
        : "/images/placeholder.jpg",
      rating: p.rating || 0,
      reviewCount: p.reviewCount || 0,
    }));

    const recentlyViewedData = recentlyViewedProducts.map((p) => ({
      _id: p._id,
      name: p.productName,
      price: `₹${p.salePrice.toLocaleString()}`,
      image: p.productImage && p.productImage.length > 0
        ? `/uploads/product-images/${p.productImage[0]}`
        : "/images/placeholder.jpg",
    }));

    res.render("product-details", {
      user: userData,
      product: productData,
      reviews: [],
      relatedProducts: relatedProductsData,
      recentlyViewedProducts: recentlyViewedData,
      cartCount,
      cartCountForProduct, // Now always defined
      isInWishlist
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.redirect("/pageNotFound");
  }
};


const getProductStock = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ quantity: product.quantity });
  } catch (error) {
    console.error('Error fetching product stock:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  productDetails,
  getProductStock,
};