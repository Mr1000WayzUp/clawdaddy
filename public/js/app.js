// API Base URL
const API_URL = window.location.origin + '/api';

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        // Load data for the tab
        if (tabName === 'skills') loadSkills();
        if (tabName === 'outputs') loadOutputs();
        if (tabName === 'config') loadConfig();
    });
});

// Execute workflow
document.getElementById('execute-btn').addEventListener('click', async () => {
    const request = document.getElementById('workflow-request').value;
    if (!request) {
        alert('Please enter a request');
        return;
    }

    const btn = document.getElementById('execute-btn');
    btn.disabled = true;
    btn.textContent = 'Executing...';

    try {
        const response = await fetch(`${API_URL}/workflows/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request })
        });

        const result = await response.json();
        displayWorkflowResult(result);
    } catch (error) {
        displayError('workflow-result', error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Execute';
    }
});

function displayWorkflowResult(result) {
    const container = document.getElementById('workflow-result');
    const content = document.getElementById('workflow-result-content');
    
    container.style.display = 'block';
    content.innerHTML = `
        <div><strong>Status:</strong> ${result.status}</div>
        <div><strong>Skill:</strong> ${result.skillName}</div>
        <div><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</div>
        ${result.error ? `<div class="error-message">${result.error}</div>` : ''}
        <div style="margin-top: 15px;"><strong>Result:</strong></div>
        <pre style="background: white; padding: 15px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(result.content, null, 2)}</pre>
    `;
}

// Load skills
async function loadSkills() {
    try {
        const response = await fetch(`${API_URL}/skills`);
        const data = await response.json();
        
        const skillsList = document.getElementById('skills-list');
        const skillSelect = document.getElementById('skill-select');
        
        skillsList.innerHTML = data.skills.map(skill => `
            <div class="skill-card">
                <h3>${skill.name}</h3>
                <p>${skill.description}</p>
            </div>
        `).join('');

        skillSelect.innerHTML = '<option value="">Select a skill...</option>' +
            data.skills.map(skill => `<option value="${skill.name}">${skill.name}</option>`).join('');
    } catch (error) {
        document.getElementById('skills-list').innerHTML = 
            `<div class="error-message">Error loading skills: ${error.message}</div>`;
    }
}

// Execute specific skill
document.getElementById('execute-skill-btn').addEventListener('click', async () => {
    const skillName = document.getElementById('skill-select').value;
    const inputText = document.getElementById('skill-input').value;

    if (!skillName) {
        alert('Please select a skill');
        return;
    }

    let input = {};
    if (inputText) {
        try {
            input = JSON.parse(inputText);
        } catch (error) {
            alert('Invalid JSON input');
            return;
        }
    }

    const btn = document.getElementById('execute-skill-btn');
    btn.disabled = true;
    btn.textContent = 'Executing...';

    try {
        const response = await fetch(`${API_URL}/skills/${skillName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        const result = await response.json();
        displaySkillResult(result);
    } catch (error) {
        displayError('skill-result', error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Execute Skill';
    }
});

function displaySkillResult(result) {
    const container = document.getElementById('skill-result');
    const content = document.getElementById('skill-result-content');
    
    container.style.display = 'block';
    content.innerHTML = `
        <div><strong>Status:</strong> ${result.status}</div>
        <div><strong>Skill:</strong> ${result.skillName}</div>
        <div><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</div>
        ${result.error ? `<div class="error-message">${result.error}</div>` : ''}
        <div style="margin-top: 15px;"><strong>Result:</strong></div>
        <pre style="background: white; padding: 15px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(result.content, null, 2)}</pre>
    `;
}

// Load outputs
async function loadOutputs() {
    try {
        const response = await fetch(`${API_URL}/workflows`);
        const data = await response.json();
        
        const outputsList = document.getElementById('outputs-list');
        
        if (!data.outputs || data.outputs.length === 0) {
            outputsList.innerHTML = '<p class="loading">No outputs yet. Execute a workflow to see results here.</p>';
            return;
        }

        outputsList.innerHTML = data.outputs.reverse().map(output => `
            <div class="output-item ${output.status === 'error' ? 'error' : ''}">
                <div class="output-header">
                    <span>${output.skillName}</span>
                    <span>${new Date(output.timestamp).toLocaleString()}</span>
                </div>
                ${output.error ? `<div class="error-message">${output.error}</div>` : ''}
                <div class="output-content">${JSON.stringify(output.content, null, 2)}</div>
            </div>
        `).join('');
    } catch (error) {
        document.getElementById('outputs-list').innerHTML = 
            `<div class="error-message">Error loading outputs: ${error.message}</div>`;
    }
}

document.getElementById('refresh-outputs-btn').addEventListener('click', loadOutputs);

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch(`${API_URL}/config`);
        const config = await response.json();
        
        const statusDiv = document.getElementById('config-status');
        statusDiv.innerHTML = `
            <h3>API Keys Status</h3>
            <div class="status-item">
                <span>Anthropic (Claude)</span>
                <span class="status-badge ${config.hasAnthropicKey ? 'configured' : 'not-configured'}">
                    ${config.hasAnthropicKey ? 'Configured' : 'Not Configured'}
                </span>
            </div>
            <div class="status-item">
                <span>OpenAI</span>
                <span class="status-badge ${config.hasOpenAiKey ? 'configured' : 'not-configured'}">
                    ${config.hasOpenAiKey ? 'Configured' : 'Not Configured'}
                </span>
            </div>
            <div class="status-item">
                <span>Twitter</span>
                <span class="status-badge ${config.hasTwitterKey ? 'configured' : 'not-configured'}">
                    ${config.hasTwitterKey ? 'Configured' : 'Not Configured'}
                </span>
            </div>
        `;
    } catch (error) {
        document.getElementById('config-status').innerHTML = 
            `<div class="error-message">Error loading configuration: ${error.message}</div>`;
    }
}

// Update API key
async function updateApiKey(service) {
    const inputId = `${service}-key`;
    const apiKey = document.getElementById(inputId).value;

    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/config/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, apiKey })
        });

        const result = await response.json();
        
        if (result.success) {
            alert(`${service} API key updated successfully`);
            document.getElementById(inputId).value = '';
            loadConfig();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error updating API key: ${error.message}`);
    }
}

function displayError(containerId, message) {
    const container = document.getElementById(containerId);
    container.style.display = 'block';
    container.innerHTML = `<div class="error-message">Error: ${message}</div>`;
}

// Initial load
loadSkills();
