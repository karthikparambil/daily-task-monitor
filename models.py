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
    conn.commit()
    conn.close()

def get_note_by_date(date_str):
    conn = get_db()
    note = conn.execute('SELECT * FROM daily_notes WHERE date = ?', (date_str,)).fetchone()
    conn.close()
    return note

def save_note_by_date(date_str, content):
    conn = get_db()
    conn.execute('''
        INSERT INTO daily_notes (date, content)
        VALUES (?, ?)
        ON CONFLICT(date) DO UPDATE SET content=excluded.content
    ''', (date_str, content))
    conn.commit()
    conn.close()
    
def get_all_dates():
    conn = get_db()
    dates = conn.execute('SELECT date FROM daily_notes ORDER BY date DESC').fetchall()
    conn.close()
    return [row['date'] for row in dates]

def get_all_notes():
    conn = get_db()
    notes = conn.execute('SELECT date, content FROM daily_notes ORDER BY date DESC').fetchall()
    conn.close()
    return [{"date": row['date'], "content": row['content']} for row in notes]