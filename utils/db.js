import mysql from "mysql2/promise";
import {
  DB_HOST,
  DB_NAME,
  DB_PASS,
  DB_PORT,
  DB_USER,
  NODE_ENV,
} from "./dotenv.js";

let pool;

const ensure_db_exists = async () => {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
  await connection.end();
};

const connect_db = async () => {
  try {
    if (NODE_ENV === "development") {
      await ensure_db_exists();
    }

    // Create a connection pool
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    console.log("Connected to MySQL DB...");
  } catch (error) {
    console.error("DB connection error:", error);
  }
};

export { pool as db, connect_db };
