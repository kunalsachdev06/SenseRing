const http = require('http');
const { execFile } = require('child_process');

const PORT = process.env.BRIDGE_PORT || 3199;

const COMMAND_TO_VK = {
    PLAY_PAUSE: 0xB3,
    NEXT: 0xB0,
    PREV: 0xB1,
    VOL_UP: 0xAF,
    VOL_DOWN: 0xAE,
    SCROLL_UP: 0x21,
    SCROLL_DOWN: 0x22
};

function sendMediaKey(virtualKey) {
    const script = [
        "$vk = " + virtualKey + ";",
        "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MediaKey { [DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo); }';",
        "[MediaKey]::keybd_event($vk, 0, 1, 0);",
        "[MediaKey]::keybd_event($vk, 0, 2, 0);"
    ].join(' ');

    execFile('powershell', ['-NoProfile', '-Command', script], { timeout: 3000 }, (error) => {
        if (error) {
            console.error('Failed to send media key:', error.message);
        }
    });
}

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method !== 'POST' || req.url !== '/command') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Not found' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
            req.destroy();
        }
    });

    req.on('end', () => {
        try {
            const payload = JSON.parse(body || '{}');
            const command = payload.command;

            if (!command || !COMMAND_TO_VK[command]) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'Unknown command' }));
                return;
            }

            sendMediaKey(COMMAND_TO_VK[command]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`Local media bridge running at http://localhost:${PORT}`);
});
