import sqlite3
import os
from datetime import datetime

os.makedirs('data', exist_ok=True)
DATABASE = 'data/tasks.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS daily_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            content TEXT
        )
    ''')
    try:
        conn.execute('ALTER TABLE daily_notes ADD COLUMN is_holiday BOOLEAN DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute('ALTER TABLE daily_notes ADD COLUMN is_off_day BOOLEAN DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

def get_note_by_date(date_str):
    conn = get_db()
    note = conn.execute('SELECT * FROM daily_notes WHERE date = ?', (date_str,)).fetchone()
    conn.close()
    return note

def save_note_by_date(date_str, content, is_holiday=False, is_off_day=False):
    conn = get_db()
    conn.execute('''
        INSERT INTO daily_notes (date, content, is_holiday, is_off_day)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET 
            content=excluded.content,
            is_holiday=excluded.is_holiday,
            is_off_day=excluded.is_off_day
    ''', (date_str, content, int(is_holiday), int(is_off_day)))
    conn.commit()
    conn.close()
    
def get_all_dates():
    conn = get_db()
    dates = conn.execute('SELECT date FROM daily_notes ORDER BY date DESC').fetchall()
    conn.close()
    return [row['date'] for row in dates]

def get_all_notes():
    conn = get_db()
    notes = conn.execute('SELECT date, content, is_holiday, is_off_day FROM daily_notes ORDER BY date DESC').fetchall()
    conn.close()
    return [{"date": row['date'], "content": row['content'], "is_holiday": bool(row['is_holiday']), "is_off_day": bool(row['is_off_day'])} for row in notes]