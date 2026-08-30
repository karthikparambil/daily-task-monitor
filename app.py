from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime
import models

app = Flask(__name__)

# Initialize DB
with app.app_context():
    models.init_db()

@app.route('/')
def index():
    # Redirect to today's date
    today_str = datetime.now().strftime('%Y-%m-%d')
    return redirect(url_for('view_date', date_str=today_str))

@app.route('/<date_str>')
def view_date(date_str):
    # Validate date format simply
    try:
        req_date = datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        return "Invalid date format, use YYYY-MM-DD", 400

    # Block future dates
    if req_date.date() > datetime.now().date():
        return redirect(url_for('index'))

    note = models.get_note_by_date(date_str)
    content = note['content'] if note and note['content'] else "<ul><li><br></li></ul>"
    
    all_notes = models.get_all_notes()
    date_info_list = []
    all_dates_set = set()
    
    for n in all_notes:
        d = n['date']
        c = n['content']
        is_holiday = "🏖️ Holiday" in c
        is_off_day = "☕ Off Day" in c
        date_info_list.append({
            'date': d,
            'is_holiday': is_holiday,
            'is_off_day': is_off_day
        })
        all_dates_set.add(d)
        
    if date_str not in all_dates_set:
        date_info_list.insert(0, {
            'date': date_str,
            'is_holiday': False,
            'is_off_day': False
        })
        date_info_list.sort(key=lambda x: x['date'], reverse=True)
        
    # remove duplicates
    seen = set()
    unique_date_info_list = []
    for di in date_info_list:
        if di['date'] not in seen:
            seen.add(di['date'])
            unique_date_info_list.append(di)

    return render_template('index.html', current_date=date_str, content=content, all_dates=unique_date_info_list)

@app.route('/api/save/<date_str>', methods=['POST'])
def save_note(date_str):
    data = request.get_json()
    content = data.get('content', '')
    models.save_note_by_date(date_str, content)
    return jsonify({"status": "success"})

@app.route('/api/notes/all', methods=['GET'])
def get_all_notes():
    notes = models.get_all_notes()
    return jsonify(notes)

import os

if __name__ == '__main__':
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    app.run(host=host, debug=True, port=5324)
