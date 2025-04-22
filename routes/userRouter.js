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
const wishlistController = require('../controllers/user/wishlistController')
const walletController = require('../controllers/user/walletController')
const referralController = require('../controllers/user/refferralController')

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


//search

router.get('/search/history', userController.getSearchHistory);
router.post('/search/save', userController.saveSearch);
router.delete('/search/delete', userController.deleteSearch);
router.delete('/search/clear', userController.clearSearchHistory);



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
router.get('/product/:productId/stock',productController.getProductStock);


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
router.post('/cart/get-quantity',userAuth,cartController.getCartQuantity);
router.get('/cart/summary', cartController.getCartSummary);

//checkout
router.get('/checkout/address', checkoutController.getCheckoutAddressPage);
router.post('/checkout/payment', checkoutController.getPaymentPage);
router.post('/add-address', checkoutController.addAddress);
router.post('/place-order', checkoutController.placeOrder);
router.post('/verify-payment', checkoutController.verifyPayment);
router.get('/order-success', checkoutController.getOrderSuccessPage);
router.get('/order-error', checkoutController.getOrderErrorPage);
router.post('/retry-payment', checkoutController.retryPayment);
router.post('/wallet/process-payment', checkoutController.processWalletPayment);
//coupon
router.get('/coupons/available',checkoutController.getAvailableCoupons); // New route
router.post('/coupons/apply', checkoutController.applyCoupon);
router.post('/coupons/remove', checkoutController.removeCoupon);


router.get('/get-address/:addressId', checkoutController.getAddress);
router.put('/edit-address/:addressId', checkoutController.editAddress);
router.delete('/remove-address/:addressId', checkoutController.removeAddress);

router.get('/orders', OrderController.getOrdersPage);
router.get('/order-details/:orderId', OrderController.getOrderDetailsPage);
router.post('/user/order/cancel-order/:orderId', userAuth, OrderController.cancelOrder);
router.post('/user/order/cancel-product/:orderId/:productId', userAuth, OrderController.cancelProduct);
router.post('/user/return', OrderController.requestReturn);



//wishlist
router.get('/wishlist',userAuth,wishlistController.loadWishlist)
router.post('/wishlist/toggle', wishlistController.toggleWishlist);
router.post('/wishlist/clear',wishlistController.clearWishlist)


//Wallet
router.get('/wallet', walletController.renderWalletPage);
router.get('/wallet/transactions',  walletController.getMoreTransactions);
router.post('/wallet/add-cash', walletController.addCashToWallet);
router.post('/wallet/verify-payment', userAuth, walletController.verifyPayment);
router.post('/orders/:orderId/process-return', walletController.processReturnAndCreditWallet);


//referral
router.get('/referral', referralController.renderReferral);



module.exports = router;