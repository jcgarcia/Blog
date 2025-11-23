const { getDbPool } = require('./api/db.js');

(async () => {
  try {
    const pool = getDbPool();
    
    // Check if aws_config and media_storage_type exist
    const result = await pool.query("SELECT * FROM settings WHERE key IN ('aws_config', 'media_storage_type')");
    console.log('AWS/Media Settings:');
    result.rows.forEach(row => {
      if (row.type === 'json') {
        console.log(row.key + ':', JSON.stringify(JSON.parse(row.value), null, 2));
      } else {
        console.log(row.key + ':', row.value);
      }
    });
    
    // If no media_storage_type, set it to aws
    if (!result.rows.find(r => r.key === 'media_storage_type')) {
      await pool.query("INSERT INTO settings (key, value, type) VALUES ('media_storage_type', 'aws', 'text') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
      console.log('✅ Set media_storage_type to aws');
    } else {
      console.log('media_storage_type already exists');
    }
    
    await pool.end();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
