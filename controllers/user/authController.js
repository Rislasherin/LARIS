const User = require('../../models/userSchema');
const category = require('../../models/CategorySchema')
const product = require('../../models/productSchema')
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { query } = require('express');
const Cart = require('../../models/CartSchema')
const Wallet = require('../../models/walletSchema');




function generateReferralCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

async function assignUniqueReferralCode(userId) {
    let referralCode;
    let isUnique = false;
    const maxAttempts = 10;
    let attempts = 0;

    while (!isUnique && attempts < maxAttempts) {
        referralCode = generateReferralCode();
        const existingUser = await User.findOne({ referralCode });
        if (!existingUser) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) {
        throw new Error('Unable to generate a unique referral code');
    }

    await User.findByIdAndUpdate(userId, { referralCode });
    return referralCode;
}

const pageNotFound = async (req, res) => {
    try {
        res.render('pageNotFound')

    } catch (error) {
        res.redirect('/pageNotFound')
    }
}


const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await category.find({ isListed: true });


        let productData = await product.find({
            status: "Available",
            category: { $in: categories.map(category => category._id.toString()) },
            quantity: { $gt: 0 }
        });

        if (productData.length === 0) {
            console.log("No products match the criteria");
            productData = [];
        } else {
            productData = productData.slice(0, 4);
        }

        let trendingProducts = await product.find({
            status: "Available",
            category: { $in: categories.map(category => category._id.toString()) },
            quantity: { $gt: 0 }
        }).sort({ salesCount: -1 }).limit(4);

        if (trendingProducts.length === 0) {
            console.log("No trending products match the criteria");
            trendingProducts = [];
        }

        if (user) {
            const userData = await User.findOne({ _id: user });
            res.render('home', {
                user: userData,
                products: productData,
                trendingProducts: trendingProducts
            });
        } else {
            return res.render('home', {
                products: productData,
                trendingProducts: trendingProducts
            });
        }
    } catch (error) {
        console.error('Home Page Error:', error);
        res.status(500).send('Server Error');
    }
};
const loadSignUpPage = async (req, res) => {
    try {
        res.render('signup')
    } catch (error) {
        console.log('Sign Up Page Not Found')
        res.status(500).send('Server Error')
    }
}






function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"Laris App" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: 'OTP for Verification',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

const signUp = async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword, referralCode } = req.body;

        if (password !== confirmPassword) {
            return res.status(401).json({ msg: "Passwords do not match", type: 'confirmPassword' });
        }

        const findUser = await User.findOne({ email: email });
        if (findUser) {
            return res.status(409).json({ msg: "Email already exists", type: "email" });
        }

        let referredBy = null;
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (referrer) {
                referredBy = referralCode;
            } else {
                return res.status(400).json({ msg: "Invalid referral code", type: "referralCode" });
            }
        }

        const otp = generateOTP();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(401).json({ msg: "Signup failed due to email error", type: 'toast' });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password, referredBy };

        console.log("OTP Sent:", otp);
        res.status(200).json({ msg: 'OTP has been sent to your email' });
    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(500).json({ msg: "Server error. Please try again later." });
    }
};

const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10);

        return passwordHash;

    } catch (error) {

    }
}

const loadverifyPage = async (req, res) => {
    try {
        res.render('verifyOtp');
    } catch (error) {
        console.log('Sign Up Page Not Found')
        res.status(500).send('Server Error')
    }
}


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        if (otp === req.session.userOtp) {
            const userData = req.session.userData;
            const passwordHash = await securePassword(userData.password);

            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'User already exists. Please login.' });
            }

            const newUser = new User({
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                password: passwordHash,
                referredBy: userData.referredBy || null
            });

            await newUser.save();

          
            await assignUniqueReferralCode(newUser._id);

         
            let wallet = await Wallet.findOne({ user: newUser._id });
            if (!wallet) {
                wallet = new Wallet({
                    user: newUser._id,
                    currency: 'INR',
                    balance: userData.referredBy ? 50 : 0 
                });
                await wallet.save();

                if (userData.referredBy) {
                    
                    wallet.transactions.push({
                        type: 'credit',
                        amount: 50,
                        description: 'Referral bonus for signing up',
                        date: new Date()
                    });
                    await wallet.save();

                    const referrer = await User.findOne({ referralCode: userData.referredBy });
                    if (referrer) {
                        const referrerWallet = await Wallet.findOne({ user: referrer._id });
                        if (referrerWallet) {
                            referrerWallet.balance += 200;
                            referrerWallet.transactions.push({
                                type: 'credit',
                                amount: 200,
                                description: `Referral bonus for referring ${newUser.name}`,
                                date: new Date()
                            });
                            await referrerWallet.save();
                        } else {
                        
                            const newReferrerWallet = new Wallet({
                                user: referrer._id,
                                currency: 'INR',
                                balance: 200
                            });
                            newReferrerWallet.transactions.push({
                                type: 'credit',
                                amount: 200,
                                description: `Referral bonus for referring ${newUser.name}`,
                                date: new Date()
                            });
                            await newReferrerWallet.save();
                        }
                    }
                }
            }

            req.session.user = {
                _id: newUser._id,
                email: newUser.email,
                name: newUser.name
            };

            req.session.userOtp = null;
            req.session.userData = null;

            res.json({ success: true, redirectUrl: '/' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
const resendOtp = async (req, res) => {
    try {

        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found in session' })
        }

        const otp = generateOTP();

        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resend OTP", otp);
            res.status(200).json({ success: true, message: 'OTP Resend Successfully' })

        } else {
            res.status(500).json({ success: false, message: 'Failed to resend OTP Please try again' })
        }

    } catch (error) {

        console.error('Error Resending OTP', error)
        res.status(500).json({ success: false, message: 'INternal Server Error, Please try again' })

    }
}

const loadLoginPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('login')
        } else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}


const login = async (req, res) => {
    try {

        const { email, password } = req.body;

        const findUser = await User.findOne({ isAdmin: 0, email: email });


        if (!email || !password) {
            return res.render('login', { message: 'Email and password are required' });
        }

        if (!findUser) {
            return res.render('login', { message: 'User not found' })
        }
        if (findUser.isBlocked) {
            return res.render('login', { message: 'User is Blocked by Admin' })
        }


        if (!findUser.password) {
            console.log("User record exists but password field is missing");
            return res.render('login', { message: 'Password not set for user' });
        }



        if (findUser.isBlocked) {
            if (findUser.googleId) {
                return res.render('login', { message: 'Please log in using Google' });
            }

            return res.render('login', { message: 'User is Blocked by Admin' });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            return res.render('login', { message: 'Invalid Password' })
        }

        req.session.user = {
            _id: findUser._id,
            email: findUser.email,
            name: findUser.name,


        }
        res.redirect('/')
        console.log("User logged in:", req.session.user);

    } catch (error) {

        console.error('Login Error', error);
        res.render('login', { message: 'Login Failed Try again' })


    }

}




const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log('Logout Error:', err);
                return res.redirect('/');
            }
            res.redirect('/login');
        });
    } catch (error) {
        console.log('Logout Error', error);
        res.redirect('/pageNotFound');
    }
};
const loadShopPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user._id }) : null;

        // Fetch all listed categories
        const categories = await category.find({ isListed: true });
        const categoryIds = categories.map(cat => cat._id);

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Build query object for filtering
        const query = {
            status: "Available",
            quantity: { $gt: 0 }
        };

        // Handle category filter
        const selectedCategoryName = req.query.category?.trim();
        let selectedCategoryId = null;
        if (selectedCategoryName) {
            const selectedCategory = await category.findOne({
                name: { $regex: new RegExp(`^${selectedCategoryName}$`, 'i') },
                isListed: true
            });
            if (selectedCategory) {
                selectedCategoryId = selectedCategory._id.toString();
                query.category = selectedCategory._id; // Filter by specific category
            }
        }
        // If no category is selected, include all listed categories
        if (!query.category) {
            query.category = { $in: categoryIds };
        }

        // Handle search query
        const searchQuery = req.query.query?.trim();
        if (searchQuery) {
            const escapedQuery = searchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            query.$or = [
                { productName: { $regex: escapedQuery, $options: 'i' } },
                { description: { $regex: escapedQuery, $options: 'i' } }
            ];
        }

        // Handle skin type filter (multiple selections)
        let selectedSkinType = req.query.skinType;
        if (selectedSkinType && !Array.isArray(selectedSkinType)) {
            selectedSkinType = [selectedSkinType];
        }
        if (selectedSkinType && selectedSkinType.length > 0 && !selectedSkinType.includes('')) {
            query.skintype = { $in: [...selectedSkinType, 'All Types', null, ''] };
        }

        // Handle skin concern filter (multiple selections)
        let selectedSkinConcern = req.query.skinConcern;
        if (selectedSkinConcern && !Array.isArray(selectedSkinConcern)) {
            selectedSkinConcern = [selectedSkinConcern];
        }
        if (selectedSkinConcern && selectedSkinConcern.length > 0 && !selectedSkinConcern.includes('')) {
            query.skinConcern = { $in: [...selectedSkinConcern, 'All Concerns', null, []] };
        }

        // Handle price range filter
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

        // Aggregation pipeline for products
        const pipeline = [
            { $match: query }, // Apply initial filters
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryData'
                }
            },
            {
                $unwind: {
                    path: '$categoryData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    effectivePrice: {
                        $cond: {
                            if: { $gt: [{ $ifNull: ['$productOffer', 0] }, 0] },
                            then: {
                                $multiply: [
                                    '$regularPrice',
                                    { $subtract: [1, { $divide: ['$productOffer', 100] }] }
                                ]
                            },
                            else: {
                                $cond: {
                                    if: { $gt: [{ $ifNull: ['$categoryData.categoryOffer', 0] }, 0] },
                                    then: {
                                        $multiply: [
                                            '$regularPrice',
                                            { $subtract: [1, { $divide: ['$categoryData.categoryOffer', 100] }] }
                                        ]
                                    },
                                    else: '$regularPrice'
                                }
                            }
                        }
                    },
                    discountPercent: {
                        $cond: {
                            if: { $gt: [{ $ifNull: ['$productOffer', 0] }, 0] },
                            then: '$productOffer',
                            else: { $ifNull: ['$categoryData.categoryOffer', 0] }
                        }
                    }
                }
            }
        ];

        // Apply price filter after calculating effectivePrice
        if (minPrice !== null || maxPrice !== null) {
            const priceMatch = {};
            if (minPrice !== null) priceMatch.$gte = minPrice;
            if (maxPrice !== null) priceMatch.$lte = maxPrice;
            pipeline.push({ $match: { effectivePrice: priceMatch } });
        }

        // Apply sorting
        let sortOption = {};
        const sortBy = req.query.sort || 'newest';
        switch (sortBy) {
            case 'price-low':
                sortOption = { effectivePrice: 1 };
                break;
            case 'price-high':
                sortOption = { effectivePrice: -1 };
                break;
            case 'popular':
                sortOption = { salesCount: -1 };
                break;
            default:
                sortOption = { createdAt: -1 }; // Newest first
        }
        pipeline.push({ $sort: sortOption });

        // Apply pagination
        pipeline.push({ $skip: skip }, { $limit: limit });

        // Execute pipeline to get products
        let products = await product.aggregate(pipeline);

        // Process products
        products = products.map(product => {
            product.effectivePrice = Math.floor(product.effectivePrice);
            product.category = product.categoryData || null;
            product.inWishlist = userData?.wishlist?.some(id => id.toString() === product._id.toString()) || false;
            return product;
        });

        // Count total products for pagination
        const countPipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryData'
                }
            },
            {
                $unwind: {
                    path: '$categoryData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    effectivePrice: {
                        $cond: {
                            if: { $gt: [{ $ifNull: ['$productOffer', 0] }, 0] },
                            then: {
                                $multiply: [
                                    '$regularPrice',
                                    { $subtract: [1, { $divide: ['$productOffer', 100] }] }
                                ]
                            },
                            else: {
                                $cond: {
                                    if: { $gt: [{ $ifNull: ['$categoryData.categoryOffer', 0] }, 0] },
                                    then: {
                                        $multiply: [
                                            '$regularPrice',
                                            { $subtract: [1, { $divide: ['$categoryData.categoryOffer', 100] }] }
                                        ]
                                    },
                                    else: '$regularPrice'
                                }
                            }
                        }
                    }
                }
            }
        ];
        if (minPrice !== null || maxPrice !== null) {
            const priceMatch = {};
            if (minPrice !== null) priceMatch.$gte = minPrice;
            if (maxPrice !== null) priceMatch.$lte = maxPrice;
            countPipeline.push({ $match: { effectivePrice: priceMatch } });
        }
        const totalProductsResult = await product.aggregate([...countPipeline, { $count: 'total' }]);
        const totalProducts = totalProductsResult[0]?.total || 0;
        const totalPages = Math.ceil(totalProducts / limit);

        // Get category counts
        const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
            const count = await product.countDocuments({
                category: cat._id,
                status: 'Available',
                quantity: { $gt: 0 }
            });
            return { _id: cat._id, name: cat.name, productCount: count, image: cat.image };
        }));

        // Get cart and wishlist counts
        const cart = user ? await Cart.findOne({ user: user._id }) : null;
        const cartCount = cart ? cart.items.length : 0;
        const wishlistCount = userData?.wishlist?.length || 0;

        // Save search history
        if (userData && (searchQuery || selectedCategoryId || selectedSkinType?.length || selectedSkinConcern?.length)) {
            userData.searchHistory = userData.searchHistory || [];
            userData.searchHistory.push({
                query: searchQuery || null,
                category: selectedCategoryId || null,
                skinType: selectedSkinType?.join(', ') || null,
                skinConcern: selectedSkinConcern?.join(', ') || null,
                searchedOn: new Date()
            });
            userData.searchHistory = userData.searchHistory.slice(0, 10);
            await userData.save();
        }

        // Render shop page
        res.render("shop", {
            user: userData,
            products,
            category: categoriesWithCounts,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategoryId,
            selectedSkinType, // Pass as array
            selectedSkinConcern, // Pass as array
            minPrice,
            maxPrice,
            sortBy,
            searchQuery: searchQuery || '',
            cartCount,
            wishlistCount
        });
    } catch (error) {
        console.error("Error loading shop page:", error);
        res.status(500).render("pageNotFound", { message: "Server Error" });
    }
};

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user._id }) : null;

        // Fetch all listed categories
        const categories = await category.find({ isListed: true });
        const categoryIds = categories.map(cat => cat._id);

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Build query object for filtering
        const query = {
            status: 'Available',
            quantity: { $gt: 0 }
        };

        // Handle category filter
        const selectedCategoryName = req.query.category?.trim();
        let selectedCategoryId = null;
        if (selectedCategoryName) {
            const selectedCategory = await category.findOne({
                name: { $regex: new RegExp(`^${selectedCategoryName}$`, 'i') },
                isListed: true
            });
            if (selectedCategory) {
                selectedCategoryId = selectedCategory._id.toString();
                query.category = selectedCategory._id; // Filter by specific category
            }
        }
        // If no category is selected, include all listed categories
        if (!query.category) {
            query.category = { $in: categoryIds };
        }

        // Handle search query
        const searchQuery = req.query.query?.trim();
        if (searchQuery) {
            const escapedQuery = searchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            query.$or = [
                { productName: { $regex: escapedQuery, $options: 'i' } },
                { description: { $regex: escapedQuery, $options: 'i' } }
            ];
        }

        // Handle skin type filter (multiple selections)
        let selectedSkinType = req.query.skinType;
        if (selectedSkinType && !Array.isArray(selectedSkinType)) {
            selectedSkinType = [selectedSkinType];
        }
        if (selectedSkinType && selectedSkinType.length > 0 && !selectedSkinType.includes('')) {
            query.skintype = { $in: [...selectedSkinType, 'All Types', null, ''] };
        }

        // Handle skin concern filter (multiple selections)
        let selectedSkinConcern = req.query.skinConcern;
        if (selectedSkinConcern && !Array.isArray(selectedSkinConcern)) {
            selectedSkinConcern = [selectedSkinConcern];
        }
        if (selectedSkinConcern && selectedSkinConcern.length > 0 && !selectedSkinConcern.includes('')) {
            query.skinConcern = { $in: [...selectedSkinConcern, 'All Concerns', null, []] };
        }

        // Handle price range filter
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;

        // Aggregation pipeline for products
        const pipeline = [
            { $match: query }, // Apply initial filters
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryData'
                }
            },
            {
                $unwind: {
                    path: '$categoryData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    effectivePrice: {
                        $cond: {
                            if: { $gt: [{ $ifNull: ['$productOffer', 0] }, 0] },
                            then: {
                                $multiply: [
                                    '$regularPrice',
                                    { $subtract: [1, { $divide: ['$productOffer', 100] }] }
                                ]
                            },
                            else: {
                                $cond: {
                                    if: { $gt: [{ $ifNull: ['$categoryData.categoryOffer', 0] }, 0] },
                                    then: {
                                        $multiply: [
                                            '$regularPrice',
                                            { $subtract: [1, { $divide: ['$categoryData.categoryOffer', 100] }] }
                                        ]
                                    },
                                    else: '$regularPrice'
                                }
                            }
                        }
                    },
                    discountPercent: {
                        $cond: {
                            if: { $gt: [{ $ifNull: ['$productOffer', 0] }, 0] },
                            then: '$productOffer',
                            else: { $ifNull: ['$categoryData.categoryOffer', 0] }
                        }
                    }
                }
            }
        ];

        // Apply price filter after calculating effectivePrice
        if (minPrice !== null || maxPrice !== null) {
            const priceMatch = {};
            if (minPrice !== null) priceMatch.$gte = minPrice;
            if (maxPrice !== null) priceMatch.$lte = maxPrice;
            pipeline.push({ $match: { effectivePrice: priceMatch } });
        }

        // Apply sorting
        let sortOption = {};
        const sortBy = req.query.sort || 'newest';
        switch (sortBy) {
            case 'price-low':
                sortOption = { effectivePrice: 1 };
                break;
            case 'price-high':
                sortOption = { effectivePrice: -1 };
                break;
            case 'popular':
                sortOption = { salesCount: -1 };
                break;
            default:
                sortOption = { createdAt: -1 }; // Newest first
        }
        pipeline.push({ $sort: sortOption });

        // Apply pagination
        pipeline.push({ $skip: skip }, { $limit: limit });

        // Execute pipeline to get products
        let products = await product.aggregate(pipeline);

        // Process products
        products = products.map(product => {
            product.effectivePrice = Math.floor(product.effectivePrice);
            product.category = product.categoryData || null;
            product.inWishlist = userData?.wishlist?.some(id => id.toString() === product._id.toString()) || false;
            return product;
        });

        // Count total products for pagination
        const countPipeline = [
            { $match: query },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryData'
                }
            },
            {
                $unwind: {
                    path: '$categoryData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    effectivePrice: {
                        $cond: {
                            if: { $gt: [{ $ifNull: ['$productOffer', 0] }, 0] },
                            then: {
                                $multiply: [
                                    '$regularPrice',
                                    { $subtract: [1, { $divide: ['$productOffer', 100] }] }
                                ]
                            },
                            else: {
                                $cond: {
                                    if: { $gt: [{ $ifNull: ['$categoryData.categoryOffer', 0] }, 0] },
                                    then: {
                                        $multiply: [
                                            '$regularPrice',
                                            { $subtract: [1, { $divide: ['$categoryData.categoryOffer', 100] }] }
                                        ]
                                    },
                                    else: '$regularPrice'
                                }
                            }
                        }
                    }
                }
            }
        ];
        if (minPrice !== null || maxPrice !== null) {
            const priceMatch = {};
            if (minPrice !== null) priceMatch.$gte = minPrice;
            if (maxPrice !== null) priceMatch.$lte = maxPrice;
            countPipeline.push({ $match: { effectivePrice: priceMatch } });
        }
        const totalProductsResult = await product.aggregate([...countPipeline, { $count: 'total' }]);
        const totalProducts = totalProductsResult[0]?.total || 0; // Fixed line
        const totalPages = Math.ceil(totalProducts / limit);

        // Get category counts
        const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
            const count = await product.countDocuments({
                category: cat._id,
                status: 'Available',
                quantity: { $gt: 0 }
            });
            return { _id: cat._id, name: cat.name, productCount: count, image: cat.image };
        }));

        // Get cart and wishlist counts
        const cart = user ? await Cart.findOne({ user: user._id }) : null;
        const cartCount = cart ? cart.items.length : 0;
        const wishlistCount = userData?.wishlist?.length || 0;

        // Save search history
        if (userData && (searchQuery || selectedCategoryId || selectedSkinType?.length || selectedSkinConcern?.length)) {
            userData.searchHistory = userData.searchHistory || [];
            userData.searchHistory.push({
                query: searchQuery || null,
                category: selectedCategoryId || null,
                skinType: selectedSkinType?.join(', ') || null,
                skinConcern: selectedSkinConcern?.join(', ') || null,
                searchedOn: new Date()
            });
            userData.searchHistory = userData.searchHistory.slice(0, 10);
            await userData.save();
        }

        // Render shop page
        res.render("shop", {
            user: userData,
            products,
            category: categoriesWithCounts,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategoryId,
            selectedSkinType, // Pass as array
            selectedSkinConcern, // Pass as array
            minPrice,
            maxPrice,
            sortBy,
            searchQuery: searchQuery || '',
            cartCount,
            wishlistCount
        });
    } catch (error) {
        console.error("Error while filtering products:", error);
        res.redirect("/pageNotFound");
    }
};

// Get recent searches
const getSearchHistory = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      const user = await User.findById(userId, 'searchHistory');
      const searches = user.searchHistory
        .filter(s => s.query) 
        .sort((a, b) => b.searchedOn - a.searchedOn) 
        .slice(0, 5); 
  
      res.json({ success: true, searches });
    } catch (error) {
      console.error('Error fetching search history:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  // Save search
  const saveSearch = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid query' });
      }
  
      const user = await User.findById(userId);
      user.searchHistory = user.searchHistory || [];
    
      user.searchHistory = user.searchHistory.filter(s => s.query !== query);
    
      user.searchHistory.unshift({ query, searchedOn: new Date() });
    
      user.searchHistory = user.searchHistory.slice(0, 10);
      await user.save();
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving search:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  

  const deleteSearch = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid query' });
      }
  
      await User.updateOne(
        { _id: userId },
        { $pull: { searchHistory: { query } } }
      );
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting search:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  const clearSearchHistory = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Please login' });
      }
  
      await User.updateOne(
        { _id: userId },
        { $set: { searchHistory: [] } }
      );
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing search history:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };

module.exports = {
    loadHomePage,
    pageNotFound,
    loadLoginPage,
    loadSignUpPage,
    signUp,
    login,
    verifyOtp,
    resendOtp,
    logout,
    loadverifyPage,
    loadShopPage,
    filterProduct,
    getSearchHistory,
    saveSearch,
    clearSearchHistory,
    deleteSearch



}