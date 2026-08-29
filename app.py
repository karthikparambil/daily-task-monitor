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
    
    all_dates = models.get_all_dates()
    if date_str not in all_dates:
        # If it's a new date that hasn't been saved yet, still show it in sidebar or as current
        all_dates.insert(0, date_str)
        # sort again just in case
        all_dates.sort(reverse=True)
        
    # unique dates
    all_dates = list(dict.fromkeys(all_dates))

    return render_template('index.html', current_date=date_str, content=content, all_dates=all_dates)

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
