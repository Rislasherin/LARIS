const User = require('../../models/userSchema');
const nodemailer = require('nodemailer')
const Address = require('../../models/addressSchema');
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

const loadverifyPage = async (req, res) => {
    try {
        res.render('forgotPass-otp')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enterOtp = req.body.otp;
        const sessionOtp = req.session.userOtp;

        console.log("Entered OTP:", enterOtp);
        console.log("Session OTP:", sessionOtp);

        if (!sessionOtp) {
            return res.status(400).json({ success: false, message: 'OTP expired or not found. Please request a new OTP.' });
        }

        if (enterOtp === sessionOtp) {

            req.session.otpVerified = true;
            req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
                }
                return res.json({ success: true, redirectUrl: '/reset-Password' });
            });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
}

const getResetPassPage = async (req, res) => {
    try {

        if (!req.session.otpVerified) {
            return res.redirect('/forgot-password');
        }
        res.render('reset-password');
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp();
        const email = req.session.email;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found. Please start over.' });
        }

        console.log('Resending OTP to email', email);
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;

            req.session.save(err => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
                }
                console.log('Resend OTP:', otp);
                return res.status(200).json({ success: true, message: 'OTP sent successfully' });
            });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

const postNewPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
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

        const passwordHash = await securePassword(password, 10);

        await User.updateOne({ email: email }, { $set: { password: passwordHash } });

        return res.status(200).json({ message: "Your password has been reset successfully.", type: "msg5" });

        req.session.destroy((err) => {
            if (err) console.error("Session destroy error:", err);
        });

    } catch (error) {
        console.error("Error resetting password:", error);
        return res.status(500).json({ message: "Internal Server Error. Please try again." });
    }
};


const userProfile = async (req, res) => {
    try {
        console.log('Profile route - Session user:', req.session.user);
        console.log('Profile route - Req user:', req.user);
        
        if (req.session.user) {
            const user = await User.findById(req.session.user._id);
            if (user) {
                res.render('profile', { user: user });
            } else {
                res.redirect('/login');
            }
        } else {
            res.redirect('/login');
        }
    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/login');
    }
};
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found!" });
        }

     
        console.log('User ID:', userId);
        console.log('Current Password Input:', currentPassword);
        console.log('Stored Password Hash:', user.password);

        // Validate inputs before comparison
        if (!currentPassword) {
            return res.status(400).json({ 
                success: false, 
                message: "Current password is required" 
            });
        }

        if (!user.password) {
            return res.status(400).json({ 
                success: false, 
                message: "No password stored for this user" 
            });
        }

      
        try {
           
            const trimmedCurrentPassword = currentPassword.trim();
            const trimmedStoredHash = user.password.trim();

         
            if (!trimmedCurrentPassword || !trimmedStoredHash) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Invalid password data" 
                });
            }

            const isMatch = await bcrypt.compare(trimmedCurrentPassword, trimmedStoredHash);
            
            if (!isMatch) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Incorrect current password!" 
                });
            }
        } catch (compareError) {
            console.error('Bcrypt compare error:', compareError);
            return res.status(500).json({ 
                success: false, 
                message: "Error comparing passwords",
                details: compareError.message,
                rawError: compareError
            });
        }

        // Validate new password
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "New passwords do not match!" });
        }

     
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character."
            });
        }

     
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully!" });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error",
            details: error.message
        });
    }
};
const sendEmailOtp = async (req, res) => {
    try {
        const { email } = req.body;

 
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        const userId = req.session.user?._id || req.session.user;
        const user = await User.findById(userId);
        if (user.email === email) {
            return res.status(400).json({ 
                success: false, 
                message: 'New email cannot be the same as current email' 
            });
        }


        const otp = generateOtp(); 
        console.log('Generated OTP:', otp);

    
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.emailChangeOtp = otp;
            req.session.newEmail = email;
            req.session.otpGeneratedTime = Date.now();
            return res.status(200).json({ success: true, message: 'OTP sent successfully' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send OTP' });
        }
    } catch (error) {
        console.error('Error sending email OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;


        const userId = req.session.user._id || req.session.user;
        const user = await User.findById(userId);

        if (user.email === email) {
            return res.status(400).json({ 
                success: false, 
                message: 'New email cannot be the same as current email' 
            });
        }

        if (!req.session.emailChangeOtp || !req.session.newEmail) {
            return res.status(400).json({ success: false, message: 'Session expired. Please start over.' });
        }

  
        const otpGeneratedTime = req.session.otpGeneratedTime || 0;
        const currentTime = Date.now();
        if (currentTime - otpGeneratedTime > 60000) { 
            delete req.session.emailChangeOtp;
            delete req.session.newEmail;
            delete req.session.otpGeneratedTime;
            
            return res.status(400).json({ 
                success: false, 
                message: 'OTP has expired. Please request a new one.' 
            });
        }

        if (otp !== req.session.emailChangeOtp || email !== req.session.newEmail) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

      
        const oldEmail = user.email;

   
        user.email = email;
        await user.save();

        delete req.session.emailChangeOtp;
        delete req.session.newEmail;
        delete req.session.otpGeneratedTime;


        console.log(`Email changed from ${oldEmail} to ${email} for user ${userId}`);

        return res.status(200).json({
            success: true,
            message: 'Email updated successfully',
            newEmail: email,
            oldEmail: oldEmail
        });

    } catch (error) {
        console.error('Error verifying email OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
const resendEmailOtp = async (req, res) => {
    try {
        const email = req.session.newEmail;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email not found in session. Please start over.'
            });
        }

      
        const lastOtpTime = req.session.otpGeneratedTime || 0;
        const currentTime = Date.now();
        if (currentTime - lastOtpTime < 30000) { 
            return res.status(400).json({
                success: false,
                message: 'Please wait before requesting a new OTP'
            });
        }

   
        const otp = generateOtp(); 
        console.log('Resent OTP:', otp);

  
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.emailChangeOtp = otp;
            req.session.otpGeneratedTime = Date.now();
            
            return res.status(200).json({
                success: true,
                message: 'New OTP sent successfully'
            });
        } else {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to send OTP email'
            });
        }

    } catch (error) {
        console.error('Error in resendEmailOtp:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.toString()
        });
    }
};
const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const userId = req.session.user?._id || req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

   
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }

     
        const phoneRegex = /^\+?[\d\s-]{8,15}$/;
        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid phone number format" 
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                name: name.trim(),
                phone: phone ? phone.trim() : user.phone
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Profile updated successfully",
            user: {
                name: updatedUser.name,
                phone: updatedUser.phone
            }
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
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
    userProfile,
    changePassword,
    sendEmailOtp,
    verifyEmailOtp,
    resendEmailOtp,
    updateProfile

}
