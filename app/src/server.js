require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 3000);
const serverId = process.env.SERVER_ID || 'Node_A';

const commonPoolOptions = {
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password',
  database: process.env.DB_NAME || 'products_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const masterPool = mysql.createPool({
  ...commonPoolOptions,
  host: process.env.MASTER_HOST || '127.0.0.1',
  port: Number(process.env.MASTER_PORT || 3306)
});

const slavePool = mysql.createPool({
  ...commonPoolOptions,
  host: process.env.SLAVE_HOST || '127.0.0.1',
  port: Number(process.env.SLAVE_PORT || 3307)
});

app.get('/health', async (_req, res) => {
  try {
    await masterPool.query('SELECT 1');
    await slavePool.query('SELECT 1');
    res.json({ status: 'ok', processed_by: serverId });
  } catch (error) {
    res.status(500).json({ status: 'error', processed_by: serverId, message: error.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ message: 'price must be a positive number' });
    }

    const [result] = await masterPool.execute(
      'INSERT INTO products (name, price) VALUES (?, ?)',
      [name.trim(), numericPrice]
    );

    const [rows] = await masterPool.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Product created successfully',
      processed_by: serverId,
      data: rows[0] || { id: result.insertId, name: name.trim(), price: numericPrice }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', processed_by: serverId, error: error.message });
  }
});

app.get('/products', async (_req, res) => {
  try {
    const [rows] = await slavePool.query('SELECT id, name, price, created_at, updated_at FROM products ORDER BY id ASC');

    res.json({
      processed_by: serverId,
      source: 'slave',
      data: rows
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', processed_by: serverId, error: error.message });
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found', processed_by: serverId });
});

app.listen(port, () => {
  console.log(`API ${serverId} listening on port ${port}`);
});