const mongoose = require('mongoose');
const {Schema} = mongoose;


const WishlistSchema = new Schema({
    UserId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true,
    },
    Products:[{
        productId:{
            type:String,
            ref:'Product',
            required :true,
        },
        addedOn:{
            type:Date,
            default : Date.now,
        }
    }]
})

const Wishlist = mongoose.model('Wishlist',WishlistSchema);

module.exports = Wishlist;