const https = require('https');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-pro-preview';

console.log(`Testing model availability: ${MODEL_NAME}`);

if (!API_KEY) {
    console.error('CRITICAL: GEMINI_API_KEY not found in environment');
    process.exit(1);
}

const data = JSON.stringify({
    contents: [{
        parts: [{ text: "Explain football offside rule in 1 sentence." }]
    }]
});

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ SUCCESS! Model verification passed.');
            try {
                const response = JSON.parse(body);
                console.log('Response:', response.candidates[0].content.parts[0].text);
            } catch (e) {
                console.log('Raw Body:', body);
            }
        } else {
            console.error(`❌ FAILED. Status: ${res.statusCode}`);
            console.error('Body:', body);

            // Fallback suggestion logic
            if (res.statusCode === 404) {
                console.log(`\n[ANALYSIS] The model '${MODEL_NAME}' was not found.`);
                console.log("Possible reasons: 1. It doesn't exist yet. 2. Typo. 3. Not accessible via API key.");
            }
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error);
});

req.write(data);
req.end();
