const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(401).render('error', { message: 'Please login to view your wishlist' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).render('error', { message: 'User not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const skip = (page - 1) * limit; 

    let wishlistItems = [];
    let totalItems = 0;

    if (!user.wishlist || user.wishlist.length === 0) {
      const recommendedProducts = await Product.find({
        status: 'Available',
        quantity: { $gt: 0 },
      })
        .limit(4)
        .populate('category');
      return res.render('wishlist', {
        wishlistItems: [],
        recommendedProducts,
        pagination: { currentPage: 1, totalPages: 0, hasPrevPage: false, hasNextPage: false, totalItems: 0 },
      });
    }

  
    const reversedWishlist = [...user.wishlist].reverse();
    totalItems = reversedWishlist.length;

  
    const paginatedWishlist = reversedWishlist.slice(skip, skip + limit);

  
    const products = await Product.find({ _id: { $in: paginatedWishlist } }).populate('category');

    wishlistItems = paginatedWishlist
      .map((id) => {
        const product = products.find((p) => p._id.toString() === id.toString());
        return product ? { _id: product._id, product } : null;
      })
      .filter((item) => item !== null);


    const wishlistCategories = [...new Set(products.map((p) => p.category?._id?.toString()))].filter(Boolean);
    const wishlistSkinTypes = [...new Set(products.map((p) => p.skintype))].filter(Boolean);

    const recommendedProducts = await Product.find({
      _id: { $nin: user.wishlist },
      status: 'Available',
      quantity: { $gt: 0 },
      $or: [{ category: { $in: wishlistCategories } }, { skintype: { $in: wishlistSkinTypes } }],
    })
      .limit(4)
      .populate('category');


    const totalPages = Math.ceil(totalItems / limit);
    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      totalItems: totalItems,
    };

    res.render('wishlist', { wishlistItems, recommendedProducts, pagination });
  } catch (error) {
    console.error('Error loading wishlist:', error);
    res.status(500).render('error', { message: 'Failed to load wishlist' });
  }
};

const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to add items to your wishlist' });
    }

    const { productId } = req.body;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

  
    const product = await Product.findOne({ _id: productId, status: 'Available' });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    const user = await User.findById(userId).select('wishlist');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isInWishlist = user.wishlist.includes(productId);
    let action = '';

  
    if (isInWishlist) {
      await User.updateOne(
        { _id: userId, wishlist: productId },
        { $pull: { wishlist: productId } }
      );
      action = 'removed from';
    } else {
      await User.updateOne(
        { _id: userId },
        { $addToSet: { wishlist: productId } }
      );
      action = 'added to';
    }


    const updatedUser = await User.findById(userId).select('wishlist');
    const reversedWishlist = [...updatedUser.wishlist].reverse();
    const products = await Product.find({ _id: { $in: reversedWishlist }, status: 'Available' }).populate('category');
    const wishlistItems = reversedWishlist
      .map(id => {
        const product = products.find(p => p._id.toString() === id.toString());
        return product ? { _id: product._id, product } : null;
      })
      .filter(item => item !== null);

    res.json({
      success: true,
      message: `Product ${action} wishlist`,
      wishlistCount: updatedUser.wishlist.length,
      wishlistItems: wishlistItems.map(item => ({
        _id: item._id.toString(),
        product: {
          _id: item.product._id,
          productName: item.product.productName,
          productImage: item.product.productImage,
          regularPrice: item.product.regularPrice,
          productOffer: item.product.productOffer,
          category: item.product.category ? {
            name: item.product.category.name,
            categoryOffer: item.product.category.categoryOffer
          } : null,
          skintype: item.product.skintype,
          description: item.product.description
        }
      }))
    });
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    if (error.name === 'VersionError') {
      return res.status(409).json({ success: false, message: 'Wishlist update conflict, please try again' });
    }
    res.status(500).json({ success: false, message: 'An error occurred while updating the wishlist' });
  }
};
const clearWishlist = async (req, res) => {
    try {
       
        const userId = req.session.user?._id;
        if (!userId) {
            console.log('No user ID found in session');
            return res.status(401).json({ success: false, message: "Please login to clear your wishlist" });
        }

        console.log('User ID:', userId);
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found for ID:', userId);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log('Before clearing wishlist:', user.wishlist);
        user.wishlist = [];
        await user.save();
        console.log('After clearing wishlist:', user.wishlist);

        res.json({ 
            success: true, 
            message: "Wishlist cleared",
            wishlistCount: 0,
            wishlistItems: []
        });
    } catch (error) {
        console.error("Error clearing wishlist:", error.stack); 
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};
module.exports = {
    loadWishlist,
    toggleWishlist,
    clearWishlist
};