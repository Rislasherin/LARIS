const User = require('../models/userSchema');

const userAuth = (req, res, next) => {
    console.log('Session in userAuth:', JSON.stringify(req.session, null, 2));
    console.log('req.user in userAuth:', req.user);

    const sessionUser = req.session.user || req.user;
    if (!sessionUser) {
        console.log('No session user or req.user, redirecting to login');
        return res.redirect("/login");
    }

    const userId = typeof sessionUser === 'string' ? sessionUser : sessionUser._id;
    User.findById(userId)
        .then((user) => {
            if (user && !user.isBlocked) {
                console.log('User authenticated:', user.email);
                req.user = user; // Set req.user for consistency
                req.session.user = { // Ensure session is updated
                    _id: user._id.toString(),
                    name: user.name,
                    email: user.email
                };
                next();
            } else {
                console.log('User blocked or not found');
                delete req.session.user;
                res.redirect("/login");
            }
        })
        .catch((error) => {
            console.error("User Auth Error:", error);
            res.status(500).send("Internal Server Error");
        });
};

const userAuthJson = (req, res, next) => {
    if (req.session.user || req.user) {
        const userId = req.session.user?._id || req.user?._id;
        User.findById(userId)
            .then((user) => {
                if (user && !user.isBlocked) {
                    req.user = user;
                    next();
                } else {
                    delete req.session.user;
                    res.status(401).json({ 
                        success: false, 
                        message: 'User not authenticated' 
                    });
                }
            })
            .catch((error) => {
                console.error("User Auth Error:", error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Internal server error' 
                });
            });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'User not authenticated' 
        });
    }
};

const adminAuth = async (req, res, next) => {
    try {
        if (!req.session.admin) {
            res.redirect("/admin/login");
        } else {
            next();
        }
    } catch (error) {
        console.error("Error in adminAuth:", error);
        res.redirect("/admin/pageerror");
    }
};

module.exports = {
    userAuth,
    userAuthJson,
    adminAuth
};