// models/petMoodModel.js
const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema({
    pet: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Pet'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    mood: {
        type: String,
        required: true,
        enum: ['Happy', 'Playful', 'Sleepy', 'Anxious', 'Hungry'] // Predefined moods
    },
}, {
    timestamps: true // This will automatically add createdAt and updatedAt
});

const PetMood = mongoose.model('PetMood', moodSchema);
module.exports = PetMood;