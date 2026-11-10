// db.js

const { Pool } = require("pg");
require("dotenv").config();

const { types } = require("pg");

types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database:
    process.env.NODE_ENV === "test"
      ? process.env.TEST_DB_NAME
      : process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

module.exports = pool;
