
const category = require('../../models/CategorySchema');


const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search
            ? { name: { $regex: new RegExp(req.query.search, 'i') } }
            : {};

        const categoryData = await category.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: req.query.search || ''
        });

    } catch (error) {
        console.error(error);
        res.redirect('/pageerror');
    }
};


const addCategory = async (req, res) => {
    const { name, description } = req.body;

    try {
        
        const existingCategory = await category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

       
        const newCategory = new category({
            name,
            description
        });

        await newCategory.save();
        return res.json({ message: "Category added successfully" });
    } catch (error) {
        console.error('Error adding category:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Add Category Offer
const addOffer = async (req, res) => {
    try {
        const { categoryId, offerPercentage } = req.body;

       
        if (!categoryId || !offerPercentage) {
            return res.status(400).json({ error: "Category ID and offer percentage are required" });
        }

        const offerValue = parseFloat(offerPercentage);
        if (isNaN(offerValue) || offerValue <= 0 || offerValue >= 100) {
            return res.status(400).json({ error: "Offer percentage must be between 1 and 99" });
        }

        // Find the category
        const categoryData = await category.findById(categoryId);
        if (!categoryData) {
            return res.status(404).json({ error: "Category not found" });
        }
        
        
        categoryData.categoryOffer = offerValue;
       
        
        await categoryData.save();
        
        return res.json({ 
            message: "Offer added successfully", 
            category: {
                id: categoryData._id,
                name: categoryData.name,
                offer: categoryData.categoryOffer
            }
        });
    } catch (error) {
        console.error('Error adding offer to category:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Remove Category Offer
const removeOffer = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the category
        const categoryData = await category.findById(id);
        if (!categoryData) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Remove offer
        categoryData.categoryOffer = 0;
       
        
        await categoryData.save();
        
        return res.json({ 
            message: "Offer removed successfully",
            category: {
                id: categoryData._id,
                name: categoryData.name
            }
        });
    } catch (error) {
        console.error('Error removing offer from category:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

// List Category Controller
const listCategory = async (req, res) => {
    try {
        const { id } = req.params;

        await category.findByIdAndUpdate(id, { isListed: true });
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error listing category:', error);
        res.redirect('/pageerror');
    }
};

// Unlist Category Controller
const unlistCategory = async (req, res) => {
    try {
        const { id } = req.params;

        await category.findByIdAndUpdate(id, { isListed: false });
        res.redirect('/admin/category');
    } catch (error) {
        console.error('Error unlisting category:', error);
        res.redirect('/pageerror');
    }
};

const getEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const categoryData = await category.findById(categoryId);

        if (!categoryData) {
            return res.status(404).render('pageerror', { message: 'Category not found' });
        }

        res.render('edit-category', { category: categoryData }); 
    } catch (error) {
        console.error("Error loading edit category page:", error.message);
        res.status(500).render('pageerror', { message: 'Server error occurred' });
    }
};





const editCategory = async (req, res) => {
    console.log("Received ID:", req.params.id); 
    console.log("Received Data:", req.body);    

    try {
        const id = req.params.id;
        const { name, description } = req.body;

        const updatedCategory = await category.findByIdAndUpdate(id, {
            name: name,
            description: description
        }, { new: true });

        if (updatedCategory) {
            console.log("Category Updated Successfully:", updatedCategory); 
            res.redirect('/admin/category');
        } else {
            console.log("Category Not Found"); 
            res.status(404).render('pageerror', { message: 'Category not found' });
        }
    } catch (error) {
        console.error('Error in editCategory:', error);
        res.status(500).render('pageerror', { message: 'Internal server error' });
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    addOffer,
    removeOffer,
    listCategory,
    unlistCategory,
    getEditCategory,
    editCategory,
};