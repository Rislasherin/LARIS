const express = require("express");
const Order = require("../../models/OrderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/CategorySchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const getSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      quickSelect,
      compareWith = "none",
      page = 1,
      orderStatus = "all",
      limit = 10,
      inventoryFilter = "all",
    } = req.query;


    let dateFilter = {};
    let compareFilter = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const setDateRange = (start, end) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      };
    };

    if (quickSelect === "custom" && startDate && endDate) {
      if (!isNaN(new Date(startDate)) && !isNaN(new Date(endDate))) {
        dateFilter = setDateRange(startDate, endDate);
      } else {
        console.error("Invalid custom date range:", { startDate, endDate });
        const defaultStart = new Date(today);
        defaultStart.setDate(today.getDate() - 29);
        dateFilter = setDateRange(defaultStart, today);
      }
    } else if (quickSelect && quickSelect !== "custom") {
      switch (quickSelect) {
        case "today":
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          dateFilter = setDateRange(startOfDay, today);
          break;
        case "last7days":
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - 6);
          dateFilter = setDateRange(weekStart, today);
          break;
        case "last30days":
          const monthStart = new Date(today);
          monthStart.setDate(today.getDate() - 29);
          dateFilter = setDateRange(monthStart, today);
          break;
        case "year":
          const yearStart = new Date(today.getFullYear(), 0, 1);
          dateFilter = setDateRange(yearStart, today);
          break;
        default:
          const defaultStart = new Date(today);
          defaultStart.setDate(today.getDate() - 29);
          dateFilter = setDateRange(defaultStart, today);
      }
    } else {
      const defaultStart = new Date(today);
      defaultStart.setDate(today.getDate() - 29);
      dateFilter = setDateRange(defaultStart, today);
    }

    if (compareWith !== "none") {
      const start = new Date(dateFilter.createdAt.$gte);
      const end = new Date(dateFilter.createdAt.$lte);
      const duration = end - start;
      if (compareWith === "prevPeriod") {
        const prevStart = new Date(start.getTime() - duration);
        const prevEnd = new Date(end.getTime() - duration);
        compareFilter = setDateRange(prevStart, prevEnd);
      } else if (compareWith === "prevYear") {
        const prevStart = new Date(start);
        prevStart.setFullYear(start.getFullYear() - 1);
        const prevEnd = new Date(end);
        prevEnd.setFullYear(end.getFullYear() - 1);
        compareFilter = setDateRange(prevStart, prevEnd);
      }
    }

    const skip = (page - 1) * limit;

    const deliveredOrders = await Order.find({
      ...dateFilter,
      status: "Delivered",
    })
      .populate("user", "name email")
      .populate("orderItems.productId")
      .sort({ createdAt: -1 })
      .lean();

    const totalDeliveredOrders = deliveredOrders.length;


    let orderQuery = { ...dateFilter };
    if (orderStatus !== "all") {
      orderQuery.status = orderStatus;
    }
    console.log("Order Query:", JSON.stringify(orderQuery, null > 2));
    const filteredOrders = await Order.find(orderQuery)
      .populate("user", "name email")
      .populate("orderItems.productId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    console.log("Filtered Orders Count:", filteredOrders.length);

  
    const totalOrders = await Order.countDocuments(orderQuery).catch((err) => {
      console.error("Error counting orders:", err);
      return 0;
    });

 
    const topProductsAggregation = await Order.aggregate([
      { $match: { ...dateFilter, status: "Delivered" } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.productId",
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: "$product.productName",
          totalSold: 1,
          totalRevenue: 1,
          category: "$category.name",
          averagePrice: {
            $cond: [
              { $eq: ["$totalSold", 0] },
              0,
              { $divide: ["$totalRevenue", "$totalSold"] },
            ],
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]).catch((err) => {
      console.error("Top Products Aggregation Error:", err);
      return [];
    });

  
    const topCategoriesAggregation = await Order.aggregate([
      { $match: { ...dateFilter, status: "Delivered" } },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
          },
          uniqueProducts: { $addToSet: "$orderItems.productId" },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          name: "$category.name",
          totalSold: 1,
          totalRevenue: 1,
          productCount: { $size: "$uniqueProducts" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]).catch((err) => {
      console.error("Top Categories Aggregation Error:", err);
      return [];
    });


    let inventoryMatch = {};
    if (inventoryFilter === "outOfStock") {
      inventoryMatch = { quantity: 0 };
    } else if (inventoryFilter === "inStock") {
      inventoryMatch = { quantity: { $gt: 10 } };
    } else if (inventoryFilter === "lowStock") {
      inventoryMatch = { quantity: { $gt: 0, $lte: 10 } };
    }

    const productInventoryAggregation = await Product.aggregate([
      { $match: inventoryMatch },
      {
        $lookup: {
          from: "orders",
          let: { productId: "$_id" },
          pipeline: [
            { $match: { ...dateFilter, status: "Delivered" } },
            { $unwind: "$orderItems" },
            {
              $match: {
                $expr: { $eq: ["$orderItems.productId", "$$productId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalSold: { $sum: "$orderItems.quantity" },
              },
            },
          ],
          as: "salesData",
        },
      },
      {
        $project: {
          name: "$productName",
          price: "$salePrice",
          stock: { $ifNull: ["$quantity", 0] },
          salesCount: { $arrayElemAt: ["$salesData.totalSold", 0] },
          image: { $arrayElemAt: ["$productImage", 0] },
          updatedAt: "$updatedAt",
        },
      },
      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]).catch((err) => {
      console.error("Product Inventory Aggregation Error:", err);
      return [];
    });

    const productInventory = productInventoryAggregation.map((product) => ({
      ...product,
      salesCount: product.salesCount || 0,
    }));

    const totalInventoryItems = await Product.countDocuments(
      inventoryMatch
    ).catch((err) => {
      console.error("Error counting inventory items:", err);
      return 0;
    });

 
    let compareData = null;
    if (compareWith !== "none") {
      const compareOrders = await Order.find({
        ...compareFilter,
        status: "Delivered",
      })
        .populate("user", "name email")
        .populate("orderItems.productId")
        .sort({ createdAt: -1 })
        .lean();

      compareData = {
        totalOrders: compareOrders.length,
        totalAmount: compareOrders.reduce(
          (sum, order) => sum + (order.finalAmount || 0),
          0
        ),
        totalDiscount: compareOrders.reduce(
          (sum, order) =>
            sum + (order.discount || 0) + (order.couponDiscount || 0),
          0
        ),
      };
    }


    const reportData = {
      totalOrders: totalDeliveredOrders,
      totalAmount: deliveredOrders.reduce(
        (sum, order) => sum + (order.finalAmount || 0),
        0
      ),
      totalDiscount: deliveredOrders.reduce(
        (sum, order) =>
          sum + (order.discount || 0) + (order.couponDiscount || 0),
        0
      ),
      couponOrders: deliveredOrders.filter(
        (o) => o.couponCode && o.couponDiscount > 0
      ).length,
      totalCouponDiscount: deliveredOrders.reduce(
        (sum, o) => sum + (o.couponDiscount || 0),
        0
      ),
      topProducts: topProductsAggregation.map((item) => ({
        name: item.name || "Unknown",
        sales: item.totalSold || 0,
        revenue: item.totalRevenue || 0,
        category: item.category || "Uncategorized",
        averagePrice: item.averagePrice || 0,
      })),
      topCategories: topCategoriesAggregation.map((item) => ({
        name: item.name || "Unknown",
        sales: item.totalSold || 0,
        revenue: item.totalRevenue || 0,
        productCount: item.productCount || 0,
      })),
      orders: filteredOrders.map((order) => ({
        orderId: order.orderID,
        date: order.createdAt,
        user: order.user,
        products: order.orderItems || [],
        originalAmount: order.orderItems.reduce(
          (sum, p) => sum + (p.price * p.quantity || 0),
          0
        ),
        totalAmount: order.finalAmount || 0,
        couponCode: order.couponCode || null,
        couponDiscount: order.couponDiscount || 0,
        offerDiscount: order.discount || 0,
        paymentMethod: order.paymentMethod,
        status: order.status,
      })),
      productInventory,
      compareData,
    };

  
    let salesChartData = { labels: [], sales: [], orders: [] };
    try {
      const salesChartAggregation = await Order.aggregate([
        { $match: { ...dateFilter, status: "Delivered" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalSales: { $sum: { $ifNull: ["$finalAmount", 0] } },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch((err) => {
        console.error("Sales Chart Aggregation Error:", err);
        return [];
      });
      salesChartData = {
        labels: salesChartAggregation.map((item) => item._id || "N/A"),
        sales: salesChartAggregation.map((item) => item.totalSales || 0),
        orders: salesChartAggregation.map((item) => item.orderCount || 0),
      };
    } catch (aggError) {
      console.error("Outer Error in salesChartAggregation:", aggError);
    }

    let categoriesChartData = { labels: [], data: [] };
    try {
      const categoriesChartAggregation = await Order.aggregate([
        { $match: { ...dateFilter, status: "Delivered" } },
        { $unwind: "$orderItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product.category",
            totalRevenue: {
              $sum: {
                $multiply: ["$orderItems.price", "$orderItems.quantity"],
              },
            },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $project: {
            name: "$category.name",
            revenue: { $ifNull: ["$totalRevenue", 0] },
          },
        },
        { $sort: { revenue: -1 } },
      ]).catch((err) => {
        console.error("Categories Chart Aggregation Error:", err);
        return [];
      });
      categoriesChartData = {
        labels: categoriesChartAggregation.map(
          (item) => item.name || "Uncategorized"
        ),
        data: categoriesChartAggregation.map((item) => item.revenue || 0),
      };
    } catch (aggError) {
      console.error("Outer Error in categoriesChartAggregation:", aggError);
    }

    let trendChartData = { labels: [], orders: [], discounts: [] };
    try {
      const trendChartAggregation = await Order.aggregate([
        { $match: { ...dateFilter, status: "Delivered" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalOrders: { $sum: 1 },
            totalDiscounts: {
              $sum: {
                $add: [
                  { $ifNull: ["$discount", 0] },
                  { $ifNull: ["$couponDiscount", 0] },
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch((err) => {
        console.error("Trend Chart Aggregation Error:", err);
        return [];
      });
      trendChartData = {
        labels: trendChartAggregation.map((item) => item._id || "N/A"),
        orders: trendChartAggregation.map((item) => item.totalOrders || 0),
        discounts: trendChartAggregation.map(
          (item) => item.totalDiscounts || 0
        ),
      };
    } catch (aggError) {
      console.error("Outer Error in trendChartAggregation:", aggError);
    }


    reportData.salesChartData = salesChartData;
    reportData.categoriesChartData = categoriesChartData;
    reportData.trendChartData = trendChartData;

    res.render("salesReport", {
      report: reportData,
      startDate: dateFilter.createdAt.$gte.toISOString().split("T")[0],
      endDate: dateFilter.createdAt.$lte.toISOString().split("T")[0],
      quickSelect: quickSelect || "last30days",
      compareWith,
      currentPage: parseInt(page),
      limit: parseInt(limit),
      totalOrders,
      totalInventoryItems,
      orderStatus,
      inventoryFilter,
    });
  } catch (error) {
    console.error("Critical Controller Error:", error.stack);
    res.status(500).send("Server Error: " + error.message);
  }
};

const downloadSalesReportPDF = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      quickSelect,
      compareWith = "none",
      orderStatus = "all",
    } = req.query;


    const truncateText = (text, maxLength) => {
      if (!text) return "";
      return text.length > maxLength
        ? text.substring(0, maxLength - 3) + "..."
        : text;
    };


    let dateFilter = {};
    let compareFilter = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const setDateRange = (start, end) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return {
        createdAt: { $gte: startDate, $lte: endDate },
      };
    };

 
    if (quickSelect === "custom" && startDate && endDate) {
      dateFilter = setDateRange(startDate, endDate);
    } else {
      switch (quickSelect) {
        case "today":
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          dateFilter = setDateRange(startOfDay, today);
          break;
        case "last7days":
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - 6);
          dateFilter = setDateRange(weekStart, today);
          break;
        case "last30days":
          const monthStart = new Date(today);
          monthStart.setDate(today.getDate() - 29);
          dateFilter = setDateRange(monthStart, today);
          break;
        case "year":
          const yearStart = new Date(today.getFullYear(), 0, 1);
          dateFilter = setDateRange(yearStart, today);
          break;
        default:
          const defaultStart = new Date(today);
          defaultStart.setDate(today.getDate() - 29);
          dateFilter = setDateRange(defaultStart, today);
      }
    }

    if (compareWith !== "none") {
      const start = new Date(dateFilter.createdAt.$gte);
      const end = new Date(dateFilter.createdAt.$lte);
      const duration = end - start;
      if (compareWith === "prevPeriod") {
        const prevStart = new Date(start.getTime() - duration);
        const prevEnd = new Date(end.getTime() - duration);
        compareFilter = setDateRange(prevStart, prevEnd);
      } else if (compareWith === "prevYear") {
        const prevStart = new Date(start);
        prevStart.setFullYear(start.getFullYear() - 1);
        const prevEnd = new Date(end);
        prevEnd.setFullYear(end.getFullYear() - 1);
        compareFilter = setDateRange(prevStart, prevEnd);
      }
    }


    const deliveredOrders = await Order.find({
      ...dateFilter,
      status: "Delivered",
    })
      .populate("user", "name email")
      .populate("orderItems.productId")
      .sort({ createdAt: -1 })
      .lean();

    let query = { ...dateFilter };
    if (orderStatus !== "all") {
      query.status = orderStatus;
    }

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("orderItems.productId")
      .sort({ createdAt: -1 })
      .lean();


    const topProductsAggregation = await Order.aggregate([
      { $match: { ...dateFilter, status: "Delivered" } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.productId",
          totalSold: { $sum: "$orderItems.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] },
          },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: "$product.productName",
          totalSold: 1,
          totalRevenue: 1,
          category: "$category.name",
          averagePrice: {
            $cond: [
              { $eq: ["$totalSold", 0] },
              0,
              { $divide: ["$totalRevenue", "$totalSold"] },
            ],
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]).catch((err) => {
      console.error("Top Products Aggregation Error:", err);
      return [];
    });


    let compareData = null;
    if (compareWith !== "none") {
      const compareOrders = await Order.find({
        ...compareFilter,
        status: "Delivered",
      })
        .populate("user", "name email")
        .populate("orderItems.productId")
        .sort({ createdAt: -1 })
        .lean();
      compareData = {
        totalOrders: compareOrders.length,
        totalAmount: compareOrders.reduce(
          (sum, order) => sum + (order.finalAmount || 0),
          0
        ),
        totalDiscount: compareOrders.reduce(
          (sum, order) =>
            sum + (order.discount || 0) + (order.couponDiscount || 0),
          0
        ),
        couponOrders: compareOrders.filter(
          (o) => o.couponCode && o.couponDiscount > 0
        ).length,
        totalCouponDiscount: compareOrders.reduce(
          (sum, o) => sum + (o.couponDiscount || 0),
          0
        ),
      };
    }


    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      layout: "landscape",
      bufferPages: true,
      autoFirstPage: true,
    });

    const fileName = `sales_report_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../../public/downloads", fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);


    const formatCurrency = (value) => {
      return parseFloat(value || 0).toFixed(2);
    };


    let pageNumber = 1;
    doc.on("pageAdded", () => {
      pageNumber++;
    });

   
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Sales Report", { align: "center" });

    doc
      .fontSize(12)
      .font("Helvetica")
      .text(
        `Date Range: ${dateFilter.createdAt.$gte.toLocaleDateString()} - ${dateFilter.createdAt.$lte.toLocaleDateString()}`,
        { align: "center" }
      );

    if (orderStatus !== "all") {
      doc.text(`Order Status: ${orderStatus}`, { align: "center" });
    }

    if (compareWith !== "none") {
      doc.text(
        `Compared With: ${
          compareWith === "prevPeriod" ? "Previous Period" : "Last Year"
        }`,
        { align: "center" }
      );
    }
    doc.moveDown(2);

 
    const totalSales = deliveredOrders
      .reduce((sum, order) => sum + (order.finalAmount || 0), 0)
      .toFixed(2);
    const totalOrders = deliveredOrders.length;
    const totalDiscount = deliveredOrders
      .reduce(
        (sum, order) =>
          sum + (order.discount || 0) + (order.couponDiscount || 0),
        0
      )
      .toFixed(2);
    const avgOrderValue =
      totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : "0.00";
    const couponOrders = deliveredOrders.filter(
      (o) => o.couponCode && o.couponDiscount > 0
    ).length;
    const totalCouponDiscount = deliveredOrders
      .reduce((sum, o) => sum + (o.couponDiscount || 0), 0)
      .toFixed(2);

  
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Summary (Delivered Orders)", { underline: true });
    doc.moveDown(0.5);
    const summaryData = [
      ["Total Sales:", `${totalSales}`, "Delivered Orders:", `${totalOrders}`],
      [
        "Total Discounts:",
        `${totalDiscount}`,
        "Average Order Value:",
        `${avgOrderValue}`,
      ],
      [
        "Orders with Coupon:",
        `${couponOrders}`,
        "Total Coupon Discount:",
        `${totalCouponDiscount}`,
      ],
    ];

    doc.font("Helvetica");
    summaryData.forEach((row) => {
      doc.fontSize(11);
      doc.text(row[0], 50, doc.y, { continued: true, width: 120 });
      doc.text(row[1], { continued: true, width: 80 });
      doc.text(row[2], { continued: true, width: 150 });
      doc.text(row[3]);
    });

  
    if (compareData) {
      doc.moveDown(1.5);
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Comparison Summary (Delivered Orders):", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      const compareTotalSales = compareData.totalAmount.toFixed(2);
      const compareTotalOrders = compareData.totalOrders;
      const compareTotalDiscount = compareData.totalDiscount.toFixed(2);
      const compareAvgOrderValue =
        compareTotalOrders > 0
          ? (compareData.totalAmount / compareTotalOrders).toFixed(2)
          : "0.00";
      const compareCouponOrders = compareData.couponOrders;
      const compareTotalCouponDiscount =
        compareData.totalCouponDiscount.toFixed(2);

      doc.text(
        `Total Sales: ${compareTotalSales} (${
          compareTotalOrders === 0
            ? "N/A"
            : `${(
                ((totalSales - compareData.totalAmount) /
                  compareData.totalAmount) *
                100
              ).toFixed(1)}%`
        })`,
        50,
        doc.y + 15
      );
      doc.text(
        `Delivered Orders: ${compareTotalOrders} (${
          compareTotalOrders === 0
            ? "N/A"
            : `${(
                ((totalOrders - compareData.totalOrders) /
                  compareData.totalOrders) *
                100
              ).toFixed(1)}%`
        })`,
        50,
        doc.y + 15
      );
      doc.text(
        `Total Discounts: ${compareTotalDiscount} (${
          compareTotalOrders === 0
            ? "N/A"
            : `${(
                ((totalDiscount - compareData.totalDiscount) /
                  compareData.totalDiscount) *
                100
              ).toFixed(1)}%`
        })`,
        50,
        doc.y + 15
      );
      doc.text(
        `Average Order Value: ${compareAvgOrderValue} (${
          compareTotalOrders === 0
            ? "N/A"
            : `${Math.abs(
                ((totalSales / totalOrders -
                  compareData.totalAmount / compareTotalOrders) /
                  (compareData.totalAmount / compareTotalOrders)) *
                  100
              ).toFixed(1)}%`
        })`,
        50,
        doc.y + 15
      );
      doc.text(
        `Orders with Coupon: ${compareCouponOrders} (${
          compareTotalOrders === 0
            ? "N/A"
            : `${(
                ((couponOrders - compareData.couponOrders) /
                  compareData.couponOrders) *
                100
              ).toFixed(1)}%`
        })`,
        50,
        doc.y + 15
      );
      doc.text(
        `Total Coupon Discount: ${compareTotalCouponDiscount} (${
          compareTotalOrders === 0
            ? "N/A"
            : `${(
                ((totalCouponDiscount - compareData.totalCouponDiscount) /
                  compareData.totalCouponDiscount) *
                100
              ).toFixed(1)}%`
        })`,
        50,
        doc.y + 15
      );
    }

    doc.moveDown(1.5);


doc
  .fontSize(14)
  .font("Helvetica-Bold")
  .text(
    `Detailed Orders (Status: ${
      orderStatus === "all" ? "All" : orderStatus
    })`,
    { underline: true }
  );
doc.moveDown(0.5);


const tableTop = doc.y;
const tableLeft = 50;
const pageWidth = doc.page.width - 100;


const columns = [
  { header: "Order ID", width: pageWidth * 0.1, align: "left" },
  { header: "Date", width: pageWidth * 0.12, align: "left" },
  { header: "Customer", width: pageWidth * 0.15, align: "left" },
  { header: "Products", width: pageWidth * 0.09, align: "center" },
  { header: "Subtotal", width: pageWidth * 0.12, align: "right" },
  { header: "Discount", width: pageWidth * 0.1, align: "right" },
  { header: "Coupon", width: pageWidth * 0.14, align: "left" },
  { header: "Total", width: pageWidth * 0.09, align: "right" },
  { header: "Status", width: pageWidth * 0.09, align: "center" },
];


const drawTableHeaders = () => {
  const headerY = doc.y;
  const rowHeight = 25;


  doc
    .fillColor("#e0e0e0")
    .rect(tableLeft, headerY, pageWidth, rowHeight)
    .fill();


  doc
    .lineWidth(0.5)
    .strokeColor("#aaaaaa")
    .rect(tableLeft, headerY, pageWidth, rowHeight)
    .stroke();


  let currentX = tableLeft;
  doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold");

  columns.forEach((column) => {
    doc.text(
      column.header,
      currentX + 4,
      headerY + 8,
      { width: column.width - 8, align: column.align }
    );
    currentX += column.width;
  });

  doc.y = headerY + rowHeight;
};


drawTableHeaders();

let currentY = doc.y;
let isGray = false;
const rowHeight = 25;


for (let i = 0; i < Math.min(orders.length, 100); i++) {
  const order = orders[i];

  if (currentY + rowHeight * 2 > doc.page.height - 80) {
    doc.addPage();
    currentY = 50;


    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Sales Report (Continued)", { align: "center" });
    doc.moveDown(0.5);
    currentY = doc.y;

    drawTableHeaders();
    currentY = doc.y;
    isGray = false;
  }

 
  if (isGray) {
    doc
      .fillColor("#f5f5f5")
      .rect(tableLeft, currentY, pageWidth, rowHeight)
      .fill();
  }
  isGray = !isGray;


  doc
    .lineWidth(0.3)
    .strokeColor("#dddddd")
    .rect(tableLeft, currentY, pageWidth, rowHeight)
    .stroke();

  doc.fillColor("#000000").font("Helvetica").fontSize(9);

  
  const orderData = [
    truncateText(`#${order.orderID || "N/A"}`, 12),
    new Date(order.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    truncateText(order.user?.name || "Unknown", 18),
    `${(order.orderItems || []).length} item${
      (order.orderItems || []).length !== 1 ? "s" : ""
    }`,
    formatCurrency(
      (order.orderItems || []).reduce(
        (sum, p) => sum + (p.price * p.quantity || 0),
        0
      )
    ),
    formatCurrency(order.discount || 0),
    order.couponCode
      ? truncateText(
          `${order.couponCode} (-${formatCurrency(order.couponDiscount || 0)})`,
          18
        )
      : "N/A",
    formatCurrency(order.finalAmount || 0),
    truncateText(order.status || "Unknown", 10),
  ];


  let currentX = tableLeft;
  columns.forEach((column, index) => {
    doc.text(
      orderData[index],
      currentX + 4,
      currentY + 8,
      { width: column.width - 8, align: column.align }
    );
    currentX += column.width;
  });

  currentY += rowHeight;
}

if (orders.length === 0) {
  doc.text(
    "No orders found for the selected filter.",
    tableLeft,
    currentY + 10
  );
}

const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  const isLastPage = i === totalPages - 1;
  doc
    .fontSize(8)
    .font("Helvetica")
    .text(
      isLastPage
        ? `Page ${i + 1} of ${totalPages}`
        : `Page ${i + 1} of ${totalPages} - Continued on next page`,
      tableLeft,
      doc.page.height - 50,
      { align: "center", width: pageWidth }
    );
}

doc.end();

stream.on("finish", () => {
  res.download(filePath, fileName, (err) => {
    if (err) console.error("PDF Download Error:", err);
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error("Error deleting PDF file:", unlinkErr);
    });
  });
});

  } catch (error) {
    console.error("PDF Generation Error:", error.stack);
    res.status(500).send("Error generating PDF");
  }
};

const downloadSalesReportExcel = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      quickSelect,
      compareWith = "none",
      orderStatus = "all",
    } = req.query;

  
    let dateFilter = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const setDateRange = (start, end) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return {
        createdAt: { $gte: startDate, $lte: endDate },
      };
    };

    if (quickSelect === "custom" && startDate && endDate) {
      dateFilter = setDateRange(startDate, endDate);
    } else {
      switch (quickSelect) {
        case "today":
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          dateFilter = setDateRange(startOfDay, today);
          break;
        case "last7days":
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - 6);
          dateFilter = setDateRange(weekStart, today);
          break;
        case "last30days":
          const monthStart = new Date(today);
          monthStart.setDate(today.getDate() - 29);
          dateFilter = setDateRange(monthStart, today);
          break;
        case "year":
          const yearStart = new Date(today.getFullYear(), 0, 1);
          dateFilter = setDateRange(yearStart, today);
          break;
        default:
          const defaultStart = new Date(today);
          defaultStart.setDate(today.getDate() - 29);
          dateFilter = setDateRange(defaultStart, today);
      }
    }

 
    let query = { ...dateFilter };
    if (orderStatus !== "all") {
      query.status = orderStatus;
    }
    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("orderItems.productId")
      .sort({ createdAt: -1 })
      .lean();

    const deliveredOrders = await Order.find({
      ...dateFilter,
      status: "Delivered",
    })
      .populate("user", "name email")
      .populate("orderItems.productId")
      .sort({ createdAt: -1 })
      .lean();

    const totalSales = deliveredOrders
      .reduce((sum, order) => sum + (order.finalAmount || 0), 0)
      .toFixed(2);
    const deliveredOrdersCount = deliveredOrders.length;
    const totalDiscount = deliveredOrders
      .reduce(
        (sum, order) =>
          sum + (order.discount || 0) + (order.couponDiscount || 0),
        0
      )
      .toFixed(2);
    const avgOrderValue =
      deliveredOrdersCount > 0
        ? (totalSales / deliveredOrdersCount).toFixed(2)
        : "0.00";


    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");


    worksheet.addRow([]);
    worksheet.addRow(["Summary (Delivered Orders)"]);
    worksheet.addRow(["Metric", "Value"]);
    worksheet.addRow(["Total Sales", totalSales]);
    worksheet.addRow(["Delivered Orders", deliveredOrdersCount]);
    worksheet.addRow(["Total Discounts", totalDiscount]);
    worksheet.addRow(["Average Order Value", avgOrderValue]);

 
    worksheet.getRow(2).font = { bold: true, size: 14 };
    worksheet.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    worksheet.getRow(3).font = { bold: true };
    worksheet.getRow(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6E0B4" },
    };
    for (let i = 4; i <= 7; i++) {
      worksheet.getRow(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
    }
    worksheet.getRow(8).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };

    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 20 },
      { header: "Products", key: "products", width: 10 },
      { header: "Subtotal", key: "subtotal", width: 10 },
      { header: "Discount", key: "discount", width: 10 },
      { header: "Coupon", key: "coupon", width: 15 },
      { header: "Total", key: "total", width: 10 },
      { header: "Status", key: "status", width: 15 },
    ];


    orders.forEach((order) => {
      worksheet.addRow({
        orderId: `#ORD-${order.orderID || "N/A"}`,
        date: new Date(order.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        customer: order.user?.name || "Unknown",
        products: `${order.orderItems?.length || 0} item${
          order.orderItems?.length !== 1 ? "s" : ""
        }`,
        subtotal: (order.orderItems || [])
          .reduce((sum, p) => sum + (p.price * p.quantity || 0), 0)
          .toFixed(2),
        discount: (order.discount || 0).toFixed(2),
        coupon: order.couponCode
          ? `${order.couponCode} (-${(order.couponDiscount || 0).toFixed(2)})`
          : "N/A",
        total: (order.finalAmount || 0).toFixed(2),
        status: order.status,
      });
    });


    worksheet.getRow(9).font = { bold: true };
    worksheet.getRow(9).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    worksheet.getRow(9).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6E0B4" },
    };

    worksheet.columns.forEach((column) => {
      column.width = column.width || 15;
      column.alignment = { vertical: "middle", horizontal: "left" };
    });

 
    const fileName = `sales_report_${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, "../../public/downloads", fileName);

    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, fileName, (err) => {
      if (err) console.error("Excel Download Error:", err);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting Excel file:", unlinkErr);
      });
    });
  } catch (error) {
    console.error("Excel Generation Error:", error.stack);
    res.status(500).send("Error generating Excel");
  }
};

module.exports = {
  getSalesReport,
  downloadSalesReportPDF,
  downloadSalesReportExcel,
};
