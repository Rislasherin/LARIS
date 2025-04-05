const User = require('../../models/userSchema');
const category = require('../../models/CategorySchema')
const product = require('../../models/productSchema')
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { query } = require('express');
const Cart = require('../../models/CartSchema')



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
        const { name, email, phone, password, confirmPassword } = req.body

        if (password !== confirmPassword) {

            return res.status(401).json({ msg: "Password do no match", type: 'confirmPassword' })
        }

        const findUser = await User.findOne({ email: email })

        if (findUser) {

            return res.status(409).json({ msg: "Email already exist", type: "email" })
        }

        const otp = generateOTP()

        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {

            return res.status(401).json({ msg: "Signup failed", type: 'toast' })
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        console.log("OTP Send", otp);


        res.status(200).json({ msg: 'Otp has been sent to you email' })

    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(500).json({ msg: "Server error. Please try again later." });
    }
}

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

        console.log('OTP', otp);

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const existingUser = await User.findOne({ email: user.email });

            if (existingUser) {
                return res.status(400).json({ success: false, message: 'User already exists. Please login.' });
            }

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                googleId: user.googleId || null,
                password: passwordHash
            });

            await saveUserData.save();

            req.session.user = {
                _id: saveUserData._id,
                email: saveUserData.email,
                name: saveUserData.name
            };

            res.json({ success: true, redirectUrl: '/' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP Please try again' });
        }
    } catch (error) {
        console.error('Error verifying OTP', error);
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

        const categories = await category.find({ isListed: true });
        const categoryIds = categories.map(cat => cat._id.toString());

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Build query object
        const query = {
            status: "Available",
            quantity: { $gt: 0 }
        };

        // Category filter
        const selectedCategoryName = req.query.category;
        let selectedCategoryId = null;
        if (selectedCategoryName) {
            const selectedCategory = await category.findOne({ 
                name: { $regex: new RegExp(`^${selectedCategoryName}$`, 'i') }, 
                isListed: true 
            });
            if (selectedCategory) {
                selectedCategoryId = selectedCategory._id;
                query.category = selectedCategoryId;
            } else {
              
                query.category = null;
            }
        } else {
            query.category = { $in: categoryIds };
        }

      
        const searchQuery = req.query.query?.trim();
        if (searchQuery) {
            query.$or = [
                { productName: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Skin type filter
        const selectedSkinType = req.query.skinType;
        if (selectedSkinType && selectedSkinType !== '') {
            query.skintype = selectedSkinType;
        }

        // Skin concern filter
        const selectedSkinConcern = req.query.skinConcern;
        if (selectedSkinConcern && selectedSkinConcern !== '') {
            query.skinConcern = selectedSkinConcern;
        }

        // Price range filter
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
        if (minPrice || maxPrice) {
            query.salePrice = {};
            if (minPrice) query.salePrice.$gte = minPrice;
            if (maxPrice) query.salePrice.$lte = maxPrice;
        }

        // Sorting
        let sortOption = {};
        switch (req.query.sort) {
            case 'price-low':
                sortOption = { salePrice: 1 };
                break;
            case 'price-high':
                sortOption = { salePrice: -1 };
                break;
            case 'popular':
                sortOption = { salesCount: -1 };
                break;
            default:
                sortOption = { createdAt: -1 }; // newest
        }

        // Execute queries
        const totalProducts = await product.countDocuments(query);
        const products = await product
            .find(query)
            .populate('category')
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        // Apply offers
        products.forEach(product => {
            if (product.productOffer && product.productOffer > 0) {
                product.salePrice = Math.floor(product.regularPrice * (1 - product.productOffer / 100));
            } else if (product.category?.categoryOffer > 0) {
                product.productOffer = product.category.categoryOffer;
                product.salePrice = Math.floor(product.regularPrice * (1 - product.category.categoryOffer / 100));
            }
        });

        const totalPages = Math.ceil(totalProducts / limit);

        // Category counts for sidebar
        const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
            const count = await product.countDocuments({
                category: cat._id,
                status: 'Available',
                quantity: { $gt: 0 }
            });
            return { _id: cat._id, name: cat.name, productCount: count, image: cat.image };
        }));

        // Cart count
        const cart = user ? await Cart.findOne({ user: user._id }) : null;
        const cartCount = cart ? cart.items.length : 0;

        res.render("shop", {
            user: userData,
            products,
            category: categoriesWithCounts,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategoryId: selectedCategoryId ? selectedCategoryId.toString() : null,
            selectedSkinType,
            selectedSkinConcern,
            minPrice,
            maxPrice,
            sortBy: req.query.sort || 'newest',
            searchQuery: searchQuery || '',
            cartCount
        });

    } catch (error) {
        console.error("Error loading shop page:", error);
        res.status(500).send("Server Error");
    }
};
const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        const categories = await category.find({ isListed: true });
        const categoriesWithCounts = await Promise.all(categories.map(async (cat) => {
            const count = await product.countDocuments({
                category: cat._id,
                status: 'Available',
                quantity: { $gt: 0 }
            });
            return { _id: cat._id, name: cat.name, productCount: count, image: cat.image };
        }));

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const query = {
            status: 'Available',
            quantity: { $gt: 0 },
            $and: []
        };

        const selectedCategoryId = req.query.category || null;
        if (selectedCategoryId) {
            query.category = selectedCategoryId;
        }


        if (req.query.query) {
            const searchQuery = req.query.query.trim();
            if (searchQuery) {
                query.$text = { $search: searchQuery };
            }
        }


        const selectedSkinType = req.query.skinType || null;
        if (selectedSkinType && selectedSkinType !== '') {
            query.$and.push({
                $or: [
                    { skintype: selectedSkinType },
                    { skintype: "All Types" },
                    { skintype: { $exists: false } },
                    { skintype: null },
                    { skintype: "" }
                ]
            });
        }
        const selectedSkinConcern = req.query.skinConcern || null;
        if (selectedSkinConcern && selectedSkinConcern !== '') {
            query.$and.push({
                $or: [
                    { skinConcern: { $in: [selectedSkinConcern] } },
                    { skinConcern: { $in: ["All Concerns"] } },
                    { skinConcern: { $exists: false } },
                    { skinConcern: null },
                    { skinConcern: [] }
                ]
            });
        }
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
        if (minPrice || maxPrice) {
            query.salePrice = {};
            if (minPrice) query.salePrice.$gte = minPrice;
            if (maxPrice) query.salePrice.$lte = maxPrice;
        }

        console.log("Filter query:", JSON.stringify(query, null, 2));


        const products = await product.find(query)
            .skip(skip)
            .limit(limit);

        const totalProducts = await product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        if (userData && (selectedCategoryId || req.query.query || selectedSkinType || selectedSkinConcern)) {
            const searchEntry = {
                category: selectedCategoryId || null,
                searchedOn: new Date(),
                query: req.query.query || null,
                skinType: selectedSkinType || null,
                skinConcern: selectedSkinConcern || null
            };
            userData.searchHistory = userData.searchHistory || [];
            userData.searchHistory.push(searchEntry);
            await userData.save();
        }

        res.render("shop", {
            user: userData,
            products: products,
            category: categoriesWithCounts,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategoryId,
            selectedSkinType,
            selectedSkinConcern,
            minPrice,
            maxPrice,
            searchQuery: req.query.query || ''
        });

    } catch (error) {
        console.error("Error while filtering products:", error);
        res.redirect("/pageNotFound");
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



}