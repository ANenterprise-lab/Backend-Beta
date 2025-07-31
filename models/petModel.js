const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    name: {
        type: String,
        required: true
    },
    avatarUrl: {
        type: String,
        default: ''
    },
    birthday: {
        type: Date
    },
    favoriteTreats: {
        type: String
    },
    // ADDED: Fields for the avatar builder
    avatarBaseColor: {
        type: String,
        default: '#8d5524' // Default brown color
    },
    avatarAccessory: {
        type: String,
        default: 'None'
    }
}, {
    timestamps: true
});

const Pet = mongoose.model('Pet', petSchema);
module.exports = Pet;