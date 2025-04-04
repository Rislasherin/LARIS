const User = require('../../models/userSchema');
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt');
const env = require('dotenv').config;
const session = require('express-session')
function generateOtp() {
    const digits = '1234567890'
    let otp = ''
    for (let i = 0; i < 4; i++) {
        otp += digits[Math.floor(Math.random() * 10)];

    }
    return otp;
}
const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4><br></b>`
        }
        const info = await transporter.sendMail(mailOptions);
        console.log('email sent', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email', error);
        return false;
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error; 
    }
};
const getForgotPassword = async (req, res) => {
    try {
        res.render('forgot-password')
    } catch (error) {
        res.redirect('/pageNotFound')
    }


}

const forgotEmailValid = async (req, res) => {
    try {
        console.log("Received request:", req.body);

        const { email } = req.body;

        if (!email) {
            console.log("Email is missing in request.");
            return res.status(400).json({ message: "Email is required.", type: 'email1' });
        }

        const findUser = await User.findOne({ email: email.toLowerCase() });

        if (!findUser) {
            console.log("User not found in database:", email);
            return res.status(404).json({ message: 'User with this email does not exist.', type: 'email2' });
        }

        console.log("User found:", findUser);

        const otp = generateOtp();
        console.log("Generated OTP:", otp);
        
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;
            req.session.email = email;
            console.log("OTP Sent Successfully:", otp);

            return res.status(200).json({ message: 'OTP sent successfully', type: 'email3' });
        } else {
            console.log("Failed to send OTP.");
            return res.status(500).json({ message: 'Failed to send OTP. Please try again.', type: 'email4' });
        }
    } catch (error) {
        console.error("Error in forgotEmailValid:", error);
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
    }
};

const loadverifyPage = async (req,res)=>{
    try {
        res.render('forgotPass-otp')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const verifyForgotPassOtp = async(req,res)=>{
    try {
        const enterOtp = req.body.otp;
        const sessionOtp = req.session.userOtp;
        
        console.log("Entered OTP:", enterOtp);
        console.log("Session OTP:", sessionOtp);
        
        if(!sessionOtp) {
            return res.status(400).json({success:false, message:'OTP expired or not found. Please request a new OTP.'});
        }
        
        if(enterOtp === sessionOtp){
          
            req.session.otpVerified = true;
            req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).json({success:false, message:'Server error. Please try again.'});
                }
                return res.json({success:true, redirectUrl:'/reset-Password'});
            });
        } else {
            return res.status(400).json({success:false, message:'Invalid OTP. Please try again.'});
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({success:false, message:'An error occurred. Please try again.'});
    }
}

const getResetPassPage = async(req,res) =>{
    try {
       
        if (!req.session.otpVerified) {
            return res.redirect('/forgot-password');
        }
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound')
    }
} 

const resendOtp = async (req,res)=>{
    try {
        const otp = generateOtp();
        const email = req.session.email;
        
        if (!email) {
            return res.status(400).json({success:false, message:'Email not found. Please start over.'});
        }
        
        console.log('Resending OTP to email', email);
        const emailSent = await sendVerificationEmail(email, otp);
        
        if(emailSent){
            req.session.userOtp = otp;
          
            req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).json({success:false, message:'Server error. Please try again.'});
                }
                console.log('Resend OTP:', otp);
                return res.status(200).json({success:true, message:'OTP sent successfully'});
            });
        } else {
            return res.status(500).json({success:false, message:'Failed to send OTP. Please try again.'});
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({success:false, message:'Internal Server Error'});
    }
}

const postNewPassword = async (req, res) => {
    try {
        const {password, confirmPassword } = req.body;
        const email = req.session.email;

        if (!email) {
            return res.status(400).json({ message: "Session expired. Please restart the process.", type: "msg1" });
        }
        if (!password || !confirmPassword) {
            return res.status(400).json({ message: "Both password fields are required.", type: "msg2" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match.", type: "msg3" });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ message: "Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.", type: "msg4" });
        }

        const passwordHash = await securePassword(password,10);

        await User.updateOne({ email: email }, { $set: {password: passwordHash } });

        return res.status(200).json({ message: "Your password has been reset successfully.", type: "msg5" });

        req.session.destroy((err) => {
            if (err) console.error("Session destroy error:", err);
        }); 

    } catch (error) {
        console.error("Error resetting password:", error);
        return res.status(500).json({ message: "Internal Server Error. Please try again." });
    }
};


module.exports = {
    getForgotPassword,
    forgotEmailValid,
    loadverifyPage,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
}
