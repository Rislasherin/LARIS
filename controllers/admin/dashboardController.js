const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/OrderSchema');
const Category = require('../../models/CategorySchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');



exports.getDashboard = async (req, res) => {
    try {
        const globalTimeFilter = req.query.timeFilter || 'monthly';

      
        const totalRevenue = await calculateTotalRevenue(globalTimeFilter);
        const totalOrders = await Order.countDocuments({ status: { $nin: ['Cancelled', 'Payment Failed'] } });
        const totalProducts = await Product.countDocuments({ isBlocked: false });
        const totalCustomers = await User.countDocuments({ isAdmin: false });

   
        const { revenueChange, ordersChange, productsChange, customersChange } = await getStatsOverviewChanges(globalTimeFilter);

        const currentYear = new Date().getFullYear();
        const salesData = await getSalesData(globalTimeFilter, currentYear, new Date().getMonth());

        const topProducts = await getTopProducts(10, globalTimeFilter); 
        const { topCategory, categories: topCategories } = await getTopCategories(10, globalTimeFilter);

        console.log('Rendering Dashboard with topCategory:', topCategory);

      
        const customerInsights = await getCustomerInsights(globalTimeFilter);

     
        const inventoryStatus = await getInventoryStatus();

    
        const recentSignups = await getRecentSignups(3);

        const recentOrders = await Order.find({ status: { $nin: ['Cancelled', 'Payment Failed'] } })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        res.render('dashboard', {
            totalRevenue,
            totalOrders,
            totalProducts,
            totalCustomers,
            revenueChange,
            ordersChange,
            productsChange,
            customersChange,
            globalTimeFilter,
            topProducts,
            topCategories,
            topCategory,
            salesData,
            customerInsights,
            inventoryStatus,
            recentSignups,
            recentOrders
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
};

// Helper function to calculate date ranges
function getDateRange(timeFilter) {
    const now = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;

    if (timeFilter === 'daily') {
        endDate = new Date(now.setHours(23, 59, 59, 999)); 
        startDate = new Date(now.setHours(0, 0, 0, 0));   
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevEndDate.setHours(23, 59, 59, 999);
        prevStartDate = new Date(prevEndDate);
        prevStartDate.setHours(0, 0, 0, 0);               
    } else if (timeFilter === 'weekly') {
        endDate = now;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else if (timeFilter === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1);
    } else if (timeFilter === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevStartDate = new Date(prevEndDate.getFullYear(), 0, 1);
    } else {
   
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        prevEndDate = new Date(startDate);
        prevEndDate.setDate(prevEndDate.getDate() - 1);
        prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1);
    }

    return { startDate, endDate, prevStartDate, prevEndDate };
}


async function calculateTotalRevenue(timeFilter) {
    try {
        const { startDate, endDate } = getDateRange(timeFilter);
        const result = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled', 'Payment Failed'] },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$finalAmount' }
                }
            }
        ]);
        return result.length > 0 ? result[0].totalRevenue : 0;
    } catch (error) {
        console.error('Error calculating total revenue:', error);
        return 0;
    }
}


async function getStatsOverviewChanges(timeFilter) {
    try {
        const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(timeFilter);

      
        const currentRevenue = await calculateTotalRevenue(timeFilter);
        const currentOrders = await Order.countDocuments({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: startDate, $lte: endDate }
        });
        const currentProducts = await Product.countDocuments({
            isBlocked: false,
            createdAt: { $gte: startDate, $lte: endDate }
        });
        const currentCustomers = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: startDate, $lte: endDate }
        });

     
        const prevRevenue = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled', 'Payment Failed'] },
                    createdAt: { $gte: prevStartDate, $lte: prevEndDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$finalAmount' }
                }
            }
        ]);
        const prevOrders = await Order.countDocuments({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: prevStartDate, $lte: prevEndDate }
        });
        const prevProducts = await Product.countDocuments({
            isBlocked: false,
            createdAt: { $gte: prevStartDate, $lte: prevEndDate }
        });
        const prevCustomers = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: prevStartDate, $lte: prevEndDate }
        });

        const revenueChange = prevRevenue.length > 0 && prevRevenue[0].totalRevenue > 0
            ? Math.round(((currentRevenue - prevRevenue[0].totalRevenue) / prevRevenue[0].totalRevenue) * 100)
            : currentRevenue > 0 ? 100 : 0;
        const ordersChange = prevOrders > 0
            ? Math.round(((currentOrders - prevOrders) / prevOrders) * 100)
            : currentOrders > 0 ? 100 : 0;
        const productsChange = prevProducts > 0
            ? Math.round(((currentProducts - prevProducts) / prevProducts) * 100)
            : currentProducts > 0 ? 100 : 0;
        const customersChange = prevCustomers > 0
            ? Math.round(((currentCustomers - prevCustomers) / prevCustomers) * 100)
            : currentCustomers > 0 ? 100 : 0;

        return { revenueChange, ordersChange, productsChange, customersChange };
    } catch (error) {
        console.error('Error calculating stats overview changes:', error);
        return { revenueChange: 0, ordersChange: 0, productsChange: 0, customersChange: 0 };
    }
}

// API endpoint for Stats Overview
exports.getStatsOverviewAPI = async (req, res) => {
    try {
        const { timeFilter } = req.query;
        const totalRevenue = await calculateTotalRevenue(timeFilter);
        const totalOrders = await Order.countDocuments({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: getDateRange(timeFilter).startDate, $lte: getDateRange(timeFilter).endDate }
        });
        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            createdAt: { $gte: getDateRange(timeFilter).startDate, $lte: getDateRange(timeFilter).endDate }
        });
        const totalCustomers = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: getDateRange(timeFilter).startDate, $lte: getDateRange(timeFilter).endDate }
        });
        const { revenueChange, ordersChange, productsChange, customersChange } = await getStatsOverviewChanges(timeFilter);

        res.json({
            totalRevenue,
            totalOrders,
            totalProducts,
            totalCustomers,
            revenueChange,
            ordersChange,
            productsChange,
            customersChange
        });
    } catch (error) {
        console.error('Stats Overview API Error:', error);
        res.status(500).json({ error: 'Failed to fetch stats overview' });
    }
};


async function getCustomerInsights(timeFilter) {
    try {
        const { startDate, endDate, prevStartDate, prevEndDate } = getDateRange(timeFilter);

     
        const newCustomersThisPeriod = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: startDate, $lte: endDate }
        });
        const newCustomersPreviousPeriod = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: prevStartDate, $lte: prevEndDate }
        });
        const newCustomersChangePercent = newCustomersPreviousPeriod > 0
            ? Math.round(((newCustomersThisPeriod - newCustomersPreviousPeriod) / newCustomersPreviousPeriod) * 100)
            : newCustomersThisPeriod > 0 ? 100 : 0;

        const ordersThisPeriod = await Order.find({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: startDate, $lte: endDate }
        }).select('user');
        const userOrderCountsThisPeriod = {};
        ordersThisPeriod.forEach(order => {
            const userId = order.user.toString();
            userOrderCountsThisPeriod[userId] = (userOrderCountsThisPeriod[userId] || 0) + 1;
        });
        const returningCustomersThisPeriod = Object.values(userOrderCountsThisPeriod).filter(count => count > 1).length;
        const totalCustomersThisPeriod = Object.keys(userOrderCountsThisPeriod).length;
        const returningRateThisPeriod = totalCustomersThisPeriod > 0
            ? Math.round((returningCustomersThisPeriod / totalCustomersThisPeriod) * 100)
            : 0;

        const ordersPreviousPeriod = await Order.find({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: prevStartDate, $lte: prevEndDate }
        }).select('user');
        const userOrderCountsPreviousPeriod = {};
        ordersPreviousPeriod.forEach(order => {
            const userId = order.user.toString();
            userOrderCountsPreviousPeriod[userId] = (userOrderCountsPreviousPeriod[userId] || 0) + 1;
        });
        const returningCustomersPreviousPeriod = Object.values(userOrderCountsPreviousPeriod).filter(count => count > 1).length;
        const totalCustomersPreviousPeriod = Object.keys(userOrderCountsPreviousPeriod).length;
        const returningRatePreviousPeriod = totalCustomersPreviousPeriod > 0
            ? Math.round((returningCustomersPreviousPeriod / totalCustomersPreviousPeriod) * 100)
            : 0;

        const returningRateChangePercent = returningRatePreviousPeriod > 0
            ? Math.round(((returningRateThisPeriod - returningRatePreviousPeriod) / returningRatePreviousPeriod) * 100)
            : returningRateThisPeriod > 0 ? 100 : 0;

      
        const ordersThisPeriodFull = await Order.find({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: startDate, $lte: endDate }
        });
        const totalValueThisPeriod = ordersThisPeriodFull.reduce((sum, order) => sum + order.finalAmount, 0);
        const avgOrderValueThisPeriod = ordersThisPeriodFull.length > 0
            ? Math.round(totalValueThisPeriod / ordersThisPeriodFull.length)
            : 0;

        const ordersPreviousPeriodFull = await Order.find({
            status: { $nin: ['Cancelled', 'Payment Failed'] },
            createdAt: { $gte: prevStartDate, $lte: prevEndDate }
        });
        const totalValuePreviousPeriod = ordersPreviousPeriodFull.reduce((sum, order) => sum + order.finalAmount, 0);
        const avgOrderValuePreviousPeriod = ordersPreviousPeriodFull.length > 0
            ? Math.round(totalValuePreviousPeriod / ordersPreviousPeriodFull.length)
            : 0;

        const avgOrderChangePercent = avgOrderValuePreviousPeriod > 0
            ? Math.round(((avgOrderValueThisPeriod - avgOrderValuePreviousPeriod) / avgOrderValuePreviousPeriod) * 100)
            : avgOrderValueThisPeriod > 0 ? 100 : 0;

        return {
            newCustomers: {
                count: newCustomersThisPeriod,
                changePercent: newCustomersChangePercent
            },
            returningRate: {
                percentage: returningRateThisPeriod,
                changePercent: returningRateChangePercent
            },
            avgOrderValue: {
                amount: avgOrderValueThisPeriod,
                changePercent: avgOrderChangePercent
            }
        };
    } catch (error) {
        console.error('Error getting customer insights:', error);
        return {
            newCustomers: { count: 0, changePercent: 0 },
            returningRate: { percentage: 0, changePercent: 0 },
            avgOrderValue: { amount: 0, changePercent: 0 }
        };
    }
}


exports.getCustomerInsightsAPI = async (req, res) => {
    try {
        const { timeFilter } = req.query;
        const customerInsights = await getCustomerInsights(timeFilter);
        res.json(customerInsights);
    } catch (error) {
        console.error('Customer Insights API Error:', error);
        res.status(500).json({ error: 'Failed to fetch customer insights' });
    }
};

async function getInventoryStatus() {
    try {
  
        const totalProducts = await Product.countDocuments({ isBlocked: false });

        
        const outOfStockItemsCount = await Product.countDocuments({
            quantity: 0,
            isBlocked: false
        });

        const stockCounts = await Product.aggregate([
            {
                $match: {
                    isBlocked: false,
                    quantity: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    lowStockItems: {
                        $sum: {
                            $cond: [{ $lte: ['$quantity', '$lowStockThreshold'] }, 1, 0]
                        }
                    },
                    highStockItems: {
                        $sum: {
                            $cond: [{ $gt: ['$quantity', '$lowStockThreshold'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const lowStockItemsCount = stockCounts.length > 0 ? stockCounts[0].lowStockItems : 0;
        const highStockItemsCount = stockCounts.length > 0 ? stockCounts[0].highStockItems : 0;

    
        const highStockPercentage = totalProducts > 0 ? Math.round((highStockItemsCount / totalProducts) * 100) : 0;
        const lowStockPercentage = totalProducts > 0 ? Math.round((lowStockItemsCount / totalProducts) * 100) : 0;
        const outOfStockPercentage = totalProducts > 0 ? Math.round((outOfStockItemsCount / totalProducts) * 100) : 0;

       
        const lowStockProducts = await Product.aggregate([
            {
                $match: {
                    isBlocked: false,
                    quantity: { $gt: 0, $lte: '$lowStockThreshold' }
                }
            },
            { $limit: 10 },
            { $project: { productName: 1, quantity: 1, lowStockThreshold: 1 } }
        ]);

        const outOfStockProducts = await Product.find({
            quantity: 0,
            isBlocked: false
        })
            .select('productName quantity')
            .limit(10)
            .lean();

    
        const recentStockHistory = await Product.aggregate([
            { $match: { isBlocked: false } },
            { $unwind: '$stockHistory' },
            { $sort: { 'stockHistory.date': -1 } },
            { $limit: 5 },
            {
                $project: {
                    productName: 1,
                    quantity: '$stockHistory.quantity',
                    type: '$stockHistory.type',
                    reason: '$stockHistory.reason',
                    date: '$stockHistory.date'
                }
            }
        ]);

        return {
            lowStockItems: lowStockItemsCount,
            outOfStockItems: outOfStockItemsCount,
            distribution: {
                highStock: { count: highStockItemsCount, percentage: highStockPercentage },
                lowStock: { count: lowStockItemsCount, percentage: lowStockPercentage },
                outOfStock: { count: outOfStockItemsCount, percentage: outOfStockPercentage }
            },
            lowStockProducts,
            outOfStockProducts,
            recentStockHistory
        };
    } catch (error) {
        console.error('Error getting inventory status:', error);
        return {
            lowStockItems: 0,
            outOfStockItems: 0,
            distribution: {
                highStock: { count: 0, percentage: 0 },
                lowStock: { count: 0, percentage: 0 },
                outOfStock: { count: 0, percentage: 0 }
            },
            lowStockProducts: [],
            outOfStockProducts: [],
            recentStockHistory: []
        };
    }
}


async function getRecentSignups(limit) {
    try {
        const recentUsers = await User.find({ isAdmin: false })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('name createdAt');
        
        return recentUsers.map(user => {
            const now = new Date();
            const createdAt = new Date(user.createdAt);
            const diffInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
            
            let timeAgo;
            if (diffInDays === 0) {
                timeAgo = 'today';
            } else if (diffInDays === 1) {
                timeAgo = '1 day ago';
            } else {
                timeAgo = `${diffInDays} days ago`;
            }
            
            const firstLetter = user.name.charAt(0).toUpperCase();
            
            return {
                name: user.name,
                firstLetter,
                timeAgo
            };
        });
    } catch (error) {
        console.error('Error getting recent signups:', error);
        return [];
    }
}

exports.getInventoryStatus = async (req, res) => {
    try {
        const inventoryStatus = await getInventoryStatus();
        res.json(inventoryStatus);
    } catch (error) {
        console.error('Inventory Status API Error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory status' });
    }
};


exports.getSalesDataAPI = async (req, res) => {
    try {
        const { timeFilter, year, month } = req.query;
        const data = await getSalesData(timeFilter, parseInt(year) || new Date().getFullYear(), month ? parseInt(month) : null);
        res.json({
            labels: data.labels,
            values: data.values
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Error fetching sales data' });
    }
};


async function getSalesData(timeFilter, year, month) {
    try {
        let labels = [];
        let values = [];
        let matchCriteria = { status: { $nin: ['Cancelled', 'Payment Failed'] } };
        let groupBy = {};
        let sortBy = {};

        year = year || new Date().getFullYear();

        if (timeFilter === 'yearly') {
            const startYear = year - 4;
            const endYear = year;
            labels = Array.from({ length: endYear - startYear + 1 }, (_, i) => (startYear + i).toString());
            matchCriteria.createdAt = {
                $gte: new Date(`${startYear}-01-01`),
                $lte: new Date(`${endYear}-12-31`)
            };
            groupBy = { _id: { $year: '$createdAt' }, totalSales: { $sum: '$finalAmount' } };
            sortBy = { '_id': 1 };
        } else if (timeFilter === 'monthly') {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            labels = monthNames;
            month = month !== null && month !== undefined ? month : new Date().getMonth();
            matchCriteria.createdAt = {
                $gte: new Date(year, month, 1),
                $lte: new Date(year, month + 1, 0)
            };
            groupBy = { _id: { $month: '$createdAt' }, totalSales: { $sum: '$finalAmount' } };
            sortBy = { '_id': 1 };
        } else if (timeFilter === 'weekly') {
            month = month !== null && month !== undefined ? month : new Date().getMonth();
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);
            const weeks = [];
            let currentDate = new Date(startDate);
            let weekNumber = 1;

            while (currentDate <= endDate) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);
                if (weekEnd > endDate) weekEnd.setDate(endDate.getDate());
                weeks.push({ weekNumber, start: weekStart, end: weekEnd });
                currentDate.setDate(currentDate.getDate() + 7);
                weekNumber++;
            }

            labels = weeks.map(week => `Week ${week.weekNumber} (${week.start.getDate()}-${week.end.getDate()})`);
            matchCriteria.createdAt = { $gte: startDate, $lte: endDate };
            const orders = await Order.find(matchCriteria).select('createdAt finalAmount');
            values = Array(weeks.length).fill(0);
            orders.forEach(order => {
                const orderDate = new Date(order.createdAt);
                for (let i = 0; i < weeks.length; i++) {
                    if (orderDate >= weeks[i].start && orderDate <= weeks[i].end) {
                        values[i] += order.finalAmount;
                        break;
                    }
                }
            });
            return { labels, values };
        }

        if (timeFilter !== 'weekly') {
            const result = await Order.aggregate([{ $match: matchCriteria }, { $group: groupBy }, { $sort: sortBy }]);
            values = Array(labels.length).fill(0);
            result.forEach(item => {
                if (timeFilter === 'yearly') {
                    const yearIndex = labels.indexOf(item._id.toString());
                    if (yearIndex !== -1) values[yearIndex] = item.totalSales;
                } else if (timeFilter === 'monthly') {
                    const monthIndex = item._id - 1;
                    if (monthIndex >= 0 && monthIndex < 12) values[monthIndex] = item.totalSales;
                }
            });
        }

        return { labels, values };
    } catch (error) {
        console.error('Error getting sales data:', error);
        return { labels: [], values: [] };
    }
}


async function getTopProducts(limit = 10, timeFilter) { 
    try {
        const { startDate, endDate } = getDateRange(timeFilter);
        const productsFromOrders = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled', 'Payment Failed'] },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$orderItems' },
            {
                $group: {
                    _id: '$orderItems.productId',
                    unitsSold: { $sum: '$orderItems.quantity' },
                    revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
                }
            },
            { $sort: { unitsSold: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    productName: { $ifNull: ['$product.productName', 'Product Not Found'] },
                    unitsSold: 1,
                    revenue: 1,
                    quantity: '$product.quantity',
                    lowStockThreshold: '$product.lowStockThreshold',
                    productImage: '$product.productImage'
                }
            }
        ]);

        console.log('Top Products:', productsFromOrders); 
        return productsFromOrders;
    } catch (error) {
        console.error('Error getting top products:', error);
        return [];
    }
}

async function getTopCategories(limit = 10, timeFilter) {
    try {
        const { startDate, endDate } = getDateRange(timeFilter);
        const categoryData = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled', 'Payment Failed'] },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$product.category',
                    unitsSold: { $sum: '$orderItems.quantity' },
                    revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    name: { $ifNull: ['$category.name', 'Uncategorized'] },
                    unitsSold: 1,
                    revenue: 1
                }
            }
        ]);

        console.log('Category Data:', categoryData); 

      
        const { prevStartDate, prevEndDate } = getDateRange(timeFilter);
        const previousPeriodData = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled', 'Payment Failed'] },
                    createdAt: { $gte: prevStartDate, $lte: prevEndDate }
                }
            },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$product.category',
                    revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
                }
            }
        ]);

        const previousPeriodMap = {};
        previousPeriodData.forEach(item => {
            previousPeriodMap[item._id] = item.revenue;
        });

        const categoriesWithGrowth = categoryData.map(category => {
            const previousRevenue = previousPeriodMap[category._id] || 0;
            const growthRate = previousRevenue > 0
                ? Math.round(((category.revenue - previousRevenue) / previousRevenue) * 100)
                : category.revenue > 0 ? 100 : 0;

            return {
                ...category,
                growthRate
            };
        });

      
        const topCategory = categoriesWithGrowth[0] || {
            name: 'N/A',
            revenue: 0,
            unitsSold: 0,
            growthRate: 0
        };

        console.log('Top Category:', topCategory);

        return {
            topCategory,
            categories: categoriesWithGrowth
        };
    } catch (error) {
        console.error('Error getting top categories:', error);
        return {
            topCategory: {
                name: 'N/A',
                revenue: 0,
                unitsSold: 0,
                growthRate: 0
            },
            categories: []
        };
    }
}

exports.getCategoryDataAPI = async (req, res) => {
    try {
        const { timeFilter } = req.query;
        const { topCategory, categories } = await getTopCategories(10, timeFilter);
        res.json({ topCategory, categories });
    } catch (error) {
        console.error('Category Data API Error:', error);
        res.status(500).json({ error: 'Error fetching category data' });
    }
};

module.exports = exports;