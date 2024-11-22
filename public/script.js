let currentView = 'home';
let signaturePad;

function setView(view) {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('password-view').style.display = 'none';
    document.getElementById('write-view').style.display = 'none';
    document.getElementById('read-view').style.display = 'none';

    document.getElementById(`${view}-view`).style.display = 'block';
    currentView = view;

    if (view === 'writePassword') {
        document.getElementById('password-title').textContent = 'password pareyy🙃';
    } else if (view === 'readPassword') {
        document.getElementById('password-title').textContent = 'Vayikanel password para😉🤌🏻';
    }

    if (view === 'write' && !signaturePad) {
        const canvas = document.getElementById('signature-pad');
        signaturePad = new SignaturePad(canvas);
    }
}

async function handlePasswordSubmit() {
    const password = document.getElementById('password-input').value;
    const type = currentView === 'writePassword' ? 'write' : 'read';

    try {
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, type })
        });
        const data = await response.json();

        if (data.isCorrect) {
            setView(type);
            if (type === 'read') {
                await displayEntries(password);
            }
        } else {
            alert('Incorrect password');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    }

    document.getElementById('password-input').value = '';
}

async function handleEntrySubmit() {
    const name = document.getElementById('name-input').value;
    const message = document.getElementById('message-input').value;
    const password = document.getElementById('password-input').value;

    if (name && message && !signaturePad.isEmpty()) {
        const newEntry = {
            name: name,
            message: message,
            signature: signaturePad.toDataURL(),
            date: new Date().toLocaleString()
        };

        try {
            const response = await fetch('/api/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, entry: newEntry })
            });
            const data = await response.json();

            if (data.success) {
                document.getElementById('name-input').value = '';
                document.getElementById('message-input').value = '';
                signaturePad.clear();
                alert('Autograph saved successfully!');
            } else {
                alert('Failed to save entry. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        }
    } else {
        alert('Please fill all fields and sign');
    }
}

function clearSignature() {
    if (signaturePad) {
        signaturePad.clear();
    }
}

async function displayEntries(password) {
    try {
        const response = await fetch('/api/read-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const entries = await response.json();

        const entriesContainer = document.getElementById('entries-container');
        entriesContainer.innerHTML = '';

        entries.forEach((entry) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry';
            entryDiv.innerHTML = `
                <h3>${entry.name}</h3>
                <p>${entry.message}</p>
                <img src="${entry.signature}" alt="Signature">
                <p class="date">Date: ${entry.date}</p>
            `;
            entriesContainer.appendChild(entryDiv);
        });
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load entries. Please try again.');
    }
}

window.onload = function() {
    setView('home');
};
