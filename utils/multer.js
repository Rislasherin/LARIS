const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', 'public', 'uploads', 'product-images'); 
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `resized-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage }).fields([
  { name: 'images1', maxCount: 1 },
  { name: 'images2', maxCount: 1 },
  { name: 'images3', maxCount: 1 },
  { name: 'images4', maxCount: 1 },
]);

module.exports = upload;