document.addEventListener('DOMContentLoaded', function() {
    const writeButton = document.getElementById('write-button');
    const readButton = document.getElementById('read-button');
    const passwordProtection = document.getElementById('password-protection');
    const writePassword = document.getElementById('write-password');
    const readPassword = document.getElementById('read-password');
    const autographForm = document.getElementById('autograph-form');
    const autographDisplay = document.getElementById('autograph-display');
    const submitWritePassword = document.getElementById('submit-write-password');
    const submitReadPassword = document.getElementById('submit-read-password');
    const writePasswordInput = document.getElementById('write-password-input');
    const readPasswordInput = document.getElementById('read-password-input');
    const writePasswordError = document.getElementById('write-password-error');
    const readPasswordError = document.getElementById('read-password-error');
    const entryForm = document.getElementById('entry-form');
    const nameInput = document.getElementById('name-input');
    const messageInput = document.getElementById('message-input');
    const clearSignatureButton = document.getElementById('clear-signature');
    const entriesContainer = document.getElementById('entries-container');
    const loadingIndicator = document.getElementById('loading-indicator');

    let signaturePad;

    function initSignaturePad() {
        const canvas = document.getElementById('signature-pad');
        signaturePad = new SignaturePad(canvas);
    }

    function showLoading() {
        loadingIndicator.classList.remove('hidden');
    }

    function hideLoading() {
        loadingIndicator.classList.add('hidden');
    }

    writeButton.addEventListener('click', () => setView('writePassword'));
    readButton.addEventListener('click', () => setView('readPassword'));

    submitWritePassword.addEventListener('click', async function() {
        showLoading();
        const password = writePasswordInput.value;
        try {
            const isCorrect = await verifyPassword(password, 'write');
            if (isCorrect) {
                setView('write');
                writePasswordError.classList.add('hidden');
                initSignaturePad();
            } else {
                writePasswordError.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            alert('An error occurred. Please try again.');
        } finally {
            hideLoading();
        }
    });

    submitReadPassword.addEventListener('click', async function() {
        showLoading();
        const password = readPasswordInput.value;
        try {
            const isCorrect = await verifyPassword(password, 'read');
            if (isCorrect) {
                setView('read');
                readPasswordError.classList.add('hidden');
                await loadEntries(password);
            } else {
                readPasswordError.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            alert('An error occurred. Please try again.');
        } finally {
            hideLoading();
        }
    });

    entryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        showLoading();
        const name = nameInput.value;
        const message = messageInput.value;
        const signature = signaturePad.toDataURL();

        const entry = {
            name: name,
            message: message,
            signature: signature,
            date: new Date().toLocaleString()
        };

        const password = writePasswordInput.value;
        try {
            const success = await saveEntry(password, entry);
            if (success) {
                alert('Autograph saved successfully!');
                nameInput.value = '';
                messageInput.value = '';
                signaturePad.clear();
                setView('home');
            } else {
                alert('Failed to save autograph. Please try again.');
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            alert('An error occurred. Please try again.');
        } finally {
            hideLoading();
        }
    });

    clearSignatureButton.addEventListener('click', function() {
        if (signaturePad) {
            signaturePad.clear();
        }
    });

    async function verifyPassword(password, type) {
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password, type }),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.isCorrect;
    }

    async function saveEntry(password, entry) {
        const response = await fetch('/api/entries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password, entry }),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.success;
    }

    async function loadEntries(password) {
        showLoading();
        try {
            const response = await fetch(`/api/entries?password=${encodeURIComponent(password)}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const entries = await response.json();
            displayEntries(entries);
        } catch (error) {
            console.error('Error loading entries:', error);
            alert('Failed to load entries. Please try again.');
        } finally {
            hideLoading();
        }
    }

    function displayEntries(entries) {
        entriesContainer.innerHTML = '';
        entries.forEach((entry) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'autograph-card bg-white p-4 rounded-lg shadow';
            entryDiv.innerHTML = `
                <h3 class="text-xl font-bold">${escapeHtml(entry.name)}</h3>
                <p class="mt-2">${escapeHtml(entry.message)}</p>
                <img src="${entry.signature}" alt="${escapeHtml(entry.name)}'s signature" class="mt-2 max-w-full h-auto">
                <p class="text-sm text-gray-500 mt-2">Signed on: ${escapeHtml(entry.date)}</p>
            `;
            entriesContainer.appendChild(entryDiv);
        });
    }

    function setView(view) {
        passwordProtection.classList.add('hidden');
        writePassword.classList.add('hidden');
        readPassword.classList.add('hidden');
        autographForm.classList.add('hidden');
        autographDisplay.classList.add('hidden');

        switch (view) {
            case 'home':
                passwordProtection.classList.remove('hidden');
                break;
            case 'writePassword':
                writePassword.classList.remove('hidden');
                break;
            case 'readPassword':
                readPassword.classList.remove('hidden');
                break;
            case 'write':
                autographForm.classList.remove('hidden');
                break;
            case 'read':
                autographDisplay.classList.remove('hidden');
                break;
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

    // Initialize the view
    setView('home');
});
