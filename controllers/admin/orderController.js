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
    try {
        const orderId = req.params.orderId;
        const newStatus = req.body.status; 
        const notes = req.body.notes; 
        console.log('Updating order status:', { orderId, newStatus });

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const currentStatus = order.orderStatus || order.status; 

    
        order.orderStatus = newStatus;
        order.status = newStatus;
        

        if (order.history) {
            order.history.push({
                status: newStatus,
                timestamp: new Date(),
                notes: notes || `Status changed to ${newStatus}`,
                updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
            });
        }

        await order.save();
        res.json({ success: true, message: "Order status updated successfully!" });

    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const updateProductStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productStatuses } = req.body;
        console.log('Request body:', req.body);

        const order = await Order.findOne({ _id: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
            return res.status(400).json({ success: false, message: 'Cannot update products in Cancelled or Returned orders' });
        }

        for (const { productId, status } of productStatuses) {
            const product = order.products.find(p => p._id.toString() === productId);
            if (!product) {
                console.log(`Product ${productId} not found in order`);
                continue;
            }

            if (product.productStatus === 'Cancelled' || product.productStatus === 'Returned') {
                console.log(`Skipping ${productId}: Already ${product.productStatus}`);
                continue;
            }
            if (product.productStatus === 'Shipped' && (status === 'Pending' || status === 'Processing')) {
                console.log(`Skipping ${productId}: Cannot revert Shipped to ${status}`);
                continue;
            }
            if (product.productStatus === 'Processing' && status === 'Pending') {
                console.log(`Skipping ${productId}: Cannot revert Processing to Pending`);
                continue;
            }

            product.productStatus = status;
            console.log(`Updated ${productId} to ${status}`);
        }

        const productCount = order.products.length;
        const deliveredCount = order.products.filter(p => p.productStatus === 'Delivered').length;

        if (productCount > 1) { 
            if (deliveredCount > 0 && deliveredCount < productCount) {
                order.orderStatus = 'Partially Delivered';
                console.log('Order status set to Partially Delivered');
            } else if (deliveredCount === productCount) {
                order.orderStatus = 'Delivered';
                console.log('Order status set to Delivered');
            }
        }

       
        const allCancelled = order.products.every(p => p.productStatus === 'Cancelled');
        if (allCancelled) {
            order.orderStatus = 'Cancelled';
            console.log('All products cancelled - updating order to Cancelled');
        }

        await order.save();
        res.json({ success: true, message: 'Product statuses updated successfully!' });

    } catch (error) {
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
    try {
      const { orderId } = req.params;
      const { status, productIds } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
      }
  
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  
      if (!order.history) order.history = [];
  
      let updatedCount = 0;
      let skippedCount = 0;
  
      order.orderItems.forEach(item => {
        if (productIds.includes(item._id.toString())) {
          if (item.status === 'Returned' || 
              (item.status === 'Delivered' && status !== 'Delivered') || 
              (item.status === 'Cancelled' && status !== 'Cancelled')) {
            skippedCount++;
            return;
          }
          item.status = status;
          updatedCount++;
        }
      });
  
      const allDelivered = order.orderItems.every(item => item.status === 'Delivered');
      const allShipped = order.orderItems.every(item => item.status === 'Shipped');
      const anyCancelled = order.orderItems.some(item => item.status === 'Cancelled');
      const allCancelled = order.orderItems.every(item => item.status === 'Cancelled');
      const anyDelivered = order.orderItems.some(item => item.status === 'Delivered');
  
      let newOrderStatus = order.status;
      if (allDelivered) newOrderStatus = 'Delivered';
      else if (allShipped) newOrderStatus = 'Shipped'; // Add this condition
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
          completed: true,
        });
      }
  
      order.history.push({
        status: 'Bulk Update',
        timestamp: new Date(),
        notes: `${updatedCount} product(s) status changed to ${status}${skippedCount > 0 ? `, ${skippedCount} item(s) skipped` : ''}`,
        updatedBy: req.session.admin ? req.session.admin.username : 'Admin'
      });
  
      await order.save();
  
      res.json({
        success: true,
        message: `${updatedCount} item(s) updated${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}`,
        orderStatus: newOrderStatus
      });
    } catch (error) {
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
    try {
        const { orderId, productId } = req.body;

        if (!orderId || !productId) {
            return res.status(400).json({ success: false, message: 'Order ID and Product ID are required' });
        }

        const order = await Order.findById(orderId)
        .populate('user','name email')
        .populate({
            path: 'orderItems.productId',
                select: 'productName'
        })
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const item = order.orderItems.find(item => item._id.toString() === productId);
        if (!item || item.status !== 'Return Requested') {
            return res.status(400).json({ success: false, message: 'No return request found for this item' });
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

        await order.save();

        const refundAmount = item.price * item.quantity;
        if (order.paymentMethod !== 'cod' && refundAmount > 0) {
            const productName = item.productId?.productName || 'Unknown Product';
            await refundToWallet(
                order.user._id,
                refundAmount,
                `Refund for returned product ${item.productId.productName} in order ${order.orderID}`,
                order._id
            );
        }

        res.json({
            success: true,
            message: 'Return accepted successfully',
            orderStatus: order.status
        });
    } catch (error) {
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
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const item = order.orderItems.find(item => item._id.toString() === productId);
        if (!item) return res.status(404).json({ success: false, message: 'Product not found in order' });

        // Prevent cancellation if already in certain states
        if (['Cancelled', 'Delivered', 'Returned'].includes(item.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel item with status ${item.status}` });
        }

        item.status = 'Cancelled';

        // Update order status based on item statuses
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
        } else {
            newOrderStatus = order.status; // Keep existing status if no change needed
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
        console.error('Error cancelling order item:', error);
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
    cancelOrderItem
}