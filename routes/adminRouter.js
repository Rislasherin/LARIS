const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const multer = require('multer');
const { adminAuth } = require('../middlewares/auth');
const path = require('path');
const categoryController = require('../controllers/admin/categoryController');
const customerController = require('../controllers/admin/customerController');
const storage = require('../utils/multer')
const upload = multer({ dest: 'public/uploads/Product-images/' });
const productController = require('../controllers/admin/productController')





router.get('/pageerror', adminController.pageError);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
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



router.get('/users', adminAuth, customerController.customerInfo);
router.get('/block-user', adminAuth, customerController.customerBlocked);
router.get('/unblock-user', adminAuth, customerController.customerUnblocked);

//product managemant

router.get('/addProducts',adminAuth,productController.getproductAddPage);
router.post('/addProducts',adminAuth,upload.array('images',4),productController.addProducts)
router.get('/products',adminAuth,productController.getAllproducts)
router.post('/addProductOffer',adminAuth,productController.addProductOffer)
router.post('/removeProductOffer', adminAuth, productController.removeproductOffer)
router.post('/toggleProductStatus', productController.toggleProductStatus);
//edit product
router.get('/editProduct/:id',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id', adminAuth, upload.array('images', 4), productController.EditProduct);
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)







module.exports = router;