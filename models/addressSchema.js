const mongoose = require ("mongoose")
const {Schema} = mongoose;


const addressSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"user",
        required:true
    },
    address : [{
        addressType:{
            type:String,
            require:true
        },
        name:{
        type: String,
        required:true,
        },
        city :{
            type:String,
            required:true,
        },
        landMark:{
            type:String,
            required:true,
        },
        state:{
            type:String,
            required:true,
        },
        pincode:{
            type:String,
            required:true,
        },
        phone:{
            type:string,
            required:true,
        },
        altPhone:{
            type:string,
            required:true,
        }
    }]
    
})
const Address = mongoose.model('Address',addressSchema);

module.exports = Address;