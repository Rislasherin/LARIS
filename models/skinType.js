const mongoose = require('mongoose');
const {Schema} = mongoose;


const skinTypeSchema = new schema({
    name:{
        type:String,
        enum:['ioly','Dry','combination','sensitive'],
        required:true,
        unique:true,
    },
    description:{
        type:String
    },
});


const skintype = mongoose.model('skinType',skinTypeSchema);

module.exports = skintype;