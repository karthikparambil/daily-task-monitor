from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime, timedelta
import models
import re

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
    if note:
        is_holiday_current = bool(note['is_holiday']) or "🏖️ Holiday" in (note['content'] or "")
        is_off_day_current = bool(note['is_off_day']) or "☕ Off Day" in (note['content'] or "")
        content = note['content'] if note['content'] else "<ul><li><br></li></ul>"
        # Cleanup old titles from displaying in editor
        content = content.replace("<li><strong>🏖️ Holiday</strong></li>", "")
        content = content.replace("<li><strong>☕ Off Day</strong></li>", "")
        content = content.replace("<ul><li><strong>🏖️ Holiday</strong></li></ul>", "<ul><li><br></li></ul>")
        content = content.replace("<ul><li><strong>☕ Off Day</strong></li></ul>", "<ul><li><br></li></ul>")
        if content.replace('<ul>', '').replace('</ul>', '').strip() == '':
            content = "<ul><li><br></li></ul>"
    else:
        is_holiday_current = False
        is_off_day_current = False
        content = "<ul><li><br></li></ul>"
        
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    all_notes = models.get_all_notes()
    notes_by_date = {n['date']: n for n in all_notes}
    
    if not all_notes:
        earliest_date = datetime.strptime(today_str, '%Y-%m-%d').date()
    else:
        earliest_date = datetime.strptime(all_notes[-1]['date'], '%Y-%m-%d').date()
        
    req_d = datetime.strptime(date_str, '%Y-%m-%d').date()
    if req_d < earliest_date:
        earliest_date = req_d
        
    today_d = datetime.strptime(today_str, '%Y-%m-%d').date()
    
    unique_date_info_list = []
    current_d = today_d
    
    while current_d >= earliest_date:
        d_str = current_d.strftime('%Y-%m-%d')
        if d_str in notes_by_date:
            c = notes_by_date[d_str]['content']
            is_holiday = bool(notes_by_date[d_str].get('is_holiday')) or "🏖️ Holiday" in (c or "")
            is_off_day = bool(notes_by_date[d_str].get('is_off_day')) or "☕ Off Day" in (c or "")
            
            # Clean up old titles from counting
            c = (c or "").replace("<li><strong>🏖️ Holiday</strong></li>", "")
            c = c.replace("<li><strong>☕ Off Day</strong></li>", "")
            
            empty_states = ["", "<br>", "<ul><li><br></li></ul>", "<ul><li></li></ul>", "<ul></ul>"]
            if (c and c.strip() in empty_states) or not c:
                line_count = 0
            else:
                li_contents = re.findall(r'<li>(.*?)</li>', c, re.IGNORECASE | re.DOTALL)
                line_count = 0
                for li in li_contents:
                    cleaned = re.sub(r'<br\s*/?>', '', li, flags=re.IGNORECASE).strip()
                    cleaned = cleaned.replace('&nbsp;', '').strip()
                    if cleaned:
                        line_count += 1
                        
            unique_date_info_list.append({
                'date': d_str,
                'month_label': current_d.strftime('%b %Y'),
                'is_holiday': is_holiday,
                'is_off_day': is_off_day,
                'line_count': line_count
            })
        else:
            unique_date_info_list.append({
                'date': d_str,
                'month_label': current_d.strftime('%b %Y'),
                'is_holiday': False,
                'is_off_day': False,
                'line_count': 0
            })
        current_d -= timedelta(days=1)

    from itertools import groupby
    ordered_date_list = []
    for k, g in groupby(unique_date_info_list, key=lambda x: x['month_label']):
        ordered_date_list.extend(list(g)[::-1])
    unique_date_info_list = ordered_date_list

    return render_template('index.html', 
                           current_date=date_str, 
                           content=content, 
                           all_dates=unique_date_info_list,
                           is_holiday_current=is_holiday_current,
                           is_off_day_current=is_off_day_current)

@app.route('/api/save/<date_str>', methods=['POST'])
def save_note(date_str):
    data = request.get_json()
    content = data.get('content', '')
    is_holiday = data.get('is_holiday', False)
    is_off_day = data.get('is_off_day', False)
    models.save_note_by_date(date_str, content, is_holiday, is_off_day)
    return jsonify({"status": "success"})

@app.route('/api/notes/all', methods=['GET'])
def get_all_notes():
    notes = models.get_all_notes()
    return jsonify(notes)

import os

if __name__ == '__main__':
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    app.run(host=host, debug=True, port=5324)
