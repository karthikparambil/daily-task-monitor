document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const statusText = document.getElementById('save-status');
    const statusIndicator = document.querySelector('.status-indicator');
    
    let saveTimeout;

    // Initialize content as list if empty
    if (editor.innerHTML.trim() === '' || editor.innerHTML.trim() === '<br>') {
        editor.innerHTML = '<ul><li><br></li></ul>';
    }

    // Auto-save function
    const saveContent = async () => {
        statusText.textContent = 'Saving...';
        statusIndicator.classList.add('saving');
        
        try {
            const response = await fetch(`/api/save/${window.CURRENT_DATE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: editor.innerHTML
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
        statusText.textContent = 'Unsaved changes...';
        // reset error style if it was there
        document.querySelector('.status-dot').style.backgroundColor = '';
        document.querySelector('.status-dot').style.boxShadow = '';
        
        saveTimeout = setTimeout(saveContent, 1000); // 1s debounce
    });

    // Handle keyboard shortcuts (Tab, Enter, Ctrl+B)
    editor.addEventListener('keydown', (e) => {
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
        }
        
        // Ensure Enter creates new list items appropriately
        if (e.key === 'Enter') {
            // document.execCommand handles Enter within ul/li naturally in modern browsers
        }
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
