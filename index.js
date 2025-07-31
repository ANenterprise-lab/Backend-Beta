// anenterprise-lab/pet-food-backend/pet-food-backend-7ebeeef26f5774ee110b89a48e923d1171c0c00f/index.js

// ===================================
// IMPORTS & INITIAL SETUP
// ===================================
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

// --- Models ---
const Product = require('./models/productModel.js');
const Order = require('./models/orderModel.js');
const User = require('./models/userModel.js');
const B2BLead = require('./models/b2bLeadModel.js');
const Pet = require('./models/petModel.js');
const PetMood = require('./models/petMoodModel.js');
const Memory = require('./models/memoryModel.js');

// --- Utils & Middleware ---
const generateToken = require('./utils/generateToken.js');
const { protect, admin } = require('./middleware/authMiddleware.js');

// --- App Configuration ---
dotenv.config();
const app = express();
const port = 5000;

// ===================================
// MIDDLEWARE
// ===================================
app.use(helmet());
app.use(cors());
app.use(express.json());

// ===================================
// STATIC ASSETS & FILE UPLOAD
// ===================================
const UPLOADS_FOLDER = path.join(__dirname, '/uploads');
if (!fs.existsSync(UPLOADS_FOLDER)) {
    fs.mkdirSync(UPLOADS_FOLDER);
}
app.use('/uploads', express.static(UPLOADS_FOLDER, { maxAge: '1y', immutable: true }));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_FOLDER),
    filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`),
});

function checkFileType(file, cb) {
    if (!file.originalname) { return cb(new Error('File has no name.')); }
    const filetypes = /jpe?g|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) { return cb(null, true); }
    cb(new Error('Images Only!'));
}

const upload = multer({ storage, fileFilter: checkFileType });

// ===================================
// API ROUTES
// ===================================

// --- Upload Route ---
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (req.file) {
        res.send({ message: 'Image Uploaded', imageUrl: `/uploads/${req.file.filename}` });
    } else {
        res.status(400).send({ message: 'No image file provided or file type was invalid.' });
    }
});

// --- Product Routes ---
app.get('/api/products', async (req, res) => {
    try {
        const keyword = req.query.keyword ? { name: { $regex: req.query.keyword, $options: 'i' } } : {};
        const category = req.query.category ? { category: req.query.category } : {};
        const products = await Product.find({ ...keyword, ...category });
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.post('/api/products/add-stock', async (req, res) => {
    try {
        const { barcode } = req.body;
        const updatedProduct = await Product.findOneAndUpdate({ barcode }, { $inc: { stockLevel: 1 } }, { new: true });
        if (!updatedProduct) return res.status(404).json({ message: 'Product not found.' });
        res.status(200).json({ message: 'Stock added', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.post('/api/products', protect, admin, async (req, res) => {
    try {
        const product = new Product({ ...req.body, user: req.user._id });
        res.status(201).json(await product.save());
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) res.json(product);
        else res.status(404).json({ message: 'Product not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.put('/api/products/:id', protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            Object.assign(product, req.body);
            res.json(await product.save());
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.delete('/api/products/:id', protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            await product.deleteOne();
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- Order Routes ---
app.post('/api/orders', protect, async (req, res) => {
    try {
        const { cartItems, totalPrice } = req.body;
        for (const item of cartItems) {
            const product = await Product.findById(item.product._id);
            if (product.stockLevel < 1) {
                return res.status(400).json({ message: `${product.name} is out of stock.` });
            }
        }
        await Promise.all(cartItems.map(item => Product.updateOne({ _id: item.product._id }, { $inc: { stockLevel: -1 } })));
        const order = new Order({
            user: req.user._id,
            orderItems: cartItems.map(item => ({
                name: item.product.name,
                price: item.product.price,
                productId: item.product._id,
                customNote: item.customNote
            })),
            totalPrice,
        });
        const createdOrder = await order.save();
        
        try {
            const user = await User.findById(req.user._id);
            if (user) {
                user.loyaltyPoints = (user.loyaltyPoints || 0) + 10;
                const userOrders = await Order.find({ user: req.user._id });
                if (userOrders.length === 1 && !user.badges.includes('Kindness Keeper')) {
                    user.badges.push('Kindness Keeper');
                }
                await user.save();
            }
        } catch (loyaltyError) {
            console.error("Could not update loyalty points:", loyaltyError);
        }
        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.get('/api/orders/myorders', protect, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.get('/api/orders', protect, admin, async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'name email') // Also populate the user's name
            .sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        console.error("ERROR FETCHING ORDERS:", error);
        res.status(500).json({ message: error.message });
    }
});
app.post('/api/orders/generate-picklist', protect, admin, async (req, res) => {
    try {
        await Order.updateMany({ _id: { $in: req.body.orderIds } }, { $set: { status: 'processing' } });
        res.status(200).json({ message: 'Orders moved to processing.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.post('/api/orders/scan-item', protect, admin, async (req, res) => {
    try {
        const { orderId, barcode } = req.body;
        const product = await Product.findOne({ barcode });
        if (!product) return res.status(404).json({ message: 'Product not found for this barcode.' });
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found.' });
        const itemToScan = order.orderItems.find(item => item.productId?.toString() === product._id.toString() && !item.scanned);
        if (!itemToScan) return res.status(400).json({ message: 'Product not in this order or already scanned.' });
        itemToScan.scanned = true;
        if (order.orderItems.every(item => item.scanned)) {
            order.status = 'packed';
            order.orderItems.forEach(item => item.validationId = uuidv4());
        }
        res.status(200).json(await order.save());
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.get('/api/orders/:id', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email').populate('orderItems.productId', 'name barcode');
        if (order && (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin)) {
            res.json(order);
        } else if (!order) {
            res.status(404).json({ message: 'Order not found' });
        } else {
            res.status(401).json({ message: 'Not authorized' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// --- User Routes ---
app.post('/api/users/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if (await User.findOne({ email })) return res.status(400).json({ message: 'User already exists' });
        const user = await User.create({ name, email, password });
        if (user) {
            res.status(201).json({ _id: user._id, name: user.name, email: user.email });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            res.json({ _id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin, token: generateToken(user._id) });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.get('/api/users', protect, admin, async (req, res) => {
    try {
        res.json(await User.find({}).select('-password'));
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.get('/api/users/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (user) res.json(user);
        else res.status(404).json({ message: 'User not found' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// --- Pet & Mood Routes ---
app.post('/api/pets', protect, async (req, res) => {
    try {
        const pet = new Pet({ ...req.body, user: req.user._id });
        res.status(201).json(await pet.save());
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.get('/api/pets/mypets', protect, async (req, res) => {
    try {
        res.json(await Pet.find({ user: req.user._id }));
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.put('/api/pets/:id/avatar', protect, async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.id);
        if (pet && pet.user.toString() === req.user._id.toString()) {
            pet.avatarBaseColor = req.body.avatarBaseColor || pet.avatarBaseColor;
            pet.avatarAccessory = req.body.avatarAccessory || pet.avatarAccessory;
            res.json(await pet.save());
        } else {
            res.status(404).json({ message: 'Pet not found or not authorized' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.post('/api/moods/:petId', protect, async (req, res) => {
    try {
        const { mood } = req.body;
        const pet = await Pet.findById(req.params.petId);
        if (!pet || pet.user.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Pet not found or not authorized.' });
        }
        const newMood = new PetMood({ pet: req.params.petId, user: req.user._id, mood });
        res.status(201).json(await newMood.save());
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.get('/api/moods/:petId', protect, async (req, res) => {
    try {
        const pet = await Pet.findById(req.params.petId);
        if (!pet || pet.user.toString() !== req.user._id.toString()) {
            return res.status(404).json({ message: 'Pet not found or not authorized.' });
        }
        res.json(await PetMood.find({ pet: req.params.petId }).sort({ createdAt: -1 }).limit(10));
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// --- Memory Wall Routes ---
app.get('/api/memories', async (req, res) => {
    try {
        res.json(await Memory.find({}).sort({ createdAt: -1 }));
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});
app.post('/api/memories', protect, async (req, res) => {
    try {
        const { petName, imageUrl, tribute } = req.body;
        const memory = new Memory({ user: req.user._id, petName, imageUrl, tribute });
        res.status(201).json(await memory.save());
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ===================================
// DATABASE CONNECTION & SERVER START
// ===================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Successfully connected to MongoDB');
    app.listen(port, () => {
      console.log(`🚀 Server is running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.log('❌ Error connecting to MongoDB:', err);
  });