const Product = require("../../models/productSchema");
const Category = require("../../models/CategorySchema");
const User = require("../../models/userSchema");

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = userId ? await User.findById(userId) : null;
        const productId = req.query.id;

        if (!productId) {
            return res.redirect("/pageNotFound");
        }

        const product = await Product.findById(productId).populate("category");
        if (!product || product.isBlocked || product.quantity <= 0) {
            return res.redirect("/pageNotFound");
        }

        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
            isBlocked: false,
            quantity: { $gt: 0 },
        }).limit(4);

        const productData = {
            _id: product._id,
            name: product.productName,
            category: product.category?.name || "Uncategorized",
            price: product.salePrice,
            originalPrice: product.originalPrice || null,
            image: product.productImage && product.productImage.length > 0 
                ? `/uploads/product-images/${product.productImage[0]}` 
                : "https://via.placeholder.com/300x300?text=No+Image",
            additionalImages: product.productImage && product.productImage.length > 1 
                ? product.productImage.slice(1).map(img => `/uploads/product-images/${img}`) 
                : [],
            features: product.features || ["No features listed"],
            description: product.description || "No description available",
        };

        const relatedProductsData = relatedProducts.map(p => ({
            _id: p._id,
            name: p.productName,
            category: p.category?.name || "Uncategorized",
            price: p.salePrice,
            originalPrice: p.originalPrice || null,
            image: p.productImage && p.productImage.length > 0 
                ? `/uploads/product-images/${p.productImage[0]}` 
                : "https://via.placeholder.com/300x300?text=No+Image",
        }));

        res.render("product-details", {
            user: userData,
            product: productData,
            reviews: [],
            relatedProducts: relatedProductsData,
        });
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetails,
};