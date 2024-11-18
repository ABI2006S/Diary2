const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Validate environment variables
const requiredEnvVars = ['MONGODB_URI', 'WRITE_PASSWORD', 'READ_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// MongoDB connection with proper error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// Entry Schema
const EntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  signature: { type: String, required: true },
  date: { type: String, required: true }
}, { timestamps: true });

const Entry = mongoose.model('Entry', EntrySchema);

// API Routes
app.post('/api/verify-password', (req, res) => {
  try {
    const { password, type } = req.body;
    if (!password || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const correctPassword = type === 'write' ? 
      process.env.WRITE_PASSWORD : 
      process.env.READ_PASSWORD;
    
    res.json({ isCorrect: password === correctPassword });
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const { password, entry } = req.body;
    if (!password || !entry) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password !== process.env.WRITE_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const newEntry = new Entry(entry);
    await newEntry.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Entry creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/entries', async (req, res) => {
  try {
    const { password } = req.query;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password !== process.env.READ_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const entries = await Entry.find().sort({ createdAt: -1 }).lean();
    res.json(entries);
  } catch (error) {
    console.error('Entry retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 
      'Something went wrong' : 
      err.message
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't exit the process in production
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

module.exports = app;
