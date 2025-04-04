const User = require('../../models/userSchema');
const category = require('../../models/CategorySchema')
const product = require('../../models/productSchema')
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { query } = require('express');





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
        const categories = await category.find({isListed: true});
       
        
        let productData = await product.find({
            status: "Available", 
            category: {$in: categories.map(category => category._id.toString())},
            quantity: {$gt: 0}
        });
        
        
        
        if (productData.length === 0) {
            console.log("No products match the criteria");
            productData = []; 
        } else {
            productData = productData.slice(0, 4);
        }

        if(user){
            const userData = await User.findOne({_id: user});
            res.render('home', {user: userData, products: productData});
        } else {
            return res.render('home', {products: productData});
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

async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'OTP for Verification',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        })

        return info.accepted.length > 0



    } catch (error) {
        console.error("Error for sending email",error)
        return false
    }
}



const signUp = async (req, res) => {
   
    try {
        const { name, email, phone, password, confirmPassword } = req.body
        
        if(password !== confirmPassword){
            // return res.render('signup',{message:'Password not matched'})
            return res.status(401).json({msg:"Password do no match", type: 'confirmPassword'})
        }

        const findUser = await User.findOne({email:email})

        if(findUser){
            // return res.render('signup',{message:'User already exists'})
            return res.status(409).json({msg: "Email already exist", type: "email"})
        }

        const otp = generateOTP()

        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            // return res.json("email-error")
            return res.status(401).json({msg:"Signup failed", type : 'toast'})
        }
        
        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password};

        console.log("OTP Send",otp);

        // res.render('verifyOtp');
        res.status(200).json({msg: 'Otp has been sent to you email'})
    
    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(500).json({ msg: "Server error. Please try again later." });
    }
}

const securePassword = async (password) => {
    try {
        
        const passwordHash = await bcrypt.hash(password,10);

        return passwordHash;

    } catch (error) {
        
    }
}

const loadverifyPage = async (req,res)=>{
    try {
        res.render('verifyOtp');
    } catch (error) {
        console.log('Sign Up Page Not Found')
        res.status(500).send('Server Error')
    }
}


const verifyOtp = async (req, res) => {
    try{
        const {otp} = req.body;

        console.log('OTP',otp)

        if(otp===req.session.userOtp){
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

            req.session.user = saveUserData._id;

            res.json({success:true,redirectUrl:'/'})

        } else{
            res.status(400).json({success:false,message:'Invalid OTP Please try again'})
        }

    } catch (error) {
        console.error('Error verifying OTP',error)
        res.status(500).json({success:false,message:'Server Error'})
    }
}

const resendOtp = async (req, res) => {
    try {
        
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:'Email not found in session'})
        }

        const otp = generateOTP();

        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);

        if(emailSent){
            console.log("Resend OTP",otp);
            res.status(200).json({success:true,message:'OTP Resend Successfully'})
            
        } else{
            res.status(500).json({success:false,message:'Failed to resend OTP Please try again'})
        }

    } catch (error) {

        console.error('Error Resending OTP',error)
        res.status(500).json({success:false,message:'INternal Server Error, Please try again'})
        
    }
}

const loadLoginPage = async (req, res) => {
    try {
        if(!req.session.user){
            return res.render('login')
        } else{
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}


const login = async (req, res) => {
    try {
        
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render('login',{message:'User not found'})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:'User is Blocked by Admin'})
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

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render('login',{message:'Invalid Password'})
        }

        req.session.user = findUser._id;
        res.redirect('/')
        console.log("User logged in:", req.session.user);

    } catch (error) {

        console.error('Login Error',error);
        res.render('login',{message:'Login Failed Try again'})
        
        
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
        const userData = user ? await User.findById(user) : null;
        
       
        const categories = await category.find({ isListed: true });
        const categoryIds = categories.map(cat => cat._id.toString());
        
        
        const selectedCategory = req.query.category;
        const skinType = req.query.skinType; 
        const skinConcern = req.query.skinConcern; 
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
        
   
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = 9;
        const skip = (page - 1) * limit;
        
      
        const filter = { 
            status: "Available", 
            quantity: { $gt: 0 },
            salePrice: { $gte: minPrice }
        };
        
        if (maxPrice && maxPrice < Infinity) {
            filter.salePrice.$lte = maxPrice;
        }
        
     
        if (selectedCategory && categoryIds.includes(selectedCategory)) {
            filter.category = selectedCategory;
        } else {
            filter.category = { $in: categoryIds };
        }
        
     
        if (skinType) {
            filter.skinType = skinType;
        }
        
     
        if (skinConcern) {
            filter.skinConcern = skinConcern;
        }
        
        console.log("Filter criteria:", filter);
        
 
        const products = await product.find(filter)
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);
            
        console.log("Products found:", products.length);
        
   
        if (products.length > 0) {
            console.log("Sample product:", products[0]);
        } else {
            console.log("No products found matching criteria");
        }
        
        const totalProducts = await product.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);
        
        res.render('shop', {
            user: userData,
            products,
            categories,
            totalProducts,
            currentPage: page,
            totalPages,
            selectedCategoryId: selectedCategory || null,
            selectedSkinType: skinType || null,
            selectedSkinConcern: skinConcern || null,
            minPrice,
            maxPrice: maxPrice < Infinity ? maxPrice : null
        });
    } catch (error) {
        console.error("Error loading shop page:", error);
        res.status(500).send("Internal Server Error. Please try again later.");
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
    loadShopPage


    
}