// Initialize BroadcastChannel for communication between screens
const channel = new BroadcastChannel('interactive_screen_channel');

const grid = document.getElementById('controller-grid');

// Track all active pointers
// Map: pointerId -> { zone, timestamp }
const activePointers = new Map();

// Respond to heartbeat from big screen to confirm connection
channel.onmessage = (event) => {
    if (event.data && event.data.type === 'HEARTBEAT') {
        channel.postMessage({ type: 'HEARTBEAT_ACK' });
    }
};

// Send periodic heartbeats
setInterval(() => {
    channel.postMessage({ type: 'HEARTBEAT' });
}, 1000);

// Helper to determine zone index based on absolute coordinates
function getZoneFromCoordinates(clientX, clientY) {
    const rect = grid.getBoundingClientRect();
    // Clamp coordinates to grid bounding box
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width - 1));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height - 1));
    
    const midX = rect.width / 2;
    const midY = rect.height / 2;
    
    if (x < midX) {
        return y < midY ? 1 : 3;
    } else {
        return y < midY ? 2 : 4;
    }
}

// Notify the big screen about the active zone
function sendActiveZone() {
    let latestZone = null;
    let latestTimestamp = -1;

    activePointers.forEach((pointer) => {
        if (pointer.timestamp > latestTimestamp) {
            latestTimestamp = pointer.timestamp;
            latestZone = pointer.zone;
        }
    });

    if (latestZone !== null) {
        channel.postMessage({
            type: 'PLAY_ZONE',
            zone: latestZone,
            timestamp: latestTimestamp
        });
    } else {
        channel.postMessage({
            type: 'TOUCH_END',
            timestamp: Date.now()
        });
    }
}

// Pointer Event Handlers
grid.addEventListener('pointerdown', (e) => {
    // Capture pointer to ensure tracking continues if they slide off the viewport
    grid.setPointerCapture(e.pointerId);

    const zone = getZoneFromCoordinates(e.clientX, e.clientY);
    activePointers.set(e.pointerId, { zone, timestamp: Date.now() });

    sendActiveZone();
});

grid.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) {
        const newZone = getZoneFromCoordinates(e.clientX, e.clientY);
        const currentData = activePointers.get(e.pointerId);

        if (currentData.zone !== newZone) {
            // Update the zone and give it a fresh timestamp representing latest activity
            activePointers.set(e.pointerId, { zone: newZone, timestamp: Date.now() });
            sendActiveZone();
        }
    }
});

function handlePointerUp(e) {
    if (activePointers.has(e.pointerId)) {
        grid.releasePointerCapture(e.pointerId);
        activePointers.delete(e.pointerId);
        sendActiveZone();
    }
}

grid.addEventListener('pointerup', handlePointerUp);
grid.addEventListener('pointercancel', handlePointerUp);
grid.addEventListener('lostpointercapture', handlePointerUp);
