document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const statusText = document.getElementById('save-status');
    const statusIndicator = document.querySelector('.status-indicator');
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    let saveTimeout;

    // Theme Toggle Logic
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Helper for today's date and edit permissions
    function getTodayString() {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();
        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;
        return yyyy + '-' + mm + '-' + dd;
    }

    // Sidebar Month Navigation Logic
    const monthGroups = Array.from(document.querySelectorAll('.month-group'));
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const monthLabel = document.getElementById('month-display-label');

    if (monthGroups.length > 0) {
        let activeIndex = monthGroups.findIndex(g => g.querySelector('.date-item.active') !== null);
        let currentGroupIndex = activeIndex !== -1 ? activeIndex : 0;

        function updateMonthView(direction = 'none') {
            monthGroups.forEach((group, index) => {
                if (index === currentGroupIndex) {
                    group.style.display = 'block';
                    group.classList.remove('slide-left', 'slide-right');
                    // Force DOM reflow to restart animation
                    void group.offsetWidth; 
                    if (direction === 'left') {
                        group.classList.add('slide-left');
                    } else if (direction === 'right') {
                        group.classList.add('slide-right');
                    }
                    monthLabel.textContent = group.getAttribute('data-month');
                } else {
                    group.style.display = 'none';
                }
            });
            
            // monthGroups is sorted descending (newest first, [Sep 2026, Aug 2026, ...])
            // Previous (<) = older month = index + 1
            // Next (>) = newer month = index - 1
            prevMonthBtn.disabled = currentGroupIndex >= monthGroups.length - 1;
            nextMonthBtn.disabled = currentGroupIndex <= 0;
        }

        prevMonthBtn.addEventListener('click', () => {
            if (currentGroupIndex < monthGroups.length - 1) {
                currentGroupIndex++;
                updateMonthView('left');
            }
        });

        nextMonthBtn.addEventListener('click', () => {
            if (currentGroupIndex > 0) {
                currentGroupIndex--;
                updateMonthView('right');
            }
        });

        // Initialize view
        updateMonthView();
    }

    let hasConfirmedEdit = false;

    function requireEditPermission(e) {
        if (window.CURRENT_DATE === getTodayString() || hasConfirmedEdit) {
            return true;
        }
        
        if (confirm("You are viewing a past/different date. Are you sure you want to edit it?")) {
            hasConfirmedEdit = true;
            return true;
        } else {
            if (e) e.preventDefault();
            editor.blur();
            return false;
        }
    }

    // Holiday/Off Day Logic
    const holidayBtn = document.getElementById('holiday-btn');
    if (holidayBtn) {
        holidayBtn.addEventListener('click', (e) => {
            if (!requireEditPermission(e)) return;
            window.IS_HOLIDAY = !window.IS_HOLIDAY;
            if (window.IS_HOLIDAY) {
                holidayBtn.classList.add('active-state');
                if (window.IS_OFF_DAY) {
                    window.IS_OFF_DAY = false;
                    document.getElementById('off-day-btn').classList.remove('active-state');
                }
            } else {
                holidayBtn.classList.remove('active-state');
            }
            saveContent();
        });
    }

    const offDayBtn = document.getElementById('off-day-btn');
    if (offDayBtn) {
        offDayBtn.addEventListener('click', (e) => {
            if (!requireEditPermission(e)) return;
            window.IS_OFF_DAY = !window.IS_OFF_DAY;
            if (window.IS_OFF_DAY) {
                offDayBtn.classList.add('active-state');
                if (window.IS_HOLIDAY) {
                    window.IS_HOLIDAY = false;
                    document.getElementById('holiday-btn').classList.remove('active-state');
                }
            } else {
                offDayBtn.classList.remove('active-state');
            }
            saveContent();
        });
    }

    // Initialize content as list if empty
    if (editor.innerHTML.trim() === '' || editor.innerHTML.trim() === '<br>') {
        editor.innerHTML = '<ul><li><br></li></ul>';
    }

    // Auto-save function
    async function saveContent() {
        statusText.textContent = 'Saving...';
        statusIndicator.classList.add('saving');
        
        try {
            const response = await fetch(`/api/save/${window.CURRENT_DATE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: editor.innerHTML,
                    is_holiday: window.IS_HOLIDAY,
                    is_off_day: window.IS_OFF_DAY
                })
            });
            
            if (response.ok) {
                statusText.textContent = 'Saved';
                statusIndicator.classList.remove('saving');
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            console.error('Error saving:', error);
            statusText.textContent = 'Error saving';
            statusIndicator.classList.remove('saving');
            // Change dot color to red on error
            document.querySelector('.status-dot').style.backgroundColor = '#ef4444';
            document.querySelector('.status-dot').style.boxShadow = '0 0 8px #ef4444';
        }
    };

    // Listen for input to trigger auto-save
    editor.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        statusText.textContent = 'Saving...';
        // reset error style if it was there
        document.querySelector('.status-dot').style.backgroundColor = '';
        document.querySelector('.status-dot').style.boxShadow = '';
        
        saveTimeout = setTimeout(saveContent, 1000); // 1s debounce
    });

    // Handle keyboard shortcuts (Tab, Enter, Ctrl+B, Backspace)
    editor.addEventListener('keydown', (e) => {
        // Exclude pure navigation keys from prompting
        const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Shift', 'Control', 'Alt', 'Meta', 'Escape'];
        if (!navKeys.includes(e.key)) {
            if (!requireEditPermission(e)) return;
        }
        
        // Handle Ctrl+B or Cmd+B for bold
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
            return;
        }

        // Handle Tab for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                document.execCommand('outdent', false, null);
            } else {
                document.execCommand('indent', false, null);
            }
            return;
        }

        // Handle Shift + Delete (or Shift + Backspace) for outdent
        if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
            e.preventDefault();
            document.execCommand('outdent', false, null);
            return;
        }
        
        let sel = window.getSelection();
        if (!sel.rangeCount) return;
        let range = sel.getRangeAt(0);
        
        let startContainer = range.startContainer;
        let li = startContainer.nodeType === 3 ? startContainer.parentNode.closest('li') : (startContainer.closest ? startContainer.closest('li') : null);

        // Ensure Enter creates new list items appropriately and doesn't break the list
        if (e.key === 'Enter') {
            if (li && li.textContent.trim() === '') {
                e.preventDefault();
                let newLi = document.createElement('li');
                newLi.innerHTML = '<br>';
                li.parentNode.insertBefore(newLi, li.nextSibling);
                let newRange = document.createRange();
                newRange.setStart(newLi, 0);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            } else if (!li) {
                e.preventDefault();
                document.execCommand('insertUnorderedList', false, null);
            }
        }
        
        // Handle Backspace to remove bullet point without breaking out of the list
        if (e.key === 'Backspace' && li) {
            let isAtStart = false;
            if (range.startOffset === 0) {
                if (startContainer === li || startContainer === li.firstChild || li.textContent === '') {
                    isAtStart = true;
                }
            }
            
            if (isAtStart) {
                e.preventDefault();
                let prevLi = li.previousElementSibling;
                
                if (li.textContent === '') {
                    if (prevLi) {
                        li.remove();
                        let newRange = document.createRange();
                        newRange.selectNodeContents(prevLi);
                        newRange.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                    }
                } else {
                    if (prevLi) {
                        let lastChild = prevLi.lastChild;
                        // For BR at the end of the previous LI, we can remove it so text merges correctly
                        if (lastChild && lastChild.nodeName === 'BR') {
                            lastChild.remove();
                            lastChild = prevLi.lastChild;
                        }
                        
                        while(li.firstChild) {
                            prevLi.appendChild(li.firstChild);
                        }
                        li.remove();
                        
                        let newRange = document.createRange();
                        if (lastChild) {
                            if (lastChild.nodeType === 3) {
                                newRange.setStart(lastChild, lastChild.length);
                            } else {
                                newRange.setStartAfter(lastChild);
                            }
                        } else {
                            newRange.setStart(prevLi, 0);
                        }
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                    }
                }
            }
        }
    });

    editor.addEventListener('paste', (e) => {
        if (!requireEditPermission(e)) return;
    });

    // Ensure focus is kept inside the list if clicked empty space
    editor.addEventListener('click', (e) => {
        if (editor.innerHTML.trim() === '') {
            editor.innerHTML = '<ul><li><br></li></ul>';
            // Move cursor to the new li
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(editor.querySelector('li'), 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });

    // Export to Markdown Logic
    const exportBtn = document.getElementById('export-md');
    
    function getOrdinalNum(n) {
        return n + (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
    }

    function formatDateForExport(dateStr) {
        const parts = dateStr.split('-');
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        const day = getOrdinalNum(date.getDate());
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }

    function domToMarkdown(node, depth = 0) {
        let md = '';
        for (let child of node.childNodes) {
            if (child.nodeName === 'UL') {
                md += domToMarkdown(child, depth + 1);
            } else if (child.nodeName === 'LI') {
                const indent = '  '.repeat(Math.max(0, depth - 1));
                
                let clone = child.cloneNode(true);
                // remove nested ULs from clone so they aren't part of this li's text
                const uls = clone.querySelectorAll('ul');
                uls.forEach(ul => ul.remove());
                
                // convert bold tags
                const bolds = clone.querySelectorAll('b, strong');
                bolds.forEach(b => {
                    b.replaceWith('**' + b.textContent + '**');
                });
                
                let text = clone.textContent.trim();
                if (text) {
                    // Double newline to match the requested format
                    md += `\n\n${indent}- ${text}`;
                }
                
                // recursively process the original child's ULs
                for (let n of child.childNodes) {
                    if (n.nodeName === 'UL') {
                        md += domToMarkdown(n, depth);
                    }
                }
            }
        }
        return md;
    }

    exportBtn.addEventListener('click', async () => {
        try {
            exportBtn.textContent = 'Generating...';
            exportBtn.disabled = true;

            const response = await fetch('/api/notes/all');
            if (!response.ok) throw new Error('Network response was not ok');
            const notes = await response.json();

            let fullMarkdown = '# Daily Task Monitor Report\n\n';

            notes.forEach(note => {
                const dateFormatted = formatDateForExport(note.date);
                fullMarkdown += `**Date:** ${dateFormatted}\n`;
                
                // Use a temporary div to parse HTML content safely
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = note.content;
                const md = domToMarkdown(tempDiv);
                
                if (md.trim()) {
                    fullMarkdown += md + '\n\n';
                } else {
                    fullMarkdown += '\n\n';
                }
            });

            // Trigger download
            const blob = new Blob([fullMarkdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Daily_Task_Report.md`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting report:', error);
            alert("Failed to export report.");
        } finally {
            // Restore button content
            exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Export .md';
            exportBtn.disabled = false;
        }
    });
});
