require('dotenv').config();
const {Pool} = require('pg');

try {
    const pool = new Pool({
            user:process.env.DB_USER,
            host:process.env.DB_HOST,
            database:process.env.DB_NAME,
            password:process.env.DB_PASSWORD,
            port:process.env.DB_PORT
    });
    console.log('Connected to the database successfully');
    module.exports = pool;
} catch (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1); // Exit the application with an error code
}   