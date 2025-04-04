const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/authController');
const profileController = require('../controllers/user/profileController');
const { userAuth } = require('../middlewares/auth');
const productController = require('../controllers/user/productController')




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




router.get('/logout', userController.logout);

router.get('/forgot-password', profileController.getForgotPassword);
router.post('/forgot-email-valid',profileController.forgotEmailValid);
router.get('/forgot-verfy-Otp',profileController.loadverifyPage);
router.post('/verify-password-otp',profileController.verifyForgotPassOtp)
router.get('/reset-password',profileController.getResetPassPage)
router.post('/resendForgotOtp',profileController.resendOtp);
router.post('/reset-password',profileController.postNewPassword)


router.get('/productdetails',productController.productDetails)


module.exports = router;