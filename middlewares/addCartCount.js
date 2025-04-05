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

  module.exports = {
    addCartCount,
  }