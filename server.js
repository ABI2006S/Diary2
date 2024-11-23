const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// MongoDB connection with retry logic
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Retry connection after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

// Reconnect on disconnection
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

// Schema
const EntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  signature: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Entry = mongoose.model('Entry', EntrySchema);

// Routes
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

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
