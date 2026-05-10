const API_BASE = '';

const SESSION_KEY = 'studyson:session_id';
function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(SESSION_KEY, id);
    }
    return id;
}

function renderMarkdown(text) {
    if (window.marked && window.DOMPurify) {
        const html = window.marked.parse(text, { breaks: true, gfm: true });
        return window.DOMPurify.sanitize(html);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

const toastContainer = document.getElementById('toast-container');
function toast(message, type = 'info', duration = 4000) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, duration);
}

const navItems = document.querySelectorAll('.nav-item');
const viewContainers = document.querySelectorAll('.view-container');
const currentViewName = document.getElementById('current-view-name');

const viewNames = {
    upload: 'Upload Files',
    web: 'Web Import',
    chat: 'Q&A Chat',
    summary: 'Summarize',
};

navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
});

function switchView(viewId) {
    navItems.forEach(n => n.classList.remove('active'));
    viewContainers.forEach(v => v.classList.remove('active'));
    document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');
    document.getElementById(`view-${viewId}`)?.classList.add('active');
    if (currentViewName) currentViewName.textContent = viewNames[viewId] || viewId;
}

const fileInput = document.getElementById('file-input');
const dropZone = document.querySelector('.drop-zone');
const dropZoneTitle = document.getElementById('drop-zone-title');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name-display');
const fileSizeDisplay = document.getElementById('file-size-display');
const uploadForm = document.getElementById('upload-form');
const uploadResult = document.getElementById('upload-result');

fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

['dragover', 'dragenter'].forEach(ev =>
    dropZone.addEventListener(ev, e => {
        e.preventDefault();
        dropZone.classList.add('dragging');
    })
);
['dragleave', 'drop'].forEach(ev =>
    dropZone.addEventListener(ev, e => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
    })
);
dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        handleFile(file);
    }
});

function handleFile(file) {
    if (!file) return;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatFileSize(file.size);
    dropZoneTitle.textContent = 'File selected';
    fileInfo.style.display = 'flex';
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

uploadForm.addEventListener('submit', async e => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
        toast('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span><span>Uploading...</span>';

    try {
        const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) {
            showResult(uploadResult, data.message, 'success');
            toast(data.message, 'success');
            fileInput.value = '';
            fileInfo.style.display = 'none';
            dropZoneTitle.textContent = 'Drop your file here';
            await updateStatus();
        } else {
            showResult(uploadResult, data.detail || 'Upload failed', 'error');
            toast(data.detail || 'Upload failed', 'error');
        }
    } catch (error) {
        showResult(uploadResult, `Error: ${error.message}`, 'error');
        toast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

const scrapeForm = document.getElementById('scrape-form');
const scrapeResult = document.getElementById('scrape-result');

scrapeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const url = document.getElementById('url-input').value;
    const submitBtn = scrapeForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span><span>Fetching...</span>';

    try {
        const response = await fetch(`${API_BASE}/scrape_and_index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, session_id: getSessionId() }),
        });
        const data = await response.json();
        if (response.ok) {
            showResult(scrapeResult, data.message, 'success');
            toast(data.message, 'success');
            document.getElementById('url-input').value = '';
            await updateStatus();
        } else {
            showResult(scrapeResult, data.detail || 'Scraping failed', 'error');
            toast(data.detail || 'Scraping failed', 'error');
        }
    } catch (error) {
        showResult(scrapeResult, `Error: ${error.message}`, 'error');
        toast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const questionInput = document.getElementById('question-input');

chatForm.addEventListener('submit', async e => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;

    chatMessages.querySelector('.empty-state')?.remove();
    addMessage(question, 'user');
    questionInput.value = '';

    const assistantMessage = addMessage('', 'assistant');
    const messageContent = assistantMessage.querySelector('.message-content');
    messageContent.classList.add('markdown-body');

    const submitBtn = chatForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/stream_query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, session_id: getSessionId() }),
        });

        if (!response.ok) {
            const error = await response.json();
            messageContent.textContent = `Error: ${error.detail}`;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullAnswer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.token) {
                        fullAnswer += parsed.token;
                        messageContent.innerHTML = renderMarkdown(fullAnswer);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } else if (parsed.final_answer) {
                        messageContent.innerHTML = renderMarkdown(parsed.final_answer);
                        if (parsed.sources?.length) {
                            const sourcesDiv = document.createElement('div');
                            sourcesDiv.className = 'message-sources';
                            sourcesDiv.innerHTML = '<strong>Sources</strong>';
                            parsed.sources.forEach((source, idx) => {
                                const item = document.createElement('div');
                                item.className = 'source-item';
                                const score = source.score != null ? ` (${source.score.toFixed(3)})` : '';
                                item.innerHTML = `
                                    <strong>${idx + 1}. ${escapeHtml(source.file_name)}${escapeHtml(score)}</strong>
                                    <p>${escapeHtml(source.text)}…</p>`;
                                sourcesDiv.appendChild(item);
                            });
                            assistantMessage.querySelector('.message-bubble').appendChild(sourcesDiv);
                        }
                    } else if (parsed.error) {
                        messageContent.textContent = `Error: ${parsed.error}`;
                    }
                } catch (err) {
                    console.error('Parse error:', err);
                }
            }
        }
    } catch (error) {
        messageContent.textContent = `Error: ${error.message}`;
    } finally {
        submitBtn.disabled = false;
    }
});

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    bubbleDiv.appendChild(contentDiv);
    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

const summarizeForm = document.getElementById('summarize-form');
const summaryResult = document.getElementById('summary-result');
const lengthSlider = document.getElementById('max-length');
const lengthDisplay = document.getElementById('length-display');

lengthSlider.addEventListener('input', e => {
    lengthDisplay.textContent = e.target.value;
});

summarizeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const maxLength = parseInt(lengthSlider.value, 10);

    const submitBtn = summarizeForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span><span>Generating...</span>';

    try {
        const response = await fetch(`${API_BASE}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_length: maxLength }),
        });
        const data = await response.json();
        if (response.ok) {
            const sources = data.source_documents.map(escapeHtml).join(', ');
            summaryResult.innerHTML = `
                <h3>Summary (${data.word_count} words)</h3>
                <div class="markdown-body">${renderMarkdown(data.summary)}</div>
                <p class="summary-sources"><strong>Sources:</strong> ${sources}</p>`;
            summaryResult.classList.add('show', 'success');
        } else {
            showResult(summaryResult, data.detail || 'Summarization failed', 'error');
            toast(data.detail || 'Summarization failed', 'error');
        }
    } catch (error) {
        showResult(summaryResult, `Error: ${error.message}`, 'error');
        toast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

const resetBtn = document.getElementById('reset-btn-sidebar');
resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset all documents? This cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/reset`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            localStorage.removeItem(SESSION_KEY);
            toast(data.message, 'success');
            chatMessages.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><h3>Start a Conversation</h3><p>Ask me anything about your indexed documents</p></div>';
            await updateStatus();
        } else {
            toast(data.detail || 'Reset failed', 'error');
        }
    } catch (error) {
        toast(error.message, 'error');
    }
});

function showResult(element, message, type) {
    element.innerHTML = escapeHtml(message);
    element.className = `result-message show ${type}`;
    setTimeout(() => element.classList.remove('show'), 5000);
}

async function updateStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();
        if (!data.details) return;

        const count = data.details.document_count || 0;
        document.getElementById('doc-count-sidebar')?.replaceChildren(document.createTextNode(count));

        const statusPulse = document.getElementById('status-pulse');
        const statusTextSidebar = document.getElementById('status-text-sidebar');
        const statusTextTop = document.getElementById('status-text-top');

        if (data.details.has_documents) {
            if (statusPulse) statusPulse.style.background = 'var(--success)';
            if (statusTextSidebar) statusTextSidebar.textContent = 'Ready';
            if (statusTextTop) statusTextTop.textContent = `Ready · ${data.details.model || ''}`;
        } else {
            if (statusPulse) statusPulse.style.background = 'var(--text-light)';
            if (statusTextSidebar) statusTextSidebar.textContent = 'No Docs';
            if (statusTextTop) statusTextTop.textContent = 'No Documents';
        }
    } catch (error) {
        console.error('Status update failed:', error);
        const statusPulse = document.getElementById('status-pulse');
        const statusTextTop = document.getElementById('status-text-top');
        if (statusPulse) statusPulse.style.background = 'var(--danger)';
        if (statusTextTop) statusTextTop.textContent = 'Connection Error';
    }
}

getSessionId();
updateStatus();
setInterval(updateStatus, 30000);
