const product = require('../../models/productSchema');
const Category = require('../../models/CategorySchema');
const Product = require('../../models/productSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { findPackageJSON } = require('module');
const { find } = require('../../models/userSchema');

const getproductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render('product-add', { cat: category });
    } catch (error) {
        console.error('Error loading product add page:', error);
        res.redirect('/pageerror');
    }
};

const addProducts = async (req, res) => {
    try {
      console.log('Request body:', req.body);
      console.log('Uploaded Files:', req.files);
  
      if (!req.files || req.files.length === 0) {
        console.error('No files uploaded');
        return res.status(400).json({ error: 'At least one product image is required' });
      }
  
      const products = req.body;
  
      const productExists = await Product.findOne({ productName: products.productName });
      if (productExists) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        return res.status(400).json({ error: 'Product already exists, please try with another name' });
      }
  
      const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
  
      const images = [];
      for (let i = 0; i < req.files.length; i++) {
        try {
          const originalImagePath = req.files[i].path;
          const filename = req.files[i].filename;
          const resizedFilename = `resized-${Date.now()}-${filename}.jpeg`;
  
          const savePath = path.join(uploadDir, resizedFilename);
          console.log(`Saving image ${i + 1} to: ${savePath}`);
          await sharp(originalImagePath)
            .resize(440, 440)
            .toFormat('jpeg')
            .jpeg({ quality: 90 })
            .toFile(savePath);
  
          images.push(resizedFilename);
        } catch (err) {
          console.error(`Error processing image ${i + 1}:`, err);
        }
      }
  
      const categoryId = await Category.findOne({ name: products.category });
      if (!categoryId) {
        return res.status(400).json({ error: 'Invalid category name' });
      }
  
      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        brand: products.brand || '',
        category: categoryId._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice || 0,
        createdOn: new Date(),
        quantity: products.quantity,
        skintype: products.skinType || '',
        skinConcern: products.skinConcern || '',
        productImage: images,
        status: 'Available',
      });
  
      await newProduct.save();
      console.log('Product added successfully:', newProduct);
      return res.redirect('/admin/addProducts');
    } catch (error) {
      console.error('Error saving product:', error);
      return res.redirect('/admin/pageerror');
    }
  };
const getAllproducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1; 
        const limit = 10;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
                { brand: { $regex: new RegExp('.*' + search + '.*', 'i') } }
            ],
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('category')
        .exec();

        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } },
        
            ]
        }).countDocuments();

        const category = await Category.find({ isListed: true });


        if (category) {
            res.render('products', {
                data: productData,
                currentPage: page,
                totalPage: Math.ceil(count / limit),
                cat: category,
        
            });
        } else {
            res.render('pageNotFound');
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        res.redirect('/pageerror');
    }
};

const addProductOffer = async(req, res) => {
    try {
        const {productId, percentage} = req.body;
 
        if (!productId || !percentage) {
            return res.json({ status: false, message: 'Product ID and percentage are required' });
        }
        
        const findproduct = await Product.findOne({_id: productId});
        if (!findproduct) {
            return res.json({ status: false, message: 'Product not found' });
        }

        const findCategory = await Category.findOne({_id: findproduct.category});
        if (findCategory && findCategory.categoryOffer > percentage) {
            return res.json({ status: false, message: 'This product\'s category already has a higher offer' });
        }
        findproduct.salePrice = Math.floor(findproduct.regularPrice - (findproduct.regularPrice * (percentage/100)));
        findproduct.productOffer = parseInt(percentage);
        await findproduct.save();

        if (findCategory && findCategory.categoryOffer > 0) {
            findCategory.categoryOffer = 0;
            await findCategory.save();
        }
        
        return res.json({status: true, message: 'Offer added successfully'});
    } catch (error) {
        console.error('Error adding product offer:', error);
        return res.json({status: false, message: 'Internal server error'});
    }
}


const removeproductOffer = async(req, res) => {
    try {
        const {productId} = req.body;
        
        if (!productId) {
            return res.json({ status: false, message: 'Product ID is required' });
        }
        
        const findproduct = await Product.findOne({_id: productId});
        if (!findproduct) {
            return res.json({ status: false, message: 'Product not found' });
        }
        
        findproduct.salePrice = findproduct.regularPrice;
        findproduct.productOffer = 0;
        await findproduct.save();
        
        return res.json({status: true, message: 'Offer removed successfully'});
    } catch (error) {
        console.error('Error removing product offer:', error);
        return res.json({status: false, message: 'Internal server error'});
    }
}
const toggleProductStatus = async (req, res) => {
    try {
        const { productId, status } = req.body;
        
        if (!productId || !status) {
            return res.json({ status: false, message: 'Product ID and status are required' });
        }
        
        const findProduct = await Product.findOne({ _id: productId });
        if (!findProduct) {
            return res.json({ status: false, message: 'Product not found' });
        }
        
        findProduct.status = status;
        await findProduct.save();
        
        console.log(`Product ${productId} status changed to ${status}`);
        return res.json({ status: true, message: 'Product status updated successfully' });
    } catch (error) {
        console.error('Error updating product status:', error);
        return res.json({ status: false, message: 'Internal server error' });
    }
};

const getEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        console.log('Product ID:', productId);  

        const product = await Product.findOne({ _id: productId });
        const category = await Category.find({});

        console.log('Product Data:', product);  

        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('edit-product', {
            product: product,
            cat: category
        });
    } catch (error) {
        console.error('Error loading edit product page:', error);
        res.status(500).send('Server error');
    }
};




const EditProduct = async (req, res) => {
    try {
      const id = req.params.id;
      const product = await Product.findOne({ _id: id });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
  
      const data = req.body;
  
      const existingProduct = await Product.findOne({
        _id: { $ne: id },
        productName: data.productName,
      });
      if (existingProduct) {
        return res.status(400).json({ error: 'Product with this name already exists, please try again' });
      }
  
   
      const updatedImages = [...(product.productImage || [])];
      const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
  
      
      for (let i = 1; i <= 4; i++) {
        const fieldName = `images${i}`;
        if (req.files && req.files[fieldName] && req.files[fieldName].length > 0) {
          const file = req.files[fieldName][0];
          const resizedFilename = `resized-${Date.now()}${path.extname(file.originalname)}`;
  
          const savePath = path.join(uploadDir, resizedFilename);
          console.log(`Saving cropped image to: ${savePath}`);
          await sharp(file.path)
            .resize(440, 440)
            .toFormat('jpeg')
            .jpeg({ quality: 90 })
            .toFile(savePath);
  
     
          if (updatedImages[i - 1]) {
            const oldImagePath = path.join(uploadDir, updatedImages[i - 1]);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
  
          updatedImages[i - 1] = resizedFilename;
  
         
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
  
      const updateFields = {
        productName: data.productName,
        description: data.description,
        category: product.category,
        regularPrice: data.regularPrice,
        salePrice: data.salePrice || 0,
        quantity: data.quantity || 0, 
        skinType: data.skinType || '',
        skinConcern: data.skinConcern || '',
        productImage: updatedImages.filter(Boolean),
      };
  
      await Product.findByIdAndUpdate(id, updateFields, { new: true });
      res.redirect('/admin/products');
    } catch (error) {
      console.error('Error updating product:', error);
      res.redirect('/pageerror');
    }
  };const deleteSingleImage = async (req, res) => {
    try {
      const { imageNameToServer, productIdToServer } = req.body;
  
      console.log('Received Data:', imageNameToServer, productIdToServer);
  
      const product = await Product.findByIdAndUpdate(
        productIdToServer,
        { $pull: { productImage: imageNameToServer } },
        { new: true }
      );
  
      if (!product) {
        console.error('Product not found');
        return res.status(404).json({ status: false, message: 'Product not found' });
      }
  
      const imagePath = path.join(__dirname, '../../public/uploads/product-images', imageNameToServer);
      console.log('Image Path:', imagePath);
  
      if (fs.existsSync(imagePath)) {
        await fs.promises.unlink(imagePath);
        console.log(`Image ${imageNameToServer} deleted successfully`);
      } else {
        console.log('Image not found in file system, but removed from database');
      }
  
      return res.json({ status: true, message: 'Image removed successfully' });
    } catch (error) {
      console.error('Error deleting image:', error);
      return res.status(500).json({ status: false, message: 'Internal server error' });
    }
  };

module.exports = {
    getproductAddPage,
    addProducts,
    getAllproducts,
    addProductOffer,
    removeproductOffer,
    toggleProductStatus,
    getEditProduct,
    EditProduct,
    deleteSingleImage

};