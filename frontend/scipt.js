/**
 * CircuitSense Pro - Frontend Logic
 * Manages WebRTC camera feed and WebSocket streaming to Node.js Backend
 */

const video = document.getElementById('camera-feed');
const canvas = document.getElementById('frame-processor');
const initBtn = document.getElementById('init-btn');
const stopBtn = document.getElementById('stop-btn');
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('connection-status');
const chatContainer = document.getElementById('chat-container');
const scanLine = document.getElementById('scan-line');
const welcomeOverlay = document.getElementById('welcome-overlay');
const controlBar = document.getElementById('control-bar');

let ws = null;
let stream = null;
let frameInterval = null;

// Configuration
const WS_URL = 'ws://localhost:8000/ws/repair';
const FRAME_RATE = 1; // 1 frame per second (optimized for diagnostics)

async function startSession() {
    try {
        // 1. Get User Media
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        video.srcObject = stream;
        video.classList.remove('opacity-60');

        // 2. Connect WebSocket
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            setConnected(true);
            welcomeOverlay.classList.add('hidden');
            controlBar.classList.remove('hidden');
            scanLine.classList.remove('hidden');
            startFrameStreaming();
            addLog("System initialized. AI is now monitoring visual feed.");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.text) {
                addLog(data.text, 'ai');
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket Error:", err);
            addLog("Connection error. Check if backend is running.", 'error');
        };

        ws.onclose = () => {
            setConnected(false);
            stopSession();
        };

    } catch (err) {
        console.error("Initialization Failed:", err);
        addLog("Permission denied. Camera and microphone access required.", 'error');
    }
}

function stopSession() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (frameInterval) clearInterval(frameInterval);
    if (ws) ws.close();
    
    location.reload(); // Reset UI state
}

function startFrameStreaming() {
    const ctx = canvas.getContext('2d');
    
    frameInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Downscale for performance
            canvas.width = 640;
            canvas.height = 480;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            
            const payload = {
                realtime_input: {
                    media_chunks: [{
                        data: base64Data,
                        mime_type: "image/jpeg"
                    }]
                }
            };
            
            ws.send(JSON.stringify(payload));
        }
    }, 1000 / FRAME_RATE);
}

function setConnected(isConnected) {
    if (isConnected) {
        statusDot.className = "status-dot w-2 h-2 rounded-full bg-green-500 status-pulse";
        statusText.innerHTML = `<span class="text-green-500 font-bold">LIVE SESSION</span>`;
    } else {
        statusDot.className = "status-dot w-2 h-2 rounded-full bg-red-500";
        statusText.innerText = "OFFLINE";
    }
}

function addLog(text, type = 'system') {
    const div = document.createElement('div');
    if (type === 'ai') {
        div.className = "ai-bubble bg-slate-800 p-4 rounded-xl border-l-4 border-blue-500 mb-4";
        div.innerHTML = `<p class="text-slate-200">${text}</p>`;
    } else if (type === 'error') {
        div.className = "bg-red-900/20 p-3 rounded-lg border border-red-500/30 text-red-400 mb-4";
        div.innerText = text;
    } else {
        div.className = "text-slate-500 italic text-[11px] mb-2 px-1";
        div.innerText = text;
    }
    
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

initBtn.addEventListener('click', startSession);
stopBtn.addEventListener('click', stopSession);
