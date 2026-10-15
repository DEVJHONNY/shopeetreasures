const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'shopee.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price_original REAL,
    price_discount REAL NOT NULL,
    discount_pct INTEGER,
    category TEXT DEFAULT 'Geral',
    image_url TEXT NOT NULL,
    affiliate_link TEXT NOT NULL,
    badge TEXT,
    clicks INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Add migrations for new columns if they do not exist
try { db.exec("ALTER TABLE products ADD COLUMN shop_name TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN video_url TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN sales_count TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN rating REAL DEFAULT 4.8;"); } catch (e) {}

// Update or insert brand settings
const insertOrReplaceSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
insertOrReplaceSetting.run('site_title', 'ShopeeTreasures');
insertOrReplaceSetting.run('site_subtitle', 'Curadoria independente com os melhores achados e preços verificados na Shopee.');
insertOrReplaceSetting.run('site_badge', 'Curadoria Independente');
insertOrReplaceSetting.run('site_disclaimer', 'ShopeeTreasures é uma vitrine independente de curadoria de produtos disponíveis na Shopee. Não somos a Shopee e não vendemos produtos diretamente. Links de afiliados.');
if (!db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get()) {
  insertOrReplaceSetting.run('admin_password', 'Luc@S076140');
}
if (!db.prepare("SELECT value FROM settings WHERE key = 'whatsapp_link'").get()) {
  insertOrReplaceSetting.run('whatsapp_link', 'https://chat.whatsapp.com/');
}
if (!db.prepare("SELECT value FROM settings WHERE key = 'instagram_link'").get()) {
  insertOrReplaceSetting.run('instagram_link', 'https://instagram.com/');
}

// Initial demo seeding removed - only authentic Shopee API products allowed

module.exports = db;
