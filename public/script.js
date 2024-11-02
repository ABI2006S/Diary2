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

    let signaturePad;

    function initSignaturePad() {
        const canvas = document.getElementById('signature-pad');
        signaturePad = new SignaturePad(canvas);
    }

    writeButton.addEventListener('click', function() {
        passwordProtection.classList.add('hidden');
        writePassword.classList.remove('hidden');
    });

    readButton.addEventListener('click', function() {
        passwordProtection.classList.add('hidden');
        readPassword.classList.remove('hidden');
    });

    submitWritePassword.addEventListener('click', async function() {
        const password = writePasswordInput.value;
        const isCorrect = await verifyPassword(password, 'write');
        if (isCorrect) {
            writePassword.classList.add('hidden');
            autographForm.classList.remove('hidden');
            writePasswordError.classList.add('hidden');
            initSignaturePad();
        } else {
            writePasswordError.classList.remove('hidden');
        }
    });

    submitReadPassword.addEventListener('click', async function() {
        const password = readPasswordInput.value;
        const isCorrect = await verifyPassword(password, 'read');
        if (isCorrect) {
            readPassword.classList.add('hidden');
            autographDisplay.classList.remove('hidden');
            readPasswordError.classList.add('hidden');
            await loadEntries(password);
        } else {
            readPasswordError.classList.remove('hidden');
        }
    });

    entryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
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
    });

    clearSignatureButton.addEventListener('click', function() {
        if (signaturePad) {
            signaturePad.clear();
        }
    });

    async function verifyPassword(password, type) {
        try {
            const response = await fetch('/api/verify-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password, type }),
            });
            const data = await response.json();
            return data.isCorrect;
        } catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }

    async function saveEntry(password, entry) {
        try {
            const response = await fetch('/api/entries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password, entry }),
            });
            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error saving entry:', error);
            return false;
        }
    }

    async function loadEntries(password) {
        try {
            const response = await fetch(`/api/entries?password=${encodeURIComponent(password)}`);
            const entries = await response.json();
            displayEntries(entries);
        } catch (error) {
            console.error('Error loading entries:', error);
            alert('Failed to load entries. Please try again.');
        }
    }

    function displayEntries(entries) {
        entriesContainer.innerHTML = '';
        entries.forEach((entry) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'autograph-card bg-white p-4 rounded-lg shadow';
            entryDiv.innerHTML = `
                <h3 class="text-xl font-bold">${entry.name}</h3>
                <p class="mt-2">${entry.message}</p>
                <img src="${entry.signature}" alt="${entry.name}'s signature" class="mt-2 max-w-full h-auto">
                <p class="text-sm text-gray-500 mt-2">Signed on: ${entry.date}</p>
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
            case 'write':
                autographForm.classList.remove('hidden');
                break;
            case 'read':
                autographDisplay.classList.remove('hidden');
                break;
        }
    }

    // Initialize the view
    setView('home');
});