const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { password, type } = req.body;

    // Validate input
    if (!password || !type) {
      return res.status(400).json({
        success: false,
        message: 'Password and type are required'
      });
    }

    // Verify against the appropriate password
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

    return res.json({
      success: true,
      isCorrect: isCorrect,
      message: isCorrect ? 'Password verified' : 'Invalid password'
    });

  } catch (error) {
    console.error('Password verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying password'
    });
  }
});

module.exports = router;
