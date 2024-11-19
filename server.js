const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // Add payload limit
app.use(express.static('public'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// MongoDB connection configuration
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  keepAlive: true,
  keepAliveInitialDelay: 300000
};

// MongoDB connection management
async function connectToMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    console.log('MongoDB connected successfully');
    
    // Connection test
    const pingResult = await mongoose.connection.db.admin().ping();
    console.log('MongoDB connection test successful:', pingResult);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Retry connection after delay
    setTimeout(connectToMongoDB, 5000);
  }
}

// MongoDB event handlers
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectToMongoDB, 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
  if (err.name === 'MongoNetworkError') {
    setTimeout(connectToMongoDB, 5000);
  }
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
});

// Schema definition with validation
const EntrySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    maxlength: 100
  },
  message: { 
    type: String, 
    required: true,
    maxlength: 1000
  },
  signature: { 
    type: String, 
    required: true,
    maxlength: 100000
  },
  date: { 
    type: String, 
    required: true
  }
}, { timestamps: true });

const Entry = mongoose.model('Entry', EntrySchema);

// Rate limiting for password verification
const rateLimit = require('express-rate-limit');
const verifyPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// API Routes with async/await error handling
app.post('/api/verify-password', verifyPasswordLimiter, (req, res) => {
  try {
    const { password, type } = req.body;
    if (!password || !type) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const correctPassword = type === 'write' ? process.env.WRITE_PASSWORD : process.env.READ_PASSWORD;
    const isCorrect = password === correctPassword;
    res.json({ isCorrect });
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ success: false, message: 'Error during password verification' });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const { password, entry } = req.body;
    
    if (!password || !entry) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    if (password !== process.env.WRITE_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
    
    const newEntry = new Entry(entry);
    await newEntry.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving entry:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Invalid entry data' });
    }
    res.status(500).json({ success: false, message: 'Error saving entry' });
  }
});

app.get('/api/entries', async (req, res) => {
  try {
    const { password } = req.query;
    
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }
    
    if (password !== process.env.READ_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }
    
    const entries = await Entry.find().sort({ createdAt: -1 }).limit(100);
    res.json(entries);
  } catch (error) {
    console.error('Error reading entries:', error);
    res.status(500).json({ success: false, message: 'Error reading entries' });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server with connection handling
async function startServer() {
  try {
    await connectToMongoDB();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
