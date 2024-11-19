// State management
const state = {
    isLoading: false,
    currentView: 'home',
    retryAttempts: 0,
    maxRetries: 3,
    timeoutDuration: 10000, // 10 seconds
    debounceTimeout: null
};

document.addEventListener('DOMContentLoaded', async function() {
    // Cache DOM elements
    const elements = {
        writeButton: document.getElementById('write-button'),
        readButton: document.getElementById('read-button'),
        passwordProtection: document.getElementById('password-protection'),
        writePassword: document.getElementById('write-password'),
        readPassword: document.getElementById('read-password'),
        autographForm: document.getElementById('autograph-form'),
        autographDisplay: document.getElementById('autograph-display'),
        submitWritePassword: document.getElementById('submit-write-password'),
        submitReadPassword: document.getElementById('submit-read-password'),
        writePasswordInput: document.getElementById('write-password-input'),
        readPasswordInput: document.getElementById('read-password-input'),
        writePasswordError: document.getElementById('write-password-error'),
        readPasswordError: document.getElementById('read-password-error'),
        entryForm: document.getElementById('entry-form'),
        nameInput: document.getElementById('name-input'),
        messageInput: document.getElementById('message-input'),
        clearSignatureButton: document.getElementById('clear-signature'),
        entriesContainer: document.getElementById('entries-container'),
        loadingSpinner: document.getElementById('loading-spinner'),
        entriesLoading: document.getElementById('entries-loading'),
        entriesError: document.getElementById('entries-error')
    };

    let signaturePad;

    // Initialize signature pad with error handling
    function initSignaturePad() {
        try {
            const canvas = document.getElementById('signature-pad');
            if (!canvas) throw new Error('Signature pad canvas not found');
            
            // Ensure proper canvas size
            const container = canvas.parentElement;
            canvas.width = container.offsetWidth;
            canvas.height = container.offsetHeight;
            
            signaturePad = new SignaturePad(canvas, {
                minWidth: 1,
                maxWidth: 2.5,
                throttle: 16 // 60fps
            });
            
            return true;
        } catch (error) {
            console.error('Failed to initialize signature pad:', error);
            showError('Failed to initialize signature pad. Please refresh the page.');
            return false;
        }
    }

    // Error handling utilities
    function showError(message, element = null) {
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
        } else {
            alert(message);
        }
    }

    function hideError(element) {
        if (element) {
            element.classList.add('hidden');
        }
    }

    // Loading state management
    function setLoading(isLoading) {
        state.isLoading = isLoading;
        elements.loadingSpinner.classList.toggle('hidden', !isLoading);
        toggleButtons(isLoading);
    }

    function toggleButtons(disabled) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => button.disabled = disabled);
    }

    // Event listeners with debouncing
    elements.writeButton.addEventListener('click', () => {
        if (state.isLoading) return;
        setView('writePassword');
    });

    elements.readButton.addEventListener('click', () => {
        if (state.isLoading) return;
        setView('readPassword');
    });

    // Password verification with retry mechanism
    async function verifyPassword(password, type) {
        setLoading(true);
        let attempts = 0;

        while (attempts < state.maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), state.timeoutDuration);

                const response = await fetch('/api/verify-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, type }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setLoading(false);
                return data.isCorrect;

            } catch (error) {
                attempts++;
                console.error(`Attempt ${attempts} failed:`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }

        setLoading(false);
        showError('Failed to verify password after multiple attempts');
        return false;
    }

    // Submit handlers with validation
    elements.submitWritePassword.addEventListener('click', async function() {
        if (state.isLoading) return;
        
        const password = elements.writePasswordInput.value.trim();
        if (!password) {
            showError('Please enter a password', elements.writePasswordError);
            return;
        }

        const isCorrect = await verifyPassword(password, 'write');
        if (isCorrect) {
            hideError(elements.writePasswordError);
            setView('write');
            if (!initSignaturePad()) {
                setView('home');
            }
        } else {
            showError('Invalid password', elements.writePasswordError);
        }
    });

    elements.submitReadPassword.addEventListener('click', async function() {
        if (state.isLoading) return;
        
        const password = elements.readPasswordInput.value.trim();
        if (!password) {
            showError('Please enter a password', elements.readPasswordError);
            return;
        }

        const isCorrect = await verifyPassword(password, 'read');
        if (isCorrect) {
            hideError(elements.readPasswordError);
            setView('read');
            await loadEntries(password);
        } else {
            showError('Invalid password', elements.readPasswordError);
        }
    });

    // Form submission with validation and optimizations
    elements.entryForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (state.isLoading) return;

        const name = elements.nameInput.value.trim();
        const message = elements.messageInput.value.trim();

        // Validation
        if (!name || !message || signaturePad.isEmpty()) {
            showError('Please fill in all fields and sign');
            return;
        }

        setLoading(true);

        try {
            const signature = signaturePad.toDataURL('image/png', 0.5); // Compress signature
            const entry = {
                name,
                message,
                signature,
                date: new Date().toISOString()
            };

            const response = await fetch('/api/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: elements.writePasswordInput.value, entry })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.success) {
                resetForm();
                showError('Autograph saved successfully!');
                setView('home');
            } else {
                throw new Error('Failed to save entry');
            }
        } catch (error) {
            console.error('Error saving entry:', error);
            showError('Failed to save autograph. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    // Clear signature with confirmation
    elements.clearSignatureButton.addEventListener('click', function() {
        if (signaturePad && !signaturePad.isEmpty()) {
            if (confirm('Are you sure you want to clear your signature?')) {
                signaturePad.clear();
            }
        }
    });

    // Optimized entry loading
    async function loadEntries(password) {
        elements.entriesLoading.classList.remove('hidden');
        elements.entriesError.classList.add('hidden');
        elements.entriesContainer.innerHTML = '';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), state.timeoutDuration);

            const response = await fetch(
                `/api/entries?password=${encodeURIComponent(password)}`,
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const entries = await response.json();
            
            // Batch DOM updates
            const fragment = document.createDocumentFragment();
            entries.forEach(entry => {
                fragment.appendChild(createEntryElement(entry));
            });
            
            elements.entriesContainer.appendChild(fragment);

        } catch (error) {
            console.error('Error loading entries:', error);
            elements.entriesError.classList.remove('hidden');
        } finally {
            elements.entriesLoading.classList.add('hidden');
        }
    }

    // Optimized entry element creation
    function createEntryElement(entry) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'autograph-card bg-white p-4 rounded-lg shadow';
        
        // Use sanitized content
        const sanitizedName = escape(entry.name);
        const sanitizedMessage = escape(entry.message);
        const sanitizedDate = new Date(entry.date).toLocaleString();

        entryDiv.innerHTML = `
            <h3 class="text-xl font-bold">${sanitizedName}</h3>
            <p class="mt-2">${sanitizedMessage}</p>
            <img src="${entry.signature}" alt="Signature" class="mt-2 max-w-full h-auto">
            <p class="text-sm text-gray-500 mt-2">Signed on: ${sanitizedDate}</p>
        `;
        
        return entryDiv;
    }

    // View management
    function setView(view) {
        const views = {
            home: elements.passwordProtection,
            writePassword: elements.writePassword,
            readPassword: elements.readPassword,
            write: elements.autographForm,
            read: elements.autographDisplay
        };

        // Hide all views
        Object.values(views).forEach(element => element.classList.add('hidden'));

        // Show requested view
        if (views[view]) {
            views[view].classList.remove('hidden');
            state.currentView = view;
        }
    }

    // Form reset utility
    function resetForm() {
        elements.nameInput.value = '';
        elements.messageInput.value = '';
        if (signaturePad) signaturePad.clear();
    }

    // Initialize
    setView('home');

    // Handle window resize for signature pad
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.currentView === 'write') {
                initSignaturePad();
            }
        }, 250);
    });
});
