const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware with proper error handling
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// MongoDB connection with enhanced error handling
const connectDB = async () => {
  let retries = 5;
  while (retries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      });
      console.log('MongoDB connected successfully');
      return true;
    } catch (err) {
      console.error(`MongoDB connection attempt ${6 - retries} failed:`, err);
      retries -= 1;
      if (retries === 0) {
        console.error('All connection attempts failed');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Schema
const EntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  signature: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Entry = mongoose.model('Entry', EntrySchema);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes with enhanced error handling
app.post('/api/verify-password', (req, res) => {
  try {
    const { password, type } = req.body;
    
    if (!password || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password and type are required' 
      });
    }

    const correctPassword = type === 'write' 
      ? process.env.WRITE_PASSWORD 
      : process.env.READ_PASSWORD;

    if (!correctPassword) {
      console.error(`Missing ${type.toUpperCase()}_PASSWORD environment variable`);
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const isCorrect = password === correctPassword;
    res.json({ success: true, isCorrect });
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying password' 
    });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const { password, entry } = req.body;

    if (!password || !entry) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    if (password !== process.env.WRITE_PASSWORD) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }

    const newEntry = new Entry(entry);
    await newEntry.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving entry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving entry' 
    });
  }
});

app.get('/api/entries', async (req, res) => {
  try {
    const { password } = req.query;

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required' 
      });
    }

    if (password !== process.env.READ_PASSWORD) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }

    const entries = await Entry.find().sort({ date: -1 });
    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching entries' 
    });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server with enhanced error handling
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    const dbConnected = await connectDB();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle process errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

startServer();
