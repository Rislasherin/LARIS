const EventEmitter = require("events")
const userBlockedEmitter = new EventEmitter()

const User = require("../../models/userSchema");


const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || '';
        let page = req.query.page || 1;
        const limit = 10;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*" } },
                { email: { $regex: ".*" + search + ".*" } },
            ],
        })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt : -1})

        console.log(userData)

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*" } },
                { email: { $regex: ".*" + search + ".*" } },
            ],
        });

        res.render("customers", {
            data: userData, 
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            search: search,
            successMessage: req.flash('success'),
            errorMessage: req.flash('error')
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.redirect("/pageerror");
    }
};


const customerBlocked = async (req, res) => {
    try {
      const id = req.query.id
      const user = await User.findById(id);
        
      if (!user) {
          req.flash('error', 'User not found');
          return res.redirect("/admin/users");
      }

      await User.updateOne({ _id: id }, { $set: { isBlocked: true } })
  
      userBlockedEmitter.emit("userBlocked", id)
  
      req.flash('success', `User ${user.name} has been blocked successfully`);
        res.redirect("/admin/users");
    } catch (error) {
        req.flash('error', 'An error occurred while blocking the user');
        res.redirect("/admin/users");
    }
};

const customerUnblocked = async (req,res) => {
    try {

        let id = req.query.id;
        const user = await User.findById(id);
        
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect("/admin/users");
        }

        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        req.flash('success', `User ${user.name} has been unblocked successfully`);
        res.redirect("/admin/users");
    } catch (error) {
        req.flash('error', 'An error occurred while unblocking the user');
        res.redirect("/admin/users");
    }
};


module.exports = {
    customerInfo,
    customerBlocked,
    customerUnblocked,
    userBlockedEmitter,
    

}