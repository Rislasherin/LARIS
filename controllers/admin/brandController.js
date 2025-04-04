// const Brand = require('../../models/brandSchema');
// const product = require('../../models/productSchema');


// const getBrandPage = async(req,res)=>{
//     try {
//        const page =  parseInt(req.query.page) ||1
//        const limit = 4
//        const skip = (page -1 )*limit;
//        const branddata = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
//        const totalBrands = await Brand.countDocuments();
//        const totalPages = Math.ciel(totalBrands/limit);
//        const reverseBrand = branddata.reverse();
//        res.render("brands",{
//         data : reverseBrand,
//         currentPage:page,
//         totalPages : totalPages,
//         totalBrands:totalBrands,
//        })
//     } catch (error) {
//         res.redirect('/pageerror')
//     }
// }