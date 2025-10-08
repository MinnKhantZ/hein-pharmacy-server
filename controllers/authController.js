const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthController {
  static async register(req, res) {
    try {
      const { username, password, full_name, email, phone } = req.body;

      // Check if username already exists
      const existingUser = await pool.query(
        'SELECT id FROM owners WHERE username = $1',
        [username]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new owner
      const result = await pool.query(
        `INSERT INTO owners (username, password, full_name, email, phone) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, phone, created_at`,
        [username, hashedPassword, full_name, email, phone]
      );

      const newOwner = result.rows[0];

      // Generate JWT token
      const token = jwt.sign(
        { id: newOwner.id, username: newOwner.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'Owner registered successfully',
        owner: newOwner,
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Find owner by username
      const result = await pool.query(
        'SELECT id, username, password, full_name, email, phone, is_active FROM owners WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const owner = result.rows[0];

      if (!owner.is_active) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, owner.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: owner.id, username: owner.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // Remove password from response
      delete owner.password;

      res.json({
        message: 'Login successful',
        owner,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getProfile(req, res) {
    try {
      const result = await pool.query(
        'SELECT id, username, full_name, email, phone, created_at FROM owners WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { full_name, email, phone } = req.body;
      
      const result = await pool.query(
        `UPDATE owners 
         SET full_name = COALESCE($1, full_name), 
             email = COALESCE($2, email), 
             phone = COALESCE($3, phone)
         WHERE id = $4 
         RETURNING id, username, full_name, email, phone`,
        [full_name, email, phone, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        owner: result.rows[0]
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getAllOwners(req, res) {
    try {
      // Everyone can get all owners (no admin restriction)
      const result = await pool.query(
        'SELECT id, username, full_name, email, phone, is_active, created_at FROM owners WHERE is_active = true ORDER BY full_name'
      );

      res.json({ owners: result.rows });
    } catch (error) {
      console.error('Get all owners error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createOwner(req, res) {
    try {
      // Only admin can create new owners
      if (req.user.username !== 'admin') {
        return res.status(403).json({ error: 'Only admin can create new owner accounts' });
      }

      const { username, password, full_name, email, phone } = req.body;

      if (!username || !password || !full_name) {
        return res.status(400).json({ error: 'Username, password, and full name are required' });
      }

      // Check if username already exists
      const existing = await pool.query(
        'SELECT id FROM owners WHERE username = $1',
        [username]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO owners (username, password, full_name, email, phone) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, phone, created_at`,
        [username, hashedPassword, full_name, email, phone]
      );

      res.status(201).json({
        message: 'Owner created successfully',
        owner: result.rows[0]
      });
    } catch (error) {
      console.error('Create owner error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteOwner(req, res) {
    try {
      const { id } = req.params;

      // Soft delete - set is_active to false (no cascade)
      const result = await pool.query(
        'UPDATE owners SET is_active = false WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Owner not found' });
      }

      res.json({ message: 'Owner deleted successfully' });
    } catch (error) {
      console.error('Delete owner error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AuthController;