const passport = require('passport');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const Cart = require('../models/CartSchema');
require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ 
            $or: [
                { email: profile.emails[0].value },
                { googleId: profile.id }
            ]
        });

        if (!user) {
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                profileImage: profile.photos[0].value
            });
            await user.save();

            const newCart = new Cart({
                user: user._id,
                items: []
            });
            await newCart.save();
        }

        // Set req.session.user here (optional, since req.login will handle it)
        req.session.user = {
            _id: user._id.toString(),
            name: user.name,
            email: user.email
        };

        return done(null, user);
    } catch (error) {
        console.error('Google Login Error:', error);
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user._id); // Store user ID in session
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            return done(null, false);
        }
        // Return a consistent object
        done(null, {
            _id: user._id.toString(),
            name: user.name,
            email: user.email
        });
    } catch (err) {
        console.error('Deserialize error:', err);
        done(err, null);
    }
});

// Google Login Route Handler
const googleLogin = passport.authenticate('google', { 
    scope: ['profile', 'email'] 
});

// Google Callback Route Handler
const googleCallback = (req, res, next) => {
    passport.authenticate('google', (err, user) => {
        if (err) {
            console.error('Google auth error:', err);
            return res.redirect('/login');
        }
        if (!user) {
            return res.redirect('/login');
        }

        req.login(user, (loginErr) => {
            if (loginErr) {
                console.error('Login error:', loginErr);
                return res.redirect('/login');
            }

            // Set req.session.user consistently
            req.session.user = {
                _id: user._id.toString(), // Keep as string if needed, but ensure consistency
                name: user.name,
                email: user.email
            };

            console.log('Google login successful, session:', req.session.user);
            res.redirect('/');
        });
    })(req, res, next);
};
module.exports = {
    passport,
    googleLogin,
    googleCallback
};