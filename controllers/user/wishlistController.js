const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id; // Ensure _id is accessed correctly
        if (!userId) {
            return res.status(401).render('error', { message: "Please login to view your wishlist" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).render('error', { message: "User not found" });
        }

        // If the user has no wishlist or it's empty
        if (!user.wishlist || user.wishlist.length === 0) {
            // Fetch some general recommended products when wishlist is empty
            const recommendedProducts = await Product.find({
                status: 'Available',
                quantity: { $gt: 0 }
            }).limit(4).populate('category');
            return res.render('wishlist', { wishlistItems: [], recommendedProducts });
        }

        // Reverse the wishlist array to show last added first
        const reversedWishlist = [...user.wishlist].reverse();

        // Fetch products in the reversed order
        const products = await Product.find({ _id: { $in: reversedWishlist } }).populate('category');

        // Transform products to wishlistItems format, maintaining the reversed order
        const wishlistItems = reversedWishlist.map(id => {
            const product = products.find(p => p._id.toString() === id.toString());
            return product ? { _id: product._id, product } : null;
        }).filter(item => item !== null); // Filter out any null items in case of missing products

        // Fetch recommended products based on wishlist categories or skin types
        const wishlistCategories = [...new Set(products.map(p => p.category?._id?.toString()))].filter(Boolean);
        const wishlistSkinTypes = [...new Set(products.map(p => p.skintype))].filter(Boolean);

        const recommendedProducts = await Product.find({
            _id: { $nin: user.wishlist }, // Exclude wishlist items
            status: 'Available',
            quantity: { $gt: 0 },
            $or: [
                { category: { $in: wishlistCategories } },
                { skintype: { $in: wishlistSkinTypes } }
            ]
        }).limit(4).populate('category');

        res.render('wishlist', { wishlistItems, recommendedProducts });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.status(500).render('error', { message: "Failed to load wishlist" });
    }
};

const toggleWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to add items to your wishlist" });
        }

        const { productId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const productIndex = user.wishlist.indexOf(productId);
        let action = '';

        if (productIndex === -1) {
            user.wishlist.push(productId);
            action = 'added to';
        } else {
            user.wishlist.splice(productIndex, 1);
            action = 'removed from';
        }

        await user.save();

        // Fetch the updated wishlist products in reversed order (last added first)
        const reversedWishlist = [...user.wishlist].reverse();
        const products = await Product.find({ _id: { $in: reversedWishlist } }).populate('category');
        const wishlistItems = reversedWishlist.map(id => {
            const product = products.find(p => p._id.toString() === id.toString());
            return product ? { _id: product._id, product } : null;
        }).filter(item => item !== null);

        res.json({
            success: true,
            message: `Product ${action} wishlist`,
            wishlistCount: user.wishlist.length,
            wishlistItems // Return the full updated wishlist items
        });
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
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
        console.error("Error clearing wishlist:", error.stack); // Log full error stack
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};
module.exports = {
    loadWishlist,
    toggleWishlist,
    clearWishlist
};