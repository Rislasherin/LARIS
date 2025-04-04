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
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.redirect("/pageerror");
    }
};


const customerBlocked = async (req, res) => {
    try {
      const id = req.query.id
      await User.updateOne({ _id: id }, { $set: { isBlocked: true } })
  
      userBlockedEmitter.emit("userBlocked", id)
  
      res.redirect("/admin/users")
    } catch (error) {
      res.redirect("/pageerror")
    }
  }

const customerUnblocked = async (req,res) => {
    try {

        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/users")

        
    } catch (error) {
        res.redirect('/pageerror')
    }
}



module.exports = {
    customerInfo,
    customerBlocked,
    customerUnblocked,
    userBlockedEmitter,
    

}