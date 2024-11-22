let currentView = 'home';
let signaturePad;

function setView(view) {
    // Hide all views
    ['home', 'password', 'write', 'read'].forEach(v => {
        document.getElementById(`${v}-view`).style.display = 'none';
    });

    // Show requested view
    document.getElementById(`${view}-view`).style.display = 'block';
    currentView = view;

    // Update password view title if needed
    if (view === 'writePassword') {
        document.getElementById('password-title').textContent = 'Enter Write Password 🙃';
    } else if (view === 'readPassword') {
        document.getElementById('password-title').textContent = 'Enter Read Password 😉';
    }

    // Initialize signature pad if needed
    if (view === 'write' && !signaturePad) {
        initSignaturePad();
    }
}

function initSignaturePad() {
    try {
        const canvas = document.getElementById('signature-pad');
        if (!canvas) return;
        
        // Set canvas size
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = 200; // Fixed height
        
        signaturePad = new SignaturePad(canvas, {
            minWidth: 1,
            maxWidth: 2.5,
            throttle: 16
        });
    } catch (error) {
        console.error('Failed to initialize signature pad:', error);
        alert('Failed to initialize signature pad. Please refresh the page.');
    }
}

async function handlePasswordSubmit() {
    const passwordInput = document.getElementById('password-input');
    const errorElement = document.getElementById('password-error');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    const password = passwordInput.value.trim();
    const type = currentView === 'writePassword' ? 'write' : 'read';

    if (!password) {
        showError('Please enter a password', errorElement);
        return;
    }

    try {
        loadingSpinner.classList.remove('hidden');
        
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, type })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to verify password');
        }

        if (data.isCorrect) {
            passwordInput.value = '';
            errorElement.classList.add('hidden');
            setView(type);
            
            if (type === 'read') {
                await displayEntries(password);
            }
        } else {
            showError('Incorrect password', errorElement);
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'An error occurred. Please try again.', errorElement);
    } finally {
        loadingSpinner.classList.add('hidden');
    }
}

function showError(message, element) {
    if (element) {
        element.textContent = message;
        element.classList.remove('hidden');
        element.classList.add('error-shake');
        setTimeout(() => element.classList.remove('error-shake'), 500);
    } else {
        alert(message);
    }
}

async function handleEntrySubmit() {
    const nameInput = document.getElementById('name-input');
    const messageInput = document.getElementById('message-input');
    const errorElement = document.getElementById('write-error');
    const loadingSpinner = document.getElementById('loading-spinner');

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !message || (signaturePad && signaturePad.isEmpty())) {
        showError('Please fill all fields and sign', errorElement);
        return;
    }

    try {
        loadingSpinner.classList.remove('hidden');

        const newEntry = {
            name,
            message,
            signature: signaturePad.toDataURL(),
            date: new Date().toISOString()
        };

        const response = await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: document.getElementById('password-input').value,
                entry: newEntry
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to save entry');
        }

        if (data.success) {
            nameInput.value = '';
            messageInput.value = '';
            signaturePad.clear();
            setView('home');
            showError('Autograph saved successfully!');
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Failed to save entry. Please try again.', errorElement);
    } finally {
        loadingSpinner.classList.add('hidden');
    }
}

function clearSignature() {
    if (signaturePad && !signaturePad.isEmpty()) {
        if (confirm('Are you sure you want to clear your signature?')) {
            signaturePad.clear();
        }
    }
}

async function displayEntries(password) {
    const entriesContainer = document.getElementById('entries-container');
    const loadingElement = document.getElementById('entries-loading');
    const errorElement = document.getElementById('entries-error');

    try {
        loadingElement.classList.remove('hidden');
        errorElement.classList.add('hidden');
        entriesContainer.innerHTML = '';

        const response = await fetch(`/api/entries?password=${encodeURIComponent(password)}`);
        
        if (!response.ok) {
            throw new Error('Failed to load entries');
        }

        const entries = await response.json();

        if (entries.length === 0) {
            entriesContainer.innerHTML = '<p class="text-center text-gray-500">No entries yet</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        entries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry bg-white p-4 rounded-lg shadow-md mb-4';
            entryDiv.innerHTML = `
                <h3 class="text-xl font-bold">${escapeHtml(entry.name)}</h3>
                <p class="mt-2">${escapeHtml(entry.message)}</p>
                <img src="${entry.signature}" alt="Signature" class="mt-2 max-w-full h-auto">
                <p class="text-sm text-gray-500 mt-2">
                    Signed on: ${new Date(entry.date).toLocaleString()}
                </p>
            `;
            fragment.appendChild(entryDiv);
        });

        entriesContainer.appendChild(fragment);
    } catch (error) {
        console.error('Error:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('hidden');
    } finally {
        loadingElement.classList.add('hidden');
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

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    setView('home');
    
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
});
