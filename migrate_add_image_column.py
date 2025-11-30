"""
Migration script to add image_data column to battles table
Run this once to update your existing database schema
"""
import sqlite3
from pathlib import Path

def migrate_database():
    db_path = Path("./battles.db")
    
    if not db_path.exists():
        print("❌ Database file not found at ./battles.db")
        print("💡 The database will be created automatically when you start the server.")
        return
    
    print(f"📦 Found database at {db_path}")
    
    # Check if column already exists
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get table info
    cursor.execute("PRAGMA table_info(battles)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'image_data' in columns:
        print("✅ Column 'image_data' already exists. No migration needed.")
        conn.close()
        return
    
    print("🔧 Adding image_data column to battles table...")
    
    try:
        # Add the column (allows NULL, which is fine for existing rows)
        cursor.execute("ALTER TABLE battles ADD COLUMN image_data TEXT")
        conn.commit()
        print("✅ Successfully added image_data column!")
        print("✅ Migration complete. You can now use screenshot features.")
        conn.close()
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"❌ Error during migration: {e}")
        raise

if __name__ == "__main__":
    migrate_database()
