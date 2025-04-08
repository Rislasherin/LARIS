const Product = require("../../models/productSchema");
const Category = require("../../models/CategorySchema");
const Address = require('../../models/addressSchema')
const User = require("../../models/userSchema");
const Cart = require('../../models/CartSchema')
const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = userId ? await User.findById(userId) : null;
    const productId = req.query.id || req.params.id;
    if (!productId) {
      return res.redirect("/pageNotFound");
    }

    const product = await Product.findById(productId).populate("category");
    

    let isInWishlist = false;
    if (userData && userData.wishlist) {
      isInWishlist = userData.wishlist.some(id => id.toString() === productId.toString());
    }


    if (!product && product.isBlocked && product.quantity <= 0) {
      return res.redirect("/pageNotFound");
    }

const cart = await Cart.findOne({ user: userId });
const cartCount = cart ? cart.items.length : 0;
  
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
  offerPercentage: product.productOffer || 0,
  skinType: product.skintype ? [product.skintype] : [],
  skinConcerns: product.skinConcern ? [product.skinConcern] : [],
  brand: product.brand || "Unknown Brand",
  variants: product.variants.map(variant => ({
      size: variant.size,
      quantity: variant.quantity
  }))
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
  isInWishlist
});
} catch (error) {
console.error("Error fetching product details:", error);
res.redirect("/pageNotFound");
}
};
module.exports = {
    productDetails,
}; 