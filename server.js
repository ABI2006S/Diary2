const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection with retry logic
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('MongoDB connected successfully');
    
    // Connection test
    mongoose.connection.db.admin().ping((error, result) => {
      if (error) {
        console.error('MongoDB connection test failed:', error);
      } else {
        console.log('MongoDB connection test successful:', result);
      }
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
  connectWithRetry();
});

const EntrySchema = new mongoose.Schema({
  name: String,
  message: String,
  signature: String,
  date: String
});

const Entry = mongoose.model('Entry', EntrySchema);

app.post('/api/verify-password', (req, res) => {
  const { password, type } = req.body;
  const correctPassword = type === 'write' ? process.env.WRITE_PASSWORD : process.env.READ_PASSWORD;
  
  const isCorrect = password === correctPassword;
  res.json({ isCorrect });
});

app.post('/api/entries', async (req, res) => {
  const { password, entry } = req.body;
  
  if (password === process.env.WRITE_PASSWORD) {
    const newEntry = new Entry(entry);
    try {
      await newEntry.save();
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving entry:', error);
      res.status(500).json({ success: false, message: 'Error saving entry' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password' });
  }
});

app.get('/api/entries', async (req, res) => {
  const { password } = req.query;
  
  if (password === process.env.READ_PASSWORD) {
    try {
      const entries = await Entry.find().lean().exec();
      res.json(entries);
    } catch (error) {
      console.error('Error reading entries:', error);
      res.status(500).json({ success: false, message: 'Error reading entries' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Incorrect password' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
