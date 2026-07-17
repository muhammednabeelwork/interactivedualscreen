const channel = new BroadcastChannel('interactive_screen_channel');

const videoA = document.getElementById('video-a');
const videoB = document.getElementById('video-b');
const interactionOverlay = document.getElementById('interaction-overlay');
const btnUnmute = document.getElementById('btn-unmute');

// State variables
let currentZone = null; 
let timeoutTimer = null;
let isInitialized = false;

// Audio state (default unmuted since launcher activates via click gesture)
let isMuted = false;

// Keep track of the current playing source to avoid redundant loads
let activeSrc = '';
let targetSrc = '';

// Setup initial state of videos
videoA.muted = isMuted;
videoB.muted = isMuted;

// Heartbeat handling for connection indicator
channel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'HEARTBEAT') {
        channel.postMessage({ type: 'HEARTBEAT_ACK' });
    } else if (data.type === 'PLAY_ZONE') {
        if (!isInitialized) return; // Ignore if display is not clicked yet
        clearTimeout(timeoutTimer);
        playZoneVideo(data.zone);
    } else if (data.type === 'TOUCH_END') {
        if (!isInitialized) return; // Ignore if display is not clicked yet
        startIdleTimer();
    }
};

// Initialize display on user gesture
interactionOverlay.addEventListener('click', () => {
    initializeDisplay();
});

function initializeDisplay() {
    isInitialized = true;
    interactionOverlay.classList.add('hidden');
    
    // Play initial logo loop video
    transitionToVideo('assets/logo.mp4', true);
    
    // Show debug controls if running inside simulator or local window
    if (window.location.search.includes('simulator=true') || window.opener) {
        document.getElementById('debug-panel').style.display = 'flex';
    }
}

// Map zones to video paths
const zoneVideos = {
    1: 'assets/p1.mp4',
    2: 'assets/p2.mp4',
    3: 'assets/p3.mp4',
    4: 'assets/p4.mp4'
};

function playZoneVideo(zone) {
    if (currentZone === zone) return; // Already playing this video
    currentZone = zone;
    
    // Update ambient glow indicators on body
    document.body.setAttribute('data-active-zone', zone);

    const videoSrc = zoneVideos[zone];
    if (videoSrc) {
        // Product videos play on loop while finger is held
        transitionToVideo(videoSrc, true);
    }
}

function startIdleTimer() {
    clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(() => {
        // Clear active zone styling
        document.body.removeAttribute('data-active-zone');
        currentZone = null;
        
        // Return to home logo video (looping)
        transitionToVideo('assets/logo.mp4', true);
    }, 5000); // 5 seconds of inactivity
}

// Double-buffered cross-fade transition
function transitionToVideo(src, shouldLoop) {
    if (activeSrc === src) {
        // If it's already active, ensure it is playing and has correct loop setting
        const activeVideo = videoA.classList.contains('active') ? videoA : videoB;
        activeVideo.loop = shouldLoop;
        if (activeVideo.paused) {
            activeVideo.play().catch(handlePlayError);
        }
        return;
    }

    targetSrc = src;

    // Identify active and inactive player
    const activeVideo = videoA.classList.contains('active') ? videoA : videoB;
    const inactiveVideo = activeVideo === videoA ? videoB : videoA;

    // Load new source onto the inactive video player
    inactiveVideo.src = src;
    inactiveVideo.loop = shouldLoop;
    inactiveVideo.load();
    inactiveVideo.muted = isMuted;

    // Play behind the active video
    inactiveVideo.play()
        .then(() => {
            // Once playing starts, perform the cross-fade opacity switch
            inactiveVideo.classList.add('active');
            activeVideo.classList.remove('active');
            activeSrc = src;

            // Pause and reset the old video after the transition animation finishes
            setTimeout(() => {
                // Ensure the video we are pausing is still inactive
                if (!activeVideo.classList.contains('active') && activeSrc === src) {
                    activeVideo.pause();
                }
            }, 600); // matches CSS transition time
        })
        .catch((err) => {
            console.warn("Autoplay blocked or play interrupted. Retrying muted...", err);
            inactiveVideo.muted = true;
            inactiveVideo.play()
                .then(() => {
                    inactiveVideo.classList.add('active');
                    activeVideo.classList.remove('active');
                    activeSrc = src;
                    
                    setTimeout(() => {
                        if (!activeVideo.classList.contains('active') && activeSrc === src) {
                            activeVideo.pause();
                        }
                    }, 600);
                })
                .catch(handlePlayError);
        });
}

function handlePlayError(err) {
    console.error("Playback failed completely:", err);
}

// Toggle audio unmute
btnUnmute.addEventListener('click', () => {
    isMuted = !isMuted;
    videoA.muted = isMuted;
    videoB.muted = isMuted;
    btnUnmute.textContent = isMuted ? "Enable Audio" : "Disable Audio";
    btnUnmute.style.background = isMuted ? "rgba(255, 82, 82, 0.2)" : "rgba(0, 230, 118, 0.2)";
});
