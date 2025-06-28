const { Pool } = require('pg');

// Database configuration (same as in index.js)
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'retete_db',
    password: '1406',
    port: 5432
};

async function testConnection() {
    const pool = new Pool(dbConfig);
    
    try {
        console.log('🔌 Testing database connection...');
        
        // Test basic connection
        const client = await pool.connect();
        console.log('✅ Database connection successful!');
        
        // Test a simple query
        const result = await client.query('SELECT NOW() as current_time');
        console.log(`⏰ Current database time: ${result.rows[0].current_time}`);
        
        // Check if tables exist
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('📋 Available tables:');
        if (tablesResult.rows.length === 0) {
            console.log('   No tables found. Run setup_database.js first.');
        } else {
            tablesResult.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
        }
        
        client.release();
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.log('\n🔧 Troubleshooting tips:');
        console.log('1. Make sure PostgreSQL is running');
        console.log('2. Verify the database "retete_db" exists');
        console.log('3. Check your username and password');
        console.log('4. Ensure PostgreSQL is listening on port 5432');
    } finally {
        await pool.end();
    }
}

testConnection(); 