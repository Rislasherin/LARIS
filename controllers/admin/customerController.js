const EventEmitter = require("events")
const userBlockedEmitter = new EventEmitter()

const User = require("../../models/userSchema");


const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || '';
        let page = req.query.page || 1;
        const limit = 10;

        // Check if the search might be for a Google user
        const query = {
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },  // Added case insensitivity
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }, // Added case insensitivity
                // Add any Google-specific fields that might exist
                { "google.email": { $regex: ".*" + search + ".*", $options: 'i' } },
                { "google.name": { $regex: ".*" + search + ".*", $options: 'i' } }
            ],
        };

        // Debug what's in your User collection
        console.log("All users before pagination:", await User.find({}).lean());

        const userData = await User.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });

        console.log("Found users with query:", userData);

        const count = await User.countDocuments(query);

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