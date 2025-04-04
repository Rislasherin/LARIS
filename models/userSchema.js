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
    password:{
        type:String,
        required:false,
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
}, { timestamps : true})

const User = mongoose.model('user',userSchema);
module.exports = User;
