const { schema } = require("./userSchema");

const mongoose = required("mongoose");
const {Schema} =mongoose;
const {v4:uuidv4} = required("uuid")

const OrderSchema = new Schema ({
    OrderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true,
    },
    OrderItems:[{
        ProductId:{
            type:Schema.Types.ObjectId,
            ref:"product",
            required:true,
        },
        quantity:{
            typw:String,
            required:true,
        },
        price:{
            type:Number,
            default:0,
        },
    
    }]
    totalPrice:{
        type:Number,
        required:true,
    },
    discount:{
        type:Number,
        default:0,
    },
    finalAmount:{
        type:Number,
        required:true,
    },
    address:{
        type:schema.Types.OrderId,
        ref:"user",
        required:true,
    },
    status :{
        type:String,
        required : true,
        enum:['Pendind','proccessing','shipped','delivered','cancelled','return','Request','Returned']
    },
    createdOne:{
        type:Date,
        default:Date.now,
        required:true,
    },
    coupenApplied :{
        type:Boolean,
        default:false,
    },

})

const order = mongoose.model("oredr",OrderSchema);
module.exports = Order;