require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '13.215.213.102',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USERNAME || 'qatarat-prod-db-replica-user',
  password: process.env.DB_PASSWORD || 'Kbzz8ef82K0tdJCHtCcG',
  database: process.env.DB_DATABASE || 'qatarat-prod-db-replica',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 30,
  queueLimit: 0,
  connectTimeout: 20000
});

module.exports = pool;
