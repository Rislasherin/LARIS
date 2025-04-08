const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const bcrypt = require('bcrypt'); 
require('dotenv').config();
const Razorpay = require('razorpay');




const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const renderWalletPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
       
        const wallet = await Wallet.findOne({ user: userId })
            .populate('user', 'name email')
            .populate('transactions.orderId', 'orderID totalAmount');

        if (!wallet) {
            const newWallet = new Wallet({
                user: userId,
                currency: 'INR'
            });
            await newWallet.save();
            return res.render('wallet', {
                balance: newWallet.balance,
                transactions: newWallet.transactions,
                currency: newWallet.currency,
                user: req.session.user
            });
        }

        const sortedTransactions = wallet.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        res.render('wallet', {
            balance: wallet.balance,
            transactions: sortedTransactions,
            currency: wallet.currency,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error loading wallet:', error);
        req.flash('error', 'Error loading wallet');
        res.redirect('/');
    }
};

const getMoreTransactions = async (req, res) => {
    try {
        const userId = req.session.user._id; // Assuming session-based auth
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 5;

       
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.json({ transactions: [] });
        }

        // Fetch transactions with pagination
        const transactions = wallet.transactions
            .slice(skip, skip + limit)
            .map(tx => ({
                _id: tx._id,
                type: tx.type,
                amount: tx.amount,
                description: tx.description,
                date: tx.date,
                orderId: tx.orderId
            }));

        res.json({ transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const addCashToWallet = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { amount } = req.body;
        console.log('POST /wallet/add-cash hit');
        console.log('User ID:', userId);
        console.log('Amount:', amount);

        const receipt = `w_${userId.slice(0, 10)}_${Date.now().toString().slice(-8)}`;
        const order = await razorpay.orders.create({
            amount: amount * 100,
            currency: 'INR',
            receipt: receipt,
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            key: process.env.RAZORPAY_KEY_ID,
            user: {
                name: req.session.user.name,
                email: req.session.user.email
            }
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, error: 'Failed to initiate payment' });
    }
};
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const userId = req.session.user._id;

        const crypto = require('crypto');
        const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET) // Use env variable here
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(500).json({ success: false, error: 'Invalid payment signature' });
        }

        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ success: false, error: 'Wallet not found' });
        }

        wallet.balance += amount / 100;
        wallet.transactions.push({
            type: 'credit',
            amount: amount / 100,
            description: 'Wallet Top-up via Razorpay',
            date: new Date()
        });

        await wallet.save();
        res.json({ success: true, message: 'Wallet updated successfully' });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, error: 'Payment verification failed' });
    }
};

module.exports = {
    renderWalletPage,
    getMoreTransactions,
    addCashToWallet,
    verifyPayment,
}


