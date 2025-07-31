// models/productModel.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    sku: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true
    },
    variety: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    stockLevel: {
        type: Number,
        required: true,
        default: 0
    },
    barcode: {
        type: String,
        required: true,
        unique: true
    },
    // ADDED: New fields for ingredients and nutritional values
    ingredients: {
        type: [String], // Storing as an array of strings
        default: [],
    },
    nutritionalValues: {
        type: Map, // Storing as a map for key-value pairs (e.g., "Protein": "30%")
        of: String,
        default: {},
    }
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;