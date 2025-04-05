
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');



const getOrdersPage = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log("User not logged in, redirecting to login page.");
            return res.redirect("/user/login");
        }

        const orders = await Order.find({ user: userId })
            .populate({
                path: 'orderItems.productId',
                select: 'productName regularPrice productOffer productImage', 
            })
            .populate('address')
            .sort({ createdAt: -1 });

        if (!orders.length) {
            return res.render('orders', { orders: [], user: req.session.user, message: 'No orders found' });
        }

        const formattedOrders = orders.map(order => ({
            ...order._doc, 
            orderItems: order.orderItems.map(item => ({
                ...item._doc,
                image: item.productId?.productImage?.length > 0 
                    ? `/uploads/product-images/${item.productId.productImage[0].trim()}` 
                    : '/default-image.jpg'
            }))
        }));

        res.render('orders', { orders: formattedOrders, user: req.session.user, message: null });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Internal Server Error");
    }
};const getOrderDetailsPage = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            console.log("User not logged in, redirecting to login page.");
            return res.redirect("/user/login");
        }

        const orderId = req.params.orderId;

        const query = mongoose.Types.ObjectId.isValid(orderId)
            ? { _id: orderId, user: userId }
            : { orderID: orderId, user: userId };

        const order = await Order.findOne(query)
            .populate({
                path: 'orderItems.productId',
                select: 'productName regularPrice productOffer productImage',
            })
            .populate('address')
            .populate('user', 'name email');

        if (!order) {
            console.log("Order not found for user:", userId, "and Order ID:", orderId);
            return res.status(404).send("Order not found");
        }
      

        const orderData = {
            _id: order._id,
            orderID: order.orderID,
            orderStatus: order.status,
            orderDate: order.createdAt,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.status === 'Payment Pending' ? 'Pending' : 'Completed',
            transactionId: order.transactionId,
            shippingAddress: order.address,
            user: order.user,
            products: order.orderItems.map(item => {
                const productImage = item.productId?.productImage?.length > 0 
                    ? `/uploads/product-images/${item.productId.productImage[0].trim()}` 
                    : '/default-image.jpg';
   
                return {
                    _id: item.productId?._id || item.productId,
                    name: item.productId?.productName || item.productName || 'Unknown Product',
                    price: item.price,
                    quantity: item.quantity,
                    image: productImage,
                    offerDiscount: item.productId 
                        ? (item.productId.regularPrice - item.price) * item.quantity 
                        : 0,
                    offerName: item.productId?.productOffer > 0 ? 'Product Offer' : 'Category Offer',
                    productStatus: item.status,
                    deliveryDate: order.status === 'Delivered' 
                        ? order.timeline.find(t => t.title === 'Delivered')?.date 
                        : null
                };
            }),
            timeline: order.timeline,
            originalAmount: order.totalPrice,
            offerDiscount: order.discount,
            couponCode: order.couponCode || 'N/A',
            couponDiscount: order.couponDiscount,
            subtotal: order.totalPrice - order.discount - order.couponDiscount,
            shipping: order.shipping,
            tax: order.tax,
            totalAmount: order.finalAmount
        };

        res.render('order-details', { order: orderData, user: req.session.user });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Internal Server Error");
    }
};
const cancelProduct = async (req, res) => {
    try {
        console.log('Cancel Product Controller Called:', req.params, req.body);
        const { orderId, productId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user?._id;

        if (!orderId || !productId || !reason) {
            console.log('Missing fields:', { orderId, productId, reason });
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            console.log('Order not found:', { orderId, userId });
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const product = order.orderItems.find(item => item.productId.toString() === productId);
        if (!product) {
            console.log('Product not found in order:', productId);
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        if (['Cancelled', 'Delivered', 'Cancellation Requested', 'Returned'].includes(product.status)) {
            console.log('Product cannot be cancelled:', product.status);
            return res.status(400).json({ success: false, message: `Product cannot be cancelled (Current status: ${product.status})` });
        }

        product.status = 'Cancellation Requested';
        
      
        const allCancelledOrRequested = order.orderItems.every(item => 
            item.status === 'Cancellation Requested' || item.status === 'Cancelled'
        );
        if (allCancelledOrRequested && order.status !== 'Cancelled') {
            order.status = 'Cancelled';
        } else if (order.orderItems.some(item => item.status === 'Cancellation Requested' || item.status === 'Cancelled')) {
            order.status = 'Partially Cancelled';
        }

        order.timeline.push({
            title: 'Cancellation Requested',
            text: `Reason: ${reason}`,
            date: new Date(),
            completed: true
        });

        await order.save();
        console.log('Cancellation successful:', order);
        res.json({ success: true, message: 'Cancellation request submitted successfully' });
    } catch (error) {
        console.error('Error in cancelProduct:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
const requestReturn = async (req, res) => {
    try {
        console.log('Request Return Controller Called:', req.body);
        const { orderId, productId, returnReason } = req.body;
        const userId = req.session.user?._id;

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const product = order.orderItems.find(item => item.productId.toString() === productId);
        if (!product || product.status !== 'Delivered') {
            return res.status(400).json({ message: 'Product cannot be returned' });
        }
        product.status = 'Return Requested';
        order.timeline.push({
            title: 'Return Requested',
            text: `Reason: ${returnReason}`,
            date: new Date(),
            completed: true
        });
        await order.save();
        res.json({ success: true, message: 'Return request submitted' });
    } catch (error) {
        console.error("Error requesting return:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getOrdersPage, 
    getOrderDetailsPage,
    cancelProduct,
    requestReturn,
};