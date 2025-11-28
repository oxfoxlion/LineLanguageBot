// services/inspectDB.js
import { query } from './db.js';

export async function printDatabaseStatus(limit = 10) {
  console.log('🔍 Fetching recent data from database...\n');

  // List tables under the "linebot" schema
  const { rows: tables } = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'linebot'
    ORDER BY table_name;
  `);

  if (tables.length === 0) {
    console.log("❌ No tables found under schema 'linebot'");
    return;
  }

  for (const { table_name } of tables) {
    console.log(`📘 Table: ${table_name}`);

    try {
      // Does table have created_at?
      const { rows: hasCreatedAt } = await query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'linebot'
          AND table_name = $1
          AND column_name = 'created_at'
        LIMIT 1;
        `,
        [table_name]
      );

      const orderBy = hasCreatedAt.length ? 'ORDER BY created_at DESC NULLS LAST' : '';

      const { rows } = await query(
        `
        SELECT *
        FROM linebot.${table_name}
        ${orderBy}
        LIMIT $1;
        `,
        [limit]
      );

      if (rows.length === 0) {
        console.log('   (no data)\n');
        continue;
      }

      const columns = Object.keys(rows[0]);
      console.log('   Columns:', columns.join(', '));
      rows.forEach((row, i) => {
        console.log(`   #${i + 1}:`, JSON.stringify(row, null, 2));
      });
      console.log('');
    } catch (err) {
      // Mask credentials if we print the URL
      const safeUrl = (process.env.DATABASE_URL || '').replace(/:\/\/.*@/, '://***@');
      console.error(`   ⚠️ Failed on table ${table_name}: ${err.message}`);
      console.error(`   (DATABASE_URL=${safeUrl})\n`);
    }
  }

  console.log('✅ Database inspection finished.');
}

// Run directly
if (process.argv[1]?.endsWith('inspectDB.js')) {
  printDatabaseStatus().catch((e) => {
    console.error('❌ Inspection failed:', e);
    process.exit(1);
  });
}
