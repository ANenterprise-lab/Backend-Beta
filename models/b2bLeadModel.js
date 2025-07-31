const mongoose = require('mongoose');

const b2bLeadSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    message: { type: String }
}, { timestamps: true });

const B2BLead = mongoose.model('B2BLead', b2bLeadSchema);
module.exports = B2BLead;