// models/memoryModel.js
const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    petName: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    tribute: {
        type: String,
        required: true
    },
    // This will represent the "virtual candle"
    lights: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Memory = mongoose.model('Memory', memorySchema);
module.exports = Memory;