const mongoose = require('mongoose')
const {Schema} = mongoose;


const userSchema = new Schema({
    name:{
        type:String,
        required : true,
        index: true
    },
    email:{
        type : String,
        required :true,
        unique: true,
        index: true
    },
    phone:{
        type:String,
        required :false,
        unique:true, 
        sparse:true,
        default:null,

    },
    googleId :{
        type:String,
        unique:false,

    },
    password: { 
        type: String, 
        required: function() {
            return !this.googleId; // Password required only if googleId is not set
        }
    },
    isBlocked:{
        type:Boolean,
        default:false,
        index: true
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    referelCode:{
        type:String,
        // required : true
        
    },
    addresses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    }],
    cart: [{
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1
        }
      }]
}, { timestamps : true})

const User = mongoose.model('User', userSchema);
module.exports = User;
