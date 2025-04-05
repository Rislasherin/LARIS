const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/authController');
const profileController = require('../controllers/user/profileController');
const { userAuth, userAuthJson } = require('../middlewares/auth');
const productController = require('../controllers/user/productController')
const addressController = require('../controllers/user/addressController')
const cartController = require('../controllers/user/cartController')
const Cart = require('../models/CartSchema')
const  checkoutController = require('../controllers/user/checkoutController')
const OrderController = require('../controllers/user/orderController')


// Middleware to add cartCount
const addCartCount = async (req, res, next) => {
    try {
      if (req.session.user) {
        const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
        const cart = await Cart.findOne({ user: userId });
        res.locals.cartCount = cart ? cart.items.length : 0;
      } else {
        res.locals.cartCount = 0;
      }
      next();
    } catch (error) {
      console.error('Error in addCartCount middleware:', error);
      res.locals.cartCount = 0;
      next();
    }
  };

  router.use(addCartCount);

router.get('/pageNotFound', userController.pageNotFound);


router.get('/signup', userController.loadSignUpPage);

router.post('/signup', userController.signUp);
router.get('/verifyOtp',userController.loadverifyPage)

router.post('/verifyOtp', userController.verifyOtp);


router.post('/resendOtp', userController.resendOtp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    res.redirect('/');
});

router.get('/login', userController.loadLoginPage);
router.post('/login', userController.login);

router.get('/', userController.loadHomePage);
router.get('/shop',userController.loadShopPage) 
router.get('/filter',userController.filterProduct)




router.get('/logout', userController.logout);

router.get('/forgot-password', profileController.getForgotPassword);
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.get('/forgot-verify-Otp',profileController.loadverifyPage);
router.post('/verify-password-otp',profileController.verifyForgotPassOtp)
router.get('/reset-password',profileController.getResetPassPage)
router.post('/resendForgotOtp',profileController.resendOtp);
router.post('/reset-password',profileController.postNewPassword)


router.get('/product/:id', productController.productDetails);
router.get('/productdetails/:id',productController.productDetails)

//profile
router.get('/userProfile',userAuth,profileController.userProfile)
router.post('/change-password',userAuth,profileController.changePassword);
router.post('/update-profile',userAuth,profileController.updateProfile);

//email change
// In your routes file
router.post('/send-email-otp',userAuth,profileController.sendEmailOtp);
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp);
router.post('/resend-email-otp',userAuth,profileController.resendEmailOtp);

//address management 
router.get('/add',userAuthJson, addressController.addressAdd);

// Add new address
router.post('/address/add',userAuthJson, addressController.addNewAddress);

// Get all addresses
router.get('/addresses', userAuthJson, addressController.getAllAddresses);

// New routes for edit and delete
router.get('/user/addresses/:id', addressController.getAddressById);
router.put('/update-address/:id', userAuthJson, addressController.updateAddress);
router.delete('/delete-address/:id', userAuthJson, addressController.deleteAddress);


// Cart routes
router.get('/cart', userAuth, cartController.getCartPage);
router.post("/cart/add",userAuth, cartController.addToCart);
router.post("/cart/update",userAuth, cartController.updateCartQuantity);
router.post("/cart/remove", userAuth, cartController.removeFromCart);
router.get('/cart/contents', userAuth, cartController.getCartContents);


//checkout
router.get('/checkout/address', checkoutController.getCheckoutAddressPage);
router.post('/checkout/payment', checkoutController.getPaymentPage);
router.post('/add-address', checkoutController.addAddress);
router.post('/place-order', checkoutController.placeOrder);
router.get('/order-success', checkoutController.getOrderSuccessPage);

router.get('/get-address/:addressId', checkoutController.getAddress);
router.put('/edit-address/:addressId', checkoutController.editAddress);
router.delete('/remove-address/:addressId', checkoutController.removeAddress);

router.get('/orders', OrderController.getOrdersPage);
router.get('/order-details/:orderId', OrderController.getOrderDetailsPage);
router.post('/order/cancel-product/:orderId/:productId', OrderController.cancelProduct);
router.post('/return', OrderController.requestReturn);



module.exports = router;