const User =require('../../models/userSchema')
const Order =require('../../models/OrderSchema')
const Wallet = require('../../models/walletSchema')
const bcrypt = require('bcrypt'); 


exports.getWalletManagement = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

       
        const wallets = await Wallet.find()
            .populate('user', 'name email')
            .lean();

       
        let transactions = [];
        wallets.forEach(wallet => {
         
            if (wallet.user) {
                wallet.transactions.forEach(transaction => {
                    transactions.push({
                        transactionId: transaction._id,
                        date: transaction.date,
                        user: wallet.user,
                        type: transaction.type,
                        amount: transaction.amount,
                        description: transaction.description,
                        orderId: transaction.orderId
                    });
                });
            }
        });

     
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalTransactions = transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const paginatedTransactions = transactions.slice(skip, skip + limit);

        res.render('adminWallet', {
            transactions: paginatedTransactions,
            pageTitle: 'Wallet',
            currentPage: page,
            totalPages: totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        });
    } catch (error) {
        console.error('Error fetching wallet data:', error);
        res.status(500).render('error', { 
            message: 'Error loading wallet management page' 
        });
    }
};

exports.getWalletOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .populate('orderItems.productId', 'productName regularPrice')
            .populate('address') 
            .lean();

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

      
        const transformedOrder = {
            _id: order._id,
            orderID: order.orderID,
            orderDate: order.createdAt, 
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            originalAmount: order.totalPrice + order.discount, 
            totalOfferDiscount: order.discount - (order.couponDiscount || 0), 
            appliedCoupon: {
                code: order.couponCode || 'N/A',
                discountAmount: order.couponDiscount || 0
            },
            totalAmount: order.finalAmount,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus || (order.status === 'Confirmed' ? 'Paid' : 'Pending'),
            transactionId: order.transactionId || 'N/A',
            products: order.orderItems.map(item => ({
                product: {
                    name: item.productId?.productName || item.productName,
                    price: item.price
                },
                quantity: item.quantity,
                productStatus: item.status
            })),
            shippingAddress: {
                fullName: order.address?.fullName || '',
                phone: order.address?.phone || '',
                address: order.address?.address || '',
                city: order.address?.city || '',
                state: order.address?.state || '',
                country: order.address?.country || '',
                pincode: order.address?.pincode || ''
            },
            return: {
                requested: order.status === 'Return Requested' || order.status === 'Returned',
                approved: order.status === 'Returned'
            },
            refundStatus: order.refundStatus,
            orderStatus: order.status,
            isDelivered: order.status === 'Delivered'
        };

        res.json({ success: true, order: transformedOrder });
    } catch (error) {
        console.error('Error fetching wallet order details:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};