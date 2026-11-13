const mysql = require("mysql2");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "intelliroute_db",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Handle pool error events to prevent uncaught exceptions on idle timeouts
pool.on("error", (err) => {
  console.warn("⚠️ MySQL Pool Event:", err.message);
});

// Initial connection check
pool.getConnection((err, conn) => {
  if (err) {
    console.error("❌ MySQL Connection Failed:", err.message);
    return;
  }
  console.log("✅ MySQL Connected Successfully via Connection Pool");
  conn.release();
});

// Keep-alive heartbeat every 60 seconds to prevent idle socket drop
setInterval(() => {
  pool.query("SELECT 1", (err) => {
    if (err) console.warn("MySQL keep-alive ping warning:", err.message);
  });
}, 60000);

module.exports = pool;
