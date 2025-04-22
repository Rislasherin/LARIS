const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const multer = require('multer');
const { adminAuth } = require('../middlewares/auth');
const path = require('path');
const categoryController = require('../controllers/admin/categoryController');
const customerController = require('../controllers/admin/customerController');
const storage = require('../utils/multer')

const upload = require ('../utils/multer')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')
const couponController = require('../controllers/admin/coupenController')
const salesReportController = require('../controllers/admin/salesReportController')
const walletController = require('../controllers/admin/adminWalletController')
const dashboardController = require("../controllers/admin/dashboardController"); // New controller


router.get('/pageerror', adminController.pageError);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);


//category management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/category/add',adminAuth,categoryController.addCategory);
router.post('/category/add-offer',adminAuth,categoryController.addOffer);
router.post('/category/:id/remove-offer',adminAuth,categoryController.removeOffer);
router.get('/category/:id/list',adminAuth,categoryController.listCategory);
router.get('/category/:id/unlist',adminAuth,categoryController.unlistCategory);
router.get('/edit-category/:id', adminAuth, categoryController.getEditCategory);
router.post('/edit-category/:id', adminAuth, categoryController.editCategory);


// user management
router.get('/users', adminAuth, customerController.customerInfo);
router.get('/block-user', adminAuth, customerController.customerBlocked);
router.get('/unblock-user', adminAuth, customerController.customerUnblocked);

//product managemant

router.get('/addProducts',adminAuth,productController.getproductAddPage);
router.post('/addProducts',adminAuth,upload.array('images',6),productController.addProducts)
router.get('/products',adminAuth,productController.getAllproducts)
router.post('/addProductOffer',adminAuth,productController.addProductOffer)
router.post('/removeProductOffer', adminAuth, productController.removeproductOffer)
router.post('/toggleProductStatus', productController.toggleProductStatus);
router.get('/products/data', productController.getProductData);

//edit product
router.get('/editProduct/:id',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id', upload.array('imageFile', 6), productController.EditProduct);
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)

// Order routes
router.get("/orders", adminAuth, orderController.renderOrderManage);
router.get("/order/details/:orderId", adminAuth, orderController.renderOrderDetails); 
router.get("/order/:orderId", adminAuth, orderController.getOrderById); 
router.post('/order/update-status/:orderId', adminAuth, orderController.updateOrderStatus);
router.get('/return-requests', adminAuth, orderController.renderReturnRequestsList);
router.put('/:orderId/update-product-status', adminAuth, orderController.updateProductStatus);
router.post('/order/update-all-items/:orderId', orderController.updateAllOrderItems);
router.post('/order/accept-return',orderController.acceptReturnRequest);
router.post('/order/reject-return',orderController.rejectReturnRequest);
router.post('/order/cancel-item', orderController.cancelOrderItem);



//coupon routes
router.get("/coupons", adminAuth, couponController.getCouponManagePage);
router.post("/coupon/add", adminAuth, couponController.addCoupon);
router.put('/coupons/update/:id', adminAuth, couponController.updateCoupon);
router.get('/coupon/:id', adminAuth, couponController.getCouponById);
router.delete('/coupon/delete/:id', adminAuth, couponController.deleteCoupon);


// Sales Report Route
router.get("/reports/sales", adminAuth,salesReportController.getSalesReport);
router.get("/reports/sales/download/pdf", salesReportController.downloadSalesReportPDF);
router.get("/reports/sales/download/excel", salesReportController.downloadSalesReportExcel);



//wallet

router.get('/wallet', adminAuth,  walletController.getWalletManagement);
router.get('/wallet-order/:orderId', adminAuth, walletController.getWalletOrderDetails);


router.get('/dashboard', dashboardController.getDashboard);
router.get('/api/sales-data', dashboardController.getSalesDataAPI);
router.get('/api/category-data', dashboardController.getCategoryDataAPI);
router.get('/api/inventory-status', dashboardController.getInventoryStatus);
router.get('/api/stats-overview', dashboardController.getStatsOverviewAPI);
router.get('/api/customer-insights', dashboardController.getCustomerInsightsAPI);



module.exports = router;