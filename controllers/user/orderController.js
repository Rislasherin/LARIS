
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema')
const Wallet = require('../../models/walletSchema')



const getOrdersPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.redirect("/user/login");
    }

    const orders = await Order.find({ 
      user: userId,
      status: { $nin: ['Payment Pending', 'Payment Failed'] }
    })
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
      })),
      paymentStatus: order.paymentMethod === 'cod' 
        ? (order.status === 'Delivered' ? 'Completed' : 'Pending') 
        : (order.status === 'Payment Pending' ? 'Pending' : 'Completed')
    }));

    res.render('orders', { orders: formattedOrders, user: req.session.user, message: null });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Internal Server Error");
  }
};
const getOrderDetailsPage = async (req, res) => {
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

      const timelineSteps = [
          { title: 'Order Placed', completed: false, current: false },
          { title: 'Processing', completed: false, current: false },
          { title: 'Shipped', completed: false, current: false },
          { title: 'Delivered', completed: false, current: false }
      ];

      const currentStatus = order.status;
      let activeIndex = -1;

      switch (currentStatus) {
          case 'Pending':
          case 'Payment Pending':
          case 'Confirmed':
              activeIndex = 0;
              break;
          case 'Processing':
              activeIndex = 1;
              break;
          case 'Shipped':
              activeIndex = 2;
              break;
          case 'Delivered':
              activeIndex = 3;
              break;
          case 'Cancelled':
          case 'Partially Cancelled':
              activeIndex = -1;
              break;
          default:
              console.warn("Unhandled order status:", currentStatus);
              activeIndex = -1;
      }

      if (activeIndex >= 0) {
          for (let i = 0; i < timelineSteps.length; i++) {
              if (i < activeIndex) {
                  timelineSteps[i].completed = true;
              } else if (i === activeIndex) {
                  timelineSteps[i].current = true;
                  timelineSteps[i].completed = true;
              }
          }
      }

      const RETURN_EXPIRY_DAYS = 7; // Define return expiry period (e.g., 30 days)

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

              // Calculate if return is expired
              let canReturn = false;
              if (item.status === 'Delivered' && item.deliveryDate) {
                  const deliveryDate = new Date(item.deliveryDate);
                  const expiryDate = new Date(deliveryDate);
                  expiryDate.setDate(deliveryDate.getDate() + RETURN_EXPIRY_DAYS);
                  canReturn = new Date() <= expiryDate;
              }

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
                  deliveryDate: item.deliveryDate,
                  canReturn: canReturn // New field to indicate if return is possible
              };
          }),
          timeline: timelineSteps,
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


const refundToWallet = async (userId, amount, description, orderId) => {
    try {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0, currency: 'INR', transactions: [] });
        }

        wallet.balance += amount;
        wallet.transactions.push({
            type: 'credit',
            amount: amount,
            description: description,
            date: new Date(),
            orderId: orderId,
        });

        await wallet.save();
        console.log(`Refunded ${amount} to wallet for user ${userId}`);
    } catch (error) {
        console.error('Error refunding to wallet:', error);
        throw error;
    }
};

const cancelProduct = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason = "No reason provided" } = req.body;
    const userId = req.session.user?._id;

    console.log('Cancel Product Request:', { orderId, productId, reason, userId });

    if (!orderId || !productId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const order = await Order.findOne({ _id: orderId, user: userId }).populate('orderItems.productId');
    if (!order) {
      console.log('Order not found:', { orderId, userId });
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const productIndex = order.orderItems.findIndex(item => 
      item.productId._id.toString() === productId.toString()
    );
    if (productIndex === -1) {
      console.log('Product not found in order:', { productId });
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

    const product = order.orderItems[productIndex];

    if (['Cancelled', 'Delivered', 'Cancellation Requested', 'Returned'].includes(product.status)) {
      console.log('Product cannot be cancelled:', { productId, status: product.status });
      return res.status(400).json({ success: false, message: `Product cannot be cancelled (Current status: ${product.status})` });
    }

    product.status = 'Cancelled';

    const productDoc = await Product.findById(product.productId._id);
    if (!productDoc) {
      console.log('Product not found in inventory:', { productId: product.productId._id });
      return res.status(500).json({ success: false, message: 'Product not found in inventory' });
    }

   
    productDoc.quantity += product.quantity;
    console.log(`Restocking product ${product.productId._id}: Increased quantity by ${product.quantity} to ${productDoc.quantity}`);
    await productDoc.save();

    const allCancelled = order.orderItems.every(item => item.status === 'Cancelled');
    const someCancelled = order.orderItems.some(item => item.status === 'Cancelled');
    const someDelivered = order.orderItems.some(item => item.status === 'Delivered');

    if (allCancelled) {
      order.status = 'Cancelled';
      order.refundStatus = order.paymentMethod !== 'cod' ? 'Pending' : 'Not Applicable';
    } else if (someCancelled && someDelivered) {
      order.status = 'Partially Cancelled';
      order.refundStatus = order.paymentMethod !== 'cod' ? 'Partially Processed' : 'Not Applicable';
    } else if (someCancelled) {
      order.status = 'Partially Cancelled';
    }

    order.timeline.push({
      title: 'Product Cancelled',
      text: `Product: ${product.productId.productName}, Reason: ${reason}`,
      date: new Date(),
      completed: true,
    });

    order.history.push({
      status: product.status,
      timestamp: new Date(),
      notes: `Product cancelled by user. Reason: ${reason}`,
      updatedBy: userId,
    });

    await order.save();

    const refundAmount = product.price * product.quantity;
    if (order.paymentMethod !== 'cod' && refundAmount > 0) {
      await refundToWallet(
        userId,
        refundAmount,
        `Refund for cancelled product ${product.productId.productName} in order ${order.orderID}`,
        order._id
      );
    }

    res.json({ success: true, message: 'Product cancelled successfully' });
  } catch (error) {
    console.error('Error in cancelProduct:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
  }
};
  const cancelOrder = async (req, res) => {
    try {
      const { orderId } = req.params;
      const { reason = "No reason provided" } = req.body;
      const userId = req.session.user?._id;
  
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required' });
      }
  
      const order = await Order.findOne({ _id: orderId, user: userId }).populate('orderItems.productId');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      if (['Cancelled', 'Delivered', 'Partially Delivered'].includes(order.status)) {
        return res.status(400).json({ success: false, message: `Order cannot be cancelled (Current status: ${order.status})` });
      }
  
      const cancellable = order.orderItems.every(item => !['Shipped', 'Delivered', 'Returned'].includes(item.status));
      if (!cancellable) {
        console.log('Order has non-cancellable items');
        return res.status(400).json({ success: false, message: 'Cannot cancel order; some products are already shipped or delivered' });
      }
  
      let refundAmount = 0;
      for (const item of order.orderItems) {
        if (item.status !== 'Cancelled') {
          item.status = 'Cancelled';
          const productDoc = await Product.findById(item.productId);
          if (productDoc) {
            productDoc.quantity += item.quantity; 
            console.log(`Restocking product ${item.productId._id}: Increased quantity by ${item.quantity} to ${productDoc.quantity}`);
            await productDoc.save();
          }
          refundAmount += item.price * item.quantity;
        }
      }
  
      order.status = 'Cancelled';
      order.refundStatus = order.paymentMethod !== 'cod' ? 'Pending' : 'Not Applicable';
  
      order.timeline.push({
        title: 'Order Cancelled',
        text: `Reason: ${reason}`,
        date: new Date(),
        completed: true,
      });
  
      order.history.push({
        status: order.status,
        timestamp: new Date(),
        notes: `Order cancelled by user. Reason: ${reason}`,
        updatedBy: userId,
      });
  
      await order.save();
  
      if (order.paymentMethod !== 'cod' && refundAmount > 0) {
        await refundToWallet(userId, refundAmount, `Refund for cancelled order ${order.orderID}`, order._id);
      }
  
      res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
      console.error('Error in cancelOrder:', error.message, error.stack);
      res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
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

        const RETURN_EXPIRY_DAYS = 7; // Define return expiry period
        if (!product.deliveryDate) {
            return res.status(400).json({ message: 'Delivery date not set for this product' });
        }

        const deliveryDate = new Date(product.deliveryDate);
        const expiryDate = new Date(deliveryDate);
        expiryDate.setDate(deliveryDate.getDate() + RETURN_EXPIRY_DAYS);

        if (new Date() > expiryDate) {
            return res.status(400).json({ message: 'Return period has expired' });
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

  
  }

module.exports = {
    getOrdersPage, 
    getOrderDetailsPage,
    cancelProduct,
    cancelOrder,
    requestReturn,
};