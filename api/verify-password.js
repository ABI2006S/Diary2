// api/verify-password.js
import { compare } from 'bcrypt';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password, type } = req.body;

    // Ensure password and type are provided
    if (!password || !type) {
      return res.status(400).json({ error: 'Password and type are required' });
    }

    // Verify against the appropriate password based on type
    let isValid = false;
    if (type === 'write') {
      isValid = password === process.env.WRITE_PASSWORD;
    } else if (type === 'read') {
      isValid = password === process.env.READ_PASSWORD;
    } else {
      return res.status(400).json({ error: 'Invalid access type' });
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // If password is valid, return success
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Password verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
