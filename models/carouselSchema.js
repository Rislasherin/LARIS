
const mongoose = require('mongoose');

const carouselSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true }, // URL of the image
    title: { type: String, required: true },    // Title for the slide
    description: { type: String },              // Optional description
    link: { type: String },                     // Optional link for the "Shop Now" button
    isActive: { type: Boolean, default: true }, // To enable/disable slides
    order: { type: Number, default: 0 }         // Order of slides
});

module.exports = mongoose.model('Carousel', carouselSchema);