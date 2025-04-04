const { Schema } = require("mongoose");

const mongoose = required('mongoose');
const schema = mongoose;


const CartSchema = new Schema({
    userId : {
        type: Schema.Types.ObjectId,
        ref:"user",
        required:true,
    },
    items:[{
        ProductId :{
            type:Schema.Types.ObjectId,
            ref:"product",
            required:true,
        },
        quantity:{
            type:Number,
            default:1
        },
        price:{
            type:Number,
            required:true,
        },
        totalPrice:{
            type:Number,
            required:true,
        },
        status:{
            type:String,
            default:"Placed",
        },
        cancellationReason :{
            type:String,
            default:'None',
        },
    }]
})


const Cart = mongoose.model('Cart',CartSchema);
module.exports = Cart;