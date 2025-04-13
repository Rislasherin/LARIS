const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

exports.renderReferral = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            console.error("User is not logged in or session expired.");
            return res.status(401).redirect("/user/login?error=" + encodeURIComponent("Please log in to view your referral dashboard"));
        }

        const userId = req.session.user._id;
        console.log("Fetching referral data for User ID:", userId);

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found in database for ID:", userId);
            return res.status(404).render("user/error", {
                message: "User not found",
                title: "Error"
            });
        }

        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                currency: 'INR'
            });
            await wallet.save();
        }

        const referredUsersQuery = User.find({ referredBy: user.referralCode })
            .select('name email createdAt status')
            .sort({ createdAt: -1 });

        const totalReferrals = await User.countDocuments({ referredBy: user.referralCode });
        const referredUsers = await referredUsersQuery
            .skip(skip)
            .limit(limit);

        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            referralCode: user.referralCode,
            wallet: wallet.balance // Use main wallet balance
        };

        res.render('referral', {
            title: 'Your Referral Dashboard',
            referralCode: user.referralCode,
            wallet: wallet.balance,
            mainBalance: wallet.balance,
            name: user.name,
            user: req.session.user,
            referredUsers: referredUsers,
            totalReferrals: totalReferrals,
            currentPage: page,
            hasMore: (page * limit) < totalReferrals,
            errorMessage: req.query.error || null,
            successMessage: req.flash('success') || req.query.success || null
        });
    } catch (error) {
        console.error('Error rendering referral page:', error.message, error.stack);
        res.status(500).render("user/error", {
            message: "Internal Server Error",
            title: "Error"
        });
    }
};