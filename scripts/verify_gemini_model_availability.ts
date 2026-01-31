import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
import { config } from 'npm:dotenv';

config(); // Load .env

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-3-pro-preview';

async function testModel() {
    console.log(`Testing model availability: ${MODEL_NAME}`);
    if (!API_KEY) {
        console.error('CRITICAL: GEMINI_API_KEY not found in environment');
        process.exit(1);
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const prompt = "Explain football offside rule in 1 sentence.";
        console.log(`Sending prompt: "${prompt}"`);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ SUCCESS! Model verification passed.');
        console.log(`Response: ${text}`);
    } catch (error: any) {
        console.error('❌ FAILED to access model.');
        console.error('Error details:', error.message);
        console.error('If this fails, the model name might be incorrect or not whitelisted.');
    }
}

testModel();
