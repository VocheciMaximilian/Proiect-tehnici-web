const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'retete_db',
    password: '1406',
    port: 5432
};

// Create a pool for database operations
const pool = new Pool(dbConfig);

async function setupDatabase() {
    try {
        console.log('🔧 Starting database setup...');
        
        // Read SQL files
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        const populateSQL = fs.readFileSync(path.join(__dirname, 'populate_retete.sql'), 'utf8');
        
        console.log('📖 Schema and data files loaded successfully');
        
        // Execute schema
        console.log('🏗️  Creating database schema...');
        await pool.query(schemaSQL);
        console.log('✅ Schema created successfully');
        
        // Execute populate script
        console.log('📊 Populating database with sample data...');
        await pool.query(populateSQL);
        console.log('✅ Database populated successfully');
        
        // Verify the setup
        console.log('🔍 Verifying database setup...');
        const result = await pool.query('SELECT COUNT(*) as count FROM retete');
        console.log(`✅ Database setup complete! Found ${result.rows[0].count} recipes in the database.`);
        
    } catch (error) {
        console.error('❌ Error during database setup:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the setup if this file is executed directly
if (require.main === module) {
    setupDatabase()
        .then(() => {
            console.log('🎉 Database setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { setupDatabase }; 