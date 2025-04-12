const Cart = require("../../models/CartSchema");
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Offer = require('../../models/offerSchema');
const Wallet = require('../../models/walletSchema');

const renderOrderManage = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 5;
        let skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments();
        const orders = await Order.find()
            .populate("user")
            .populate("address")
            .populate({
                path: "orderItems.productId",
                select: "productName productImage"
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        orders.forEach(order => {
            if (!order.user) console.warn(`Order ${order.orderID} has no valid user reference. User ID: ${order.user}`);
            if (!order.address) console.warn(`Order ${order.orderID} has no valid address reference. Address ID: ${order.address}`);
            order.orderItems.forEach(item => {
                if (!item.productId) console.warn(`Order ${order.orderID} has an item with no valid product reference. Product ID: ${item.productId}`);
                item.displayName = item.productName || (item.productId ? item.productId.productName : "Unknown Product");
                item.displayImage = item.productImage || (item.productId && item.productId.productImage && item.productId.productImage.length > 0 ? item.productId.productImage[0] : "/default-image.jpg");
            });
        });

        res.render("orderManage", {
            orders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            admin: req.session.admin,
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Internal Server Error");
    }
};
const renderOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate("user")
            .populate("address")
            .populate({
                path: "orderItems.productId",
                select: "productName productImage"
            })
            .exec();

        if (!order) return res.status(404).send("Order not found");

        order.orderItems.forEach(item => {
            item.displayImage = item.productImage || 
                (item.productId && item.productId.productImage && item.productId.productImage.length > 0 
                    ? item.productId.productImage[0] 
                    : "/default-image.jpg");
            item.displayName = item.productName || (item.productId ? item.productId.productName : "Unknown Product");
        });

        res.render("orderDetail", { 
            order,
            admin: req.session.admin
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Server Error");
    }
};
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).populate("products.product");
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        res.json({ success: true, order }); 
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const updateOrderStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const orderId = req.params.orderId;
      const newStatus = req.body.status;
      const notes = req.body.notes;
      console.log('Updating order status:', { orderId, newStatus });
  
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      const currentStatus = order.status;
  
      // Restore stock if setting to Cancelled
      if (newStatus === 'Cancelled' && currentStatus !== 'Cancelled') {
        for (const item of order.orderItems) {
          if (!['Cancelled', 'Returned'].includes(item.status)) {
            const product = await Product.findById(item.productId).session(session);
            if (product) {
              product.quantity += item.quantity;
              await product.save({ session });
            }
            item.status = 'Cancelled';
          }
        }
      }
  
      order.status = newStatus;
      order.orderStatus = newStatus; // Maintain consistency (orderStatus seems unused but included)
  
      if (!order.history) order.history = [];
      order.history.push({
        status: newStatus,
        timestamp: new Date(),
        notes: notes || `Status changed to ${newStatus}`,
        updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
      });
  
      // Update timeline
      if (!order.timeline) order.timeline = [];
      order.timeline.push({
        title: newStatus,
        text: `Order status updated to ${newStatus}`,
        date: new Date(),
        completed: true
      });
  
      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
  
      res.json({ success: true, message: 'Order status updated successfully!' });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error updating order status:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };

const updateProductStatus = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { orderId } = req.params;
      const { productStatuses } = req.body;
      console.log('Request body:', req.body);
  
      const order = await Order.findOne({ _id: orderId }).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      if (order.status === 'Cancelled' || order.status === 'Returned') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Cannot update products in Cancelled or Returned orders' });
      }
  
      for (const { productId, status } of productStatuses) {
        const item = order.orderItems.find(i => i._id.toString() === productId);
        if (!item) {
          console.log(`Item ${productId} not found in order`);
          continue;
        }
  
        if (item.status === 'Cancelled' || item.status === 'Returned') {
          console.log(`Skipping ${productId}: Already ${item.status}`);
          continue;
        }
        if (item.status === 'Shipped' && (status === 'Pending' || status === 'Processing')) {
          console.log(`Skipping ${productId}: Cannot revert Shipped to ${status}`);
          continue;
        }
        if (item.status === 'Processing' && status === 'Pending') {
          console.log(`Skipping ${productId}: Cannot revert Processing to Pending`);
          continue;
        }
  
        // Restore stock if setting to Cancelled
        if (status === 'Cancelled' && item.status !== 'Cancelled') {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            product.quantity += item.quantity;
            await product.save({ session });
          }
        }
  
        item.status = status;
        console.log(`Updated ${productId} to ${status}`);
      }
  
      const itemCount = order.orderItems.length;
      const deliveredCount = order.orderItems.filter(i => i.status === 'Delivered').length;
  
      if (itemCount > 1) {
        if (deliveredCount > 0 && deliveredCount < itemCount) {
          order.status = 'Partially Delivered';
          console.log('Order status set to Partially Delivered');
        } else if (deliveredCount === itemCount) {
          order.status = 'Delivered';
          console.log('Order status set to Delivered');
        }
      }
  
      const allCancelled = order.orderItems.every(i => i.status === 'Cancelled');
      if (allCancelled) {
        order.status = 'Cancelled';
        console.log('All items cancelled - updating order to Cancelled');
      }
  
      if (!order.history) order.history = [];
      order.history.push({
        status: 'Product Status Update',
        timestamp: new Date(),
        notes: `Updated product statuses`,
        updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
      });
  
      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
  
      res.json({ success: true, message: 'Product statuses updated successfully!' });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error updating product status:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };

const renderReturnRequestsList = async (req, res) => {
    try {
       
        const returnRequests = await Order.find({ 
            orderStatus: 'Return Requested',
            'return.requested': true 
        })
        .populate('user', 'name') 
        .populate('products.product') 
        .lean();

        res.render('admin/return-requests', { returnRequests });
    } catch (error) {
        console.error('Error rendering return requests list:', error);
        res.status(500).render('admin/error', { message: 'Server Error' });
    }
};

function getBadgeClass(status) {
    switch (status) {
        case 'Pending': return 'warning';
        case 'Processing': return 'primary';
        case 'Shipped': return 'info';
        case 'Delivered': return 'success';
        case 'Cancelled': return 'danger';
        case 'Cancellation Requested': return 'warning';
        case 'Return Requested': return 'warning';
        case 'Returned': return 'secondary';
        default: return 'secondary';
    }
}
const updateAllOrderItems = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { orderId } = req.params;
      const { status, productIds } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
      }
  
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      if (!order.history) order.history = [];
  
      let updatedCount = 0;
      let skippedCount = 0;
  
      for (const item of order.orderItems) {
        if (productIds.includes(item._id.toString())) {
          if (
            item.status === 'Returned' ||
            (item.status === 'Delivered' && status !== 'Delivered') ||
            (item.status === 'Cancelled' && status !== 'Cancelled')
          ) {
            skippedCount++;
            continue;
          }
  
          // Restore stock if setting to Cancelled
          if (status === 'Cancelled' && item.status !== 'Cancelled') {
            const product = await Product.findById(item.productId).session(session);
            if (product) {
              product.quantity += item.quantity;
              await product.save({ session });
            }
          }
  
          item.status = status;
          updatedCount++;
        }
      }
  
      const allDelivered = order.orderItems.every(item => item.status === 'Delivered');
      const allShipped = order.orderItems.every(item => item.status === 'Shipped');
      const anyCancelled = order.orderItems.some(item => item.status === 'Cancelled');
      const allCancelled = order.orderItems.every(item => item.status === 'Cancelled');
      const anyDelivered = order.orderItems.some(item => item.status === 'Delivered');
  
      let newOrderStatus = order.status;
      if (allDelivered) newOrderStatus = 'Delivered';
      else if (allShipped) newOrderStatus = 'Shipped';
      else if (allCancelled) newOrderStatus = 'Cancelled';
      else if (anyCancelled && anyDelivered) newOrderStatus = 'Partially Cancelled';
      else if (anyCancelled) newOrderStatus = 'Partially Cancelled';
      else if (anyDelivered) newOrderStatus = 'Partially Delivered';
      else newOrderStatus = status === 'Pending' ? 'Pending' : status === 'Processing' ? 'Processing' : 'Shipped';
  
      if (order.status !== newOrderStatus) {
        order.status = newOrderStatus;
        order.timeline.push({
          title: newOrderStatus,
          text: `Order status updated to ${newOrderStatus}`,
          date: new Date(),
          completed: true
        });
      }
  
      order.history.push({
        status: 'Bulk Update',
        timestamp: new Date(),
        notes: `${updatedCount} product(s) status changed to ${status}${skippedCount > 0 ? `, ${skippedCount} item(s) skipped` : ''}`,
        updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
      });
  
      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
  
      res.json({
        success: true,
        message: `${updatedCount} item(s) updated${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}`,
        orderStatus: newOrderStatus
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error updating all order items:', error);
      res.status(500).json({ success: false, message: 'Server error occurred' });
    }
  };
const rejectReturnRequest = async (req, res) => {
    try {
        const { orderId, productId } = req.body;

        if (!orderId || !productId) {
            return res.status(400).json({ success: false, message: 'Order ID and Product ID are required' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const item = order.orderItems.find(item => item._id.toString() === productId);
        if (!item || item.status !== 'Return Requested') {
            return res.status(400).json({ success: false, message: 'No return request found for this item' });
        }

        item.status = 'Delivered';
        order.history.push({
            status: 'Return Rejected',
            timestamp: new Date(),
            notes: `Return request rejected for product ${productId}`,
            updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
        });

        await order.save();

        res.json({
            success: true,
            message: 'Return request rejected successfully'
        });
    } catch (error) {
        console.error('Error rejecting return:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
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

const acceptReturnRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { orderId, productId } = req.body;
  
      if (!orderId || !productId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Order ID and Product ID are required' });
      }
  
      const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate({ path: 'orderItems.productId', select: 'productName' })
        .session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      const item = order.orderItems.find(item => item._id.toString() === productId);
      if (!item || item.status !== 'Return Requested') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'No return request found for this item' });
      }
  
      // Restore stock
      const product = await Product.findById(item.productId).session(session);
      if (product) {
        product.quantity += item.quantity;
        await product.save({ session });
      }
  
      item.status = 'Returned';
  
      const allReturned = order.orderItems.every(item => item.status === 'Returned');
      const anyReturned = order.orderItems.some(item => item.status === 'Returned');
      const anyDelivered = order.orderItems.some(item => item.status === 'Delivered');
  
      if (allReturned) {
        order.status = 'Returned';
        order.refundStatus = 'Processed';
      } else if (anyReturned && anyDelivered) {
        order.status = 'Partially Returned';
        order.refundStatus = 'Partially Processed';
      } else if (anyReturned) {
        order.status = 'Partially Returned';
        order.refundStatus = 'Partially Processed';
      }
  
      if (!order.history) order.history = [];
      order.history.push({
        status: 'Return Accepted',
        timestamp: new Date(),
        notes: `Return accepted for product ${productId}`,
        updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
      });
  
      const refundAmount = item.price * item.quantity;
      if (order.paymentMethod !== 'cod' && refundAmount > 0) {
        const productName = item.productId?.productName || 'Unknown Product';
        await refundToWallet(
          order.user._id,
          refundAmount,
          `Refund for returned product ${productName} in order ${order.orderID}`,
          order._id
        );
      }
  
      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
  
      res.json({
        success: true,
        message: 'Return accepted successfully',
        orderStatus: order.status
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error accepting return:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  };
  const cancelOrderItem = async (req, res) => {
    try {
      const { orderId, productId } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID or product ID' });
      }
  
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      const item = order.orderItems.find(item => item._id.toString() === productId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Product not found in order' });
      }
  
      if (['Cancelled', 'Delivered', 'Returned'].includes(item.status)) {
        return res.status(400).json({ success: false, message: `Cannot cancel item with status ${item.status}` });
      }
  
      // Restore stock
      let product;
      try {
        product = await Product.findById(item.productId);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
  
        item.status = 'Cancelled';
  
        const allCancelled = order.orderItems.every(item => item.status === 'Cancelled');
        const anyCancelled = order.orderItems.some(item => item.status === 'Cancelled');
        const anyDelivered = order.orderItems.some(item => item.status === 'Delivered');
  
        let newOrderStatus = order.status;
        if (allCancelled) {
          newOrderStatus = 'Cancelled';
        } else if (anyCancelled && !anyDelivered) {
          newOrderStatus = 'Partially Cancelled';
        } else if (anyCancelled && anyDelivered) {
          newOrderStatus = 'Partially Cancelled';
        }
  
        order.status = newOrderStatus;
  
        if (!order.history) order.history = [];
        order.history.push({
          status: 'Item Cancelled',
          timestamp: new Date(),
          notes: `Product ${productId} cancelled`,
          updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
        });
  
        await order.save();
  
        res.json({
          success: true,
          message: 'Product cancelled successfully',
          orderStatus: newOrderStatus
        });
      } catch (error) {
        // Rollback stock
        if (product) {
          product.quantity -= item.quantity;
          await product.save();
        }
        throw error;
      }
    } catch (error) {
      console.error('Error cancelling order item:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  };
  const cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const orderId = req.params.orderId;
  
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
      }
  
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
  
      if (['Cancelled', 'Delivered', 'Returned'].includes(order.status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Cannot cancel order with status ${order.status}` });
      }
  
      // Restore stock for non-cancelled/non-returned items
      for (const item of order.orderItems) {
        if (!['Cancelled', 'Returned'].includes(item.status)) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            product.quantity += item.quantity;
            await product.save({ session });
          }
          item.status = 'Cancelled';
        }
      }
  
      order.status = 'Cancelled';
      order.orderStatus = 'Cancelled';
  
      if (!order.history) order.history = [];
      order.history.push({
        status: 'Order Cancelled',
        timestamp: new Date(),
        notes: 'Order cancelled by admin',
        updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
      });
  
      order.timeline.push({
        title: 'Cancelled',
        text: 'Order has been cancelled.',
        date: new Date(),
        completed: true
      });
  
      await order.save({ session });
      await session.commitTransaction();
      session.endSession();
  
      res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error cancelling order:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  };
module.exports = {
    renderOrderManage,
    renderOrderDetails,
    getOrderById,
    updateOrderStatus,
    updateProductStatus,
    renderReturnRequestsList,
    updateAllOrderItems,
    acceptReturnRequest,
    rejectReturnRequest,
    cancelOrderItem,
    cancelOrder
}