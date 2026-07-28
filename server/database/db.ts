import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

export interface SqliteDbWrapper {
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }>;
  exec(sql: string): Promise<void>;
}

let dbWrapperInstance: SqliteDbWrapper | null = null;

export async function getDb(): Promise<SqliteDbWrapper> {
  if (dbWrapperInstance) return dbWrapperInstance;

  const dbDir = path.join(process.cwd(), 'server', 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'database.db');
  const schemaPath = path.join(dbDir, 'schema.sql');

  const SQL = await initSqlJs();

  let sqlDb: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
      sqlDb.exec('PRAGMA quick_check;');
    } catch (err) {
      console.error('[Database Init Warning] Could not open database file (malformed or corrupt). Recreating database file...', err);
      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(`${dbPath}.tmp`)) fs.unlinkSync(`${dbPath}.tmp`);
      } catch (_) {}
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }

  const saveToDisk = () => {
    try {
      const data = sqlDb.export();
      const buffer = Buffer.from(data);
      const tmpPath = `${dbPath}.tmp`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, dbPath);
    } catch (err) {
      console.error('[Database Save Error]', err);
    }
  };

  dbWrapperInstance = {
    async get(sql: string, params: any[] = []): Promise<any> {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      let result: any = undefined;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    },

    async all(sql: string, params: any[] = []): Promise<any[]> {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },

    async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
      sqlDb.run(sql, params);

      let lastID = 0;
      let changes = 0;

      try {
        const idRes = sqlDb.exec('SELECT last_insert_rowid() as id');
        if (idRes.length > 0 && idRes[0].values.length > 0) {
          lastID = Number(idRes[0].values[0][0]) || 0;
        }

        const changesRes = sqlDb.exec('SELECT changes() as cnt');
        if (changesRes.length > 0 && changesRes[0].values.length > 0) {
          changes = Number(changesRes[0].values[0][0]) || 0;
        }
      } catch (_) {}

      saveToDisk();

      return { lastID, changes };
    },

    async exec(sql: string): Promise<void> {
      sqlDb.exec(sql);
      saveToDisk();
    }
  };

  await dbWrapperInstance.run('PRAGMA foreign_keys = ON;');

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await dbWrapperInstance.exec(schemaSql);
  }

  // Seed default demo user if no users exist or update demo user password hash
  try {
    const defaultHash = bcrypt.hashSync('password123', 10);
    const existingUser = await dbWrapperInstance.get('SELECT id FROM users WHERE email = ?', ['pharmacist@clinic.org']);
    if (!existingUser) {
      await dbWrapperInstance.run(
        'INSERT INTO users (email, password_hash, clinic_name) VALUES (?, ?, ?)',
        ['pharmacist@clinic.org', defaultHash, 'St. Jude Pharmacy & Health']
      );
      console.log('[Database Seed] Created default demo user: pharmacist@clinic.org / password123');
    } else {
      await dbWrapperInstance.run(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [defaultHash, 'pharmacist@clinic.org']
      );
      console.log('[Database Seed] Verified default demo user password hash: pharmacist@clinic.org');
    }
  } catch (seedErr) {
    console.error('[Database Seed Error]', seedErr);
  }

  return dbWrapperInstance;
}
