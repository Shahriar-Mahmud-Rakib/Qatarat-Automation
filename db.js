require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '13.215.213.102',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USERNAME || 'qatarat-prod-db-replica-user',
  password: process.env.DB_PASSWORD || 'Kbzz8ef82K0tdJCHtCcG',
  database: process.env.DB_DATABASE || 'qatarat-prod-db-replica',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000
});

module.exports = pool;
