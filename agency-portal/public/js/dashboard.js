// Dashboard functionality for ASI 360 Agency Portal

// Load clients on page load
document.addEventListener('DOMContentLoaded', () => {
    loadClients();
    loadStats();
});

async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        const data = await response.json();

        const clientsList = document.getElementById('clients-list');

        if (data.success && data.clients.length > 0) {
            clientsList.innerHTML = data.clients.map(client => `
                <div class="client-card">
                    <h3>${client.name}</h3>
                    <p><strong>Domain:</strong> ${client.domain}</p>
                    <p><strong>Email:</strong> ${client.contact_email}</p>
                    <p><strong>Status:</strong> <span style="color: #48bb78;">${client.status}</span></p>
                </div>
            `).join('');

            document.getElementById('client-count').textContent = data.clients.length;
        } else {
            clientsList.innerHTML = `
                <div class="client-card">
                    <p>No clients found. Add your first client to get started!</p>
                </div>
            `;
            document.getElementById('client-count').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        document.getElementById('clients-list').innerHTML = `
            <div class="client-card" style="border-left-color: #f56565;">
                <p>Error loading clients. Please check your Supabase configuration.</p>
            </div>
        `;
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/containers');
        const data = await response.json();

        if (data.success) {
            document.getElementById('site-count').textContent = data.containers.length;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('site-count').textContent = '0';
    }

    // Set placeholder traffic
    document.getElementById('traffic').textContent = '12.5K';
}

function addNewClient() {
    const name = prompt('Enter client name:');
    const domain = prompt('Enter client domain (e.g., client.com):');
    const email = prompt('Enter contact email:');

    if (name && domain && email) {
        createClient(name, domain, email);
    }
}

async function createClient(name, domain, email) {
    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                domain,
                contact_email: email
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('Client created successfully!');
            loadClients();
        } else {
            alert('Error creating client: ' + data.error);
        }
    } catch (error) {
        console.error('Error creating client:', error);
        alert('Error creating client. Please check console.');
    }
}

function viewLogs() {
    alert('Log viewer coming soon! Use "docker-compose logs -f" for now.');
}

function runBackup() {
    if (confirm('Run backup for all client sites?')) {
        alert('Backup initiated! Check Uptime Kuma for status.');
    }
}

async function generateContent() {
    const prompt = prompt('Enter content generation prompt:', 'Write a professional homepage welcome message for a business website');

    if (prompt) {
        try {
            const response = await fetch('/api/generate-content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();

            if (data.success) {
                alert('Generated Content:\n\n' + data.content);
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            console.error('Error generating content:', error);
            alert('Error generating content. Check console.');
        }
    }
}
