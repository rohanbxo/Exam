const API_BASE = '';

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const viewContainers = document.querySelectorAll('.view-container');
const currentViewName = document.getElementById('current-view-name');

const viewNames = {
    'upload': 'Upload Files',
    'web': 'Web Import',
    'chat': 'Q&A Chat',
    'summary': 'Summarize'
};

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const viewId = item.dataset.view;
        switchView(viewId);
    });
});

function switchView(viewId) {
    navItems.forEach(n => n.classList.remove('active'));
    viewContainers.forEach(v => v.classList.remove('active'));

    const activeNav = document.querySelector(`[data-view="${viewId}"]`);
    const activeView = document.getElementById(`view-${viewId}`);

    if (activeNav) activeNav.classList.add('active');
    if (activeView) activeView.classList.add('active');
    if (currentViewName) currentViewName.textContent = viewNames[viewId] || viewId;
}

// File Upload
const fileInput = document.getElementById('file-input');
const dropZone = document.querySelector('.drop-zone');
const dropZoneTitle = document.getElementById('drop-zone-title');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name-display');
const fileSizeDisplay = document.getElementById('file-size-display');
const uploadForm = document.getElementById('upload-form');
const uploadResult = document.getElementById('upload-result');

fileInput.addEventListener('change', handleFileSelect);

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        fileNameDisplay.textContent = file.name;
        fileSizeDisplay.textContent = formatFileSize(file.size);
        dropZoneTitle.textContent = 'File selected';
        fileInfo.style.display = 'flex';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];

    if (!file) {
        showResult(uploadResult, 'Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span><span>Uploading...</span>';

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showResult(uploadResult, data.message, 'success');
            fileInput.value = '';
            fileInfo.style.display = 'none';
            dropZoneTitle.textContent = 'Drop your PDF here';
            await updateStatus();
        } else {
            showResult(uploadResult, data.detail || 'Upload failed', 'error');
        }
    } catch (error) {
        showResult(uploadResult, `Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Web Scrape
const scrapeForm = document.getElementById('scrape-form');
const scrapeResult = document.getElementById('scrape-result');

scrapeForm.addEventListener('submit', async (e) => {
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
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (response.ok) {
            showResult(scrapeResult, data.message, 'success');
            document.getElementById('url-input').value = '';
            await updateStatus();
        } else {
            showResult(scrapeResult, data.detail || 'Scraping failed', 'error');
        }
    } catch (error) {
        showResult(scrapeResult, `Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Chat
const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const questionInput = document.getElementById('question-input');

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();

    if (!question) return;

    const emptyState = chatMessages.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    addMessage(question, 'user');
    questionInput.value = '';

    const assistantMessage = addMessage('', 'assistant');
    const messageContent = assistantMessage.querySelector('.message-content');

    const submitBtn = chatForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/stream_query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
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
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);

                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.token) {
                            fullAnswer += parsed.token;
                            messageContent.textContent = fullAnswer;
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } else if (parsed.final_answer) {
                            messageContent.textContent = parsed.final_answer;

                            if (parsed.sources && parsed.sources.length > 0) {
                                const sourcesDiv = document.createElement('div');
                                sourcesDiv.className = 'message-sources';
                                sourcesDiv.innerHTML = '<strong>📚 Sources:</strong>';

                                parsed.sources.forEach((source, idx) => {
                                    const sourceItem = document.createElement('div');
                                    sourceItem.className = 'source-item';
                                    sourceItem.innerHTML = `
                                        <strong>${idx + 1}. ${source.file_name}</strong>
                                        <p>${source.text}...</p>
                                    `;
                                    sourcesDiv.appendChild(sourceItem);
                                });

                                assistantMessage.querySelector('.message-bubble').appendChild(sourcesDiv);
                            }
                        } else if (parsed.error) {
                            messageContent.textContent = `Error: ${parsed.error}`;
                        }
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
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

// Summary
const summarizeForm = document.getElementById('summarize-form');
const summaryResult = document.getElementById('summary-result');
const lengthSlider = document.getElementById('max-length');
const lengthDisplay = document.getElementById('length-display');

lengthSlider.addEventListener('input', (e) => {
    lengthDisplay.textContent = e.target.value;
});

summarizeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const maxLength = parseInt(lengthSlider.value);

    const submitBtn = summarizeForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span><span>Generating...</span>';

    showResult(summaryResult, 'Generating summary...', 'info');

    try {
        const response = await fetch(`${API_BASE}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_length: maxLength })
        });

        const data = await response.json();

        if (response.ok) {
            const result = `
                <h3>📄 Summary (${data.word_count} words)</h3>
                <p>${data.summary}</p>
                <p style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--text-secondary);">
                    <strong>Sources:</strong> ${data.source_documents.join(', ')}
                </p>
            `;
            summaryResult.innerHTML = result;
            summaryResult.classList.add('show', 'success');
        } else {
            showResult(summaryResult, data.detail || 'Summarization failed', 'error');
        }
    } catch (error) {
        showResult(summaryResult, `Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// Reset
const resetBtn = document.getElementById('reset-btn-sidebar');

resetBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset all documents? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/reset`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            chatMessages.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <h3>Start a Conversation</h3>
                    <p>Ask me anything about your indexed documents</p>
                </div>
            `;
            clearAllResults();
            await updateStatus();
        } else {
            alert(data.detail || 'Reset failed');
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

// Helper Functions
function showResult(element, message, type) {
    element.innerHTML = message;
    element.className = `result-message show ${type}`;
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

function clearAllResults() {
    uploadResult.classList.remove('show');
    scrapeResult.classList.remove('show');
    summaryResult.classList.remove('show');
}

async function updateStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const data = await response.json();

        if (data.details) {
            const count = data.details.document_count || 0;
            const docCountSidebar = document.getElementById('doc-count-sidebar');
            if (docCountSidebar) {
                docCountSidebar.textContent = count;
            }

            const statusPulse = document.getElementById('status-pulse');
            const statusTextSidebar = document.getElementById('status-text-sidebar');
            const statusTextTop = document.getElementById('status-text-top');

            if (data.details.has_documents) {
                if (statusPulse) statusPulse.style.background = 'var(--success)';
                if (statusTextSidebar) statusTextSidebar.textContent = 'Ready';
                if (statusTextTop) statusTextTop.textContent = 'System Ready';
            } else {
                if (statusPulse) statusPulse.style.background = 'var(--text-light)';
                if (statusTextSidebar) statusTextSidebar.textContent = 'No Docs';
                if (statusTextTop) statusTextTop.textContent = 'No Documents';
            }
        }
    } catch (error) {
        console.error('Status update failed:', error);
        const statusPulse = document.getElementById('status-pulse');
        const statusTextTop = document.getElementById('status-text-top');
        if (statusPulse) statusPulse.style.background = 'var(--danger)';
        if (statusTextTop) statusTextTop.textContent = 'Connection Error';
    }
}

// Initial status update
updateStatus();
setInterval(updateStatus, 30000);
