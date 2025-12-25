import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/repair' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System Instructions
const SYSTEM_PROMPT = `
ROLE: Senior Diagnostic Engineer. 
MISSION: Guide the user through hardware repairs using the provided technical manual.
SAFETY: Always verify power is OFF before starting.
LOGIC: One step at a time. Reference specific page numbers or diagram labels.
`;

wss.on('connection', async (ws) => {
    console.log('Technician connected to repair session');

    // Use the 2.0 Flash model for low-latency live interaction
    // Note: To use your cached manual, you would pass the cachedContent name here
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: SYSTEM_PROMPT 
    });

    // Initialize the Multi-modal Live Session
    // In Node.js, we use a chat session or a stream depending on the SDK version
    const chat = model.startChat();

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.realtime_input) {
                const chunk = data.realtime_input.media_chunks[0];
                
                // Process the image frame and get a response
                const result = await model.generateContent([
                    { inlineData: { data: chunk.data, mimeType: chunk.mime_type } },
                    "Analyze the current view. Is there a fault visible?"
                ]);

                const responseText = result.response.text();
                
                // Send response back to frontend
                ws.send(JSON.stringify({ text: responseText }));
            }
        } catch (error) {
            console.error('Error processing frame:', error);
        }
    });

    ws.on('close', () => console.log('Session ended'));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Node.js Repair Server running on port ${PORT}`);
});
