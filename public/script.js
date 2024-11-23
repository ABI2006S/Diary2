// Global error handler
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Client error:', { msg, url, lineNo, columnNo, error });
    showError('An error occurred. Please refresh the page.');
    return false;
};

// State management
let currentView = 'home';
let signaturePad = null;
let isLoading = false;

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check server health
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error('Server health check failed');
        
        setView('home');
        initializeEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application. Please refresh the page.');
    }
});

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, 5000);
}

function setLoading(loading) {
    isLoading = loading;
    const spinner = document.getElementById('loading-spinner');
    if (loading) {
        spinner.classList.remove('hidden');
    } else {
        spinner.classList.add('hidden');
    }
}

function setView(view) {
    const views = ['home', 'password', 'write', 'read'];
    views.forEach(v => {
        const element = document.getElementById(`${v}-view`);
        if (element) {
            element.classList.add('hidden');
        }
    });

    const currentElement = document.getElementById(`${view}-view`);
    if (currentElement) {
        currentElement.classList.remove('hidden');
        currentView = view;

        if (view === 'write') {
            initSignaturePad();
        }
    }
}

function initializeEventListeners() {
    document.getElementById('write-button').addEventListener('click', () => setView('writePassword'));
    document.getElementById('read-button').addEventListener('click', () => setView('readPassword'));
    document.getElementById('submit-write-password').addEventListener('click', () => handlePasswordSubmit('write'));
    document.getElementById('submit-read-password').addEventListener('click', () => handlePasswordSubmit('read'));
    document.getElementById('entry-form').addEventListener('submit', handleEntrySubmit);
    document.getElementById('clear-signature').addEventListener('click', clearSignature);
}

function initSignaturePad() {
    try {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return;

        const parent = canvas.parentElement;
        canvas.width = parent.offsetWidth;
        canvas.height = 200;

        signaturePad = new SignaturePad(canvas, {
            minWidth: 1,
            maxWidth: 2.5
        });
    } catch (error) {
        console.error('Failed to initialize signature pad:', error);
        showError('Failed to initialize signature pad');
    }
}

async function handlePasswordSubmit(type) {
    if (isLoading) return;

    const passwordInput = document.getElementById(`${type}-password-input`);
    const password = passwordInput.value.trim();

    if (!password) {
        showError('Please enter a password');
        return;
    }

    try {
        setLoading(true);
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, type })
        });

        const data = await response.json();
        
        if (data.success && data.isCorrect) {
            passwordInput.value = '';
            setView(type);
            if (type === 'read') {
                await loadEntries(password);
            }
        } else {
            showError('Invalid password');
        }
    } catch (error) {
        console.error('Password verification error:', error);
        showError('Failed to verify password');
    } finally {
        setLoading(false);
    }
}

async function handleEntrySubmit(event) {
    event.preventDefault();
    if (isLoading) return;

    const nameInput = document.getElementById('name-input');
    const messageInput = document.getElementById('message-input');

    if (!nameInput.value.trim() || !messageInput.value.trim() || !signaturePad || signaturePad.isEmpty()) {
        showError('Please fill all fields and sign');
        return;
    }

    try {
        setLoading(true);
        const entry = {
            name: nameInput.value.trim(),
            message: messageInput.value.trim(),
            signature: signaturePad.toDataURL(),
            date: new Date().toISOString()
        };

        const response = await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: document.getElementById('write-password-input').value,
                entry
            })
        });

        const data = await response.json();
        
        if (data.success) {
            nameInput.value = '';
            messageInput.value = '';
            signaturePad.clear();
            setView('home');
            showError('Entry saved successfully!');
        } else {
            throw new Error(data.message || 'Failed to save entry');
        }
    } catch (error) {
        console.error('Entry submission error:', error);
        showError('Failed to save entry');
    } finally {
        setLoading(false);
    }
}

function clearSignature() {
    if (signaturePad && !signaturePad.isEmpty()) {
        signaturePad.clear();
    }
}

async function loadEntries(password) {
    if (isLoading) return;

    try {
        setLoading(true);
        const response = await fetch(`/api/entries?password=${encodeURIComponent(password)}`);
        const entries = await response.json();

        const container = document.getElementById('entries-container');
        container.innerHTML = '';

        if (entries.length === 0) {
            container.innerHTML = '<p class="no-entries">No entries found</p>';
            return;
        }

        entries.forEach(entry => {
            const entryElement = document.createElement('div');
            entryElement.className = 'entry';
            entryElement.innerHTML = `
                <h3>${escapeHtml(entry.name)}</h3>
                <p>${escapeHtml(entry.message)}</p>
                <img src="${entry.signature}" alt="Signature" class="signature">
                <p class="date">Signed on: ${new Date(entry.date).toLocaleString()}</p>
            `;
            container.appendChild(entryElement);
        });
    } catch (error) {
        console.error('Error loading entries:', error);
        showError('Failed to load entries');
    } finally {
        setLoading(false);
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Handle window resize for signature pad
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (currentView === 'write') {
            initSignaturePad();
        }
    }, 250);
});
