class FaceDetector {
    constructor() {
        this.video = document.getElementById('camera-feed');
        this.displayVideo = document.getElementById('camera-display');
        this.debugCanvas = document.getElementById('debug-canvas');
        this.debugCtx = this.debugCanvas ? this.debugCanvas.getContext('2d') : null;
        this.model = null;
        this.isRunning = false;
        this.facePosition = 0.5; // Always start at center
        this.targetFacePosition = 0.5;
        this.onFaceMove = null;
        this.sensitivity = 2.0; // Movement sensitivity
        this.showDebug = true;
        this.lastVideoTime = 0;
        this.animationId = null;
        this.detectionStartTime = 0;
        this.transitionDuration = 3000; // 3 seconds transition
        this.hasDetectedFace = false; // Flag to track if we've detected a face
    }

    async initialize() {
        try {
            // First make sure any existing resources are cleaned up
            this.cleanupResources();
            
            // Reset face position to center
            this.facePosition = 0.5;
            this.targetFacePosition = 0.5;
            this.hasDetectedFace = false;
            
            // Load the BlazeFace model if not already loaded
            if (!this.model) {
                this.model = await blazeface.load();
                console.log('BlazeFace model loaded');
            }
            
            // Check if camera is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('Camera not supported in this browser');
                return false;
            }
            
            // Get video devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length === 0) {
                console.error('No camera devices found');
                return false;
            }
            
            // Try to find DroidCam if available
            const droidCamDevice = videoDevices.find(device => 
                device.label.toLowerCase().includes('droidcam') || 
                device.deviceId.toLowerCase().includes('droidcam')
            );
            
            // Prepare constraints - prefer DroidCam if available
            let constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            };
            
            // Use explicit device ID if DroidCam found
            if (droidCamDevice) {
                console.log('DroidCam detected, using it as primary camera');
                constraints.video.deviceId = { exact: droidCamDevice.deviceId };
            }
            
            // Get camera stream
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Create video element if it doesn't exist
            if (!this.video) {
                this.video = document.createElement('video');
                this.video.id = 'camera-feed';
                this.video.style.display = 'none';
                document.body.appendChild(this.video);
            }
            
            // Set up video element
            this.video.srcObject = stream;
            this.video.autoplay = true;
            this.video.playsInline = true;
            this.video.muted = true;
            
            // Explicitly set muted property (needed for autoplay in some browsers)
            this.video.muted = true;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(resolve).catch(err => {
                        console.error('Error playing video:', err);
                        resolve(); // Resolve anyway to continue
                    });
                };
                
                // If already loaded, resolve immediately
                if (this.video.readyState >= 2) {
                    this.video.play().then(resolve).catch(err => {
                        console.error('Error playing video:', err);
                        resolve(); // Resolve anyway to continue
                    });
                }
            });
            
            // Set up display video if it exists
            if (this.displayVideo) {
                this.displayVideo.srcObject = stream;
                this.displayVideo.autoplay = true;
                this.displayVideo.playsInline = true;
                this.displayVideo.muted = true;
                
                // Explicitly set muted property
                this.displayVideo.muted = true;
                
                try {
                    await this.displayVideo.play();
                } catch (err) {
                    console.error('Error playing display video:', err);
                    // Continue anyway
                }
            }
            
            console.log('Camera initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing camera:', error);
            return false;
        }
    }

    cleanupResources() {
        // Stop any ongoing detection
        this.isRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset face position to center
        this.facePosition = 0.5;
        this.targetFacePosition = 0.5;
        
        // Stop all video tracks
        const stopTracks = (element) => {
            if (element && element.srcObject) {
                const tracks = element.srcObject.getTracks();
                tracks.forEach(track => {
                    try {
                        track.stop();
                    } catch (e) {
                        console.error('Error stopping track:', e);
                    }
                });
                element.srcObject = null;
            }
        };
        
        stopTracks(this.video);
        stopTracks(this.displayVideo);
        
        console.log('Face detector resources cleaned up');
    }

    start(callback) {
        if (!this.model) {
            console.error('Face detection model not loaded');
            return false;
        }
        
        // Reset positions and state
        this.facePosition = 0.5;
        this.targetFacePosition = 0.5;
        this.hasDetectedFace = false;
        this.detectionStartTime = Date.now();
        
        // If already running, just update the callback
        if (this.isRunning) {
            console.log('Face detection already running, updating callback');
            this.onFaceMove = callback;
            return true;
        }
        
        // Make sure videos are playing
        const ensureVideoPlaying = (videoElement) => {
            if (videoElement && videoElement.paused && videoElement.srcObject) {
                videoElement.play().catch(err => {
                    console.error('Error playing video:', err);
                });
            }
        };
        
        ensureVideoPlaying(this.video);
        ensureVideoPlaying(this.displayVideo);
        
        // Start detection
        this.isRunning = true;
        this.onFaceMove = callback;
        this.lastVideoTime = 0;
        this.detectFaces();
        
        // Immediately call the callback with the center position
        if (this.onFaceMove) {
            this.onFaceMove(0.5);
        }
        
        console.log('Face detection started with centered position');
        return true;
    }

    stop() {
        this.isRunning = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Don't stop video tracks here, just pause the videos
        if (this.video && !this.video.paused) {
            this.video.pause();
        }
        
        if (this.displayVideo && !this.displayVideo.paused) {
            this.displayVideo.pause();
        }
        
        console.log('Face detection stopped');
    }

    resume() {
        // Resume video playback
        if (this.video && this.video.srcObject) {
            this.video.play();
        }
        if (this.displayVideo && this.displayVideo.srcObject) {
            this.displayVideo.play();
        }
        
        // Resume face detection
        if (!this.isRunning) {
            this.isRunning = true;
            this.detectFaces();
            console.log('Face detection resumed');
        }
    }

    setSensitivity(value) {
        this.sensitivity = Math.max(0.5, Math.min(5.0, value));
    }

    toggleDebugView(show) {
        this.showDebug = show;
        this.debugCanvas.style.display = show ? 'block' : 'none';
    }

    async detectFaces() {
        if (!this.isRunning) return;
        
        // Calculate transition progress
        const timeElapsed = Date.now() - this.detectionStartTime;
        const transitionProgress = Math.min(1, timeElapsed / this.transitionDuration);
        
        // Only process if video is playing and ready
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            try {
                // Get face predictions
                const predictions = await this.model.estimateFaces(this.video, false);
                
                // Draw debug view if enabled
                if (this.showDebug && this.debugCtx) {
                    this.drawDebugView(predictions);
                }
                
                // Process face position
                if (predictions.length > 0) {
                    // Get the first face
                    const face = predictions[0];
                    
                    // Calculate normalized x position (0-1)
                    const faceX = (face.topLeft[0] + face.bottomRight[0]) / 2 / this.video.videoWidth;
                    
                    // CRITICAL FIX: Adjust the face position calculation
                    // Map the face position from 0.2-0.8 range to 0-1 range for better control
                    // This ensures that small movements of the face cause proportional paddle movements
                    // and that the center of the camera corresponds to the center of the paddle
                    
                    // First, flip the x-axis so moving face left moves paddle left
                    let normalizedX = 1 - faceX;
                    
                    // Then map from typical face position range (0.2-0.8) to full range (0-1)
                    // This makes the paddle more responsive to face movements
                    normalizedX = (normalizedX - 0.2) / 0.6;
                    
                    // Clamp to 0-1 range
                    normalizedX = Math.max(0, Math.min(1, normalizedX));
                    
                    // Apply sensitivity with a more balanced approach
                    // Use a lower sensitivity to prevent extreme movements
                    this.targetFacePosition = normalizedX;
                    
                    // Mark that we've detected a face
                    this.hasDetectedFace = true;
                }
            } catch (error) {
                console.error('Error during face detection:', error);
            }
        }
        
        // CRITICAL FIX: Handle the face position based on transition state
        if (!this.hasDetectedFace || transitionProgress < 1) {
            // If we haven't detected a face yet or we're in transition period,
            // force the position to center (0.5)
            this.facePosition = 0.5;
        } else {
            // After transition and with face detected, smoothly follow the target
            // Use a gentler smoothing factor to prevent sudden jumps
            this.facePosition = this.facePosition * 0.9 + this.targetFacePosition * 0.1;
        }
        
        // Call the callback with current face position
        if (this.onFaceMove) {
            this.onFaceMove(this.facePosition);
        }
        
        // Continue detection loop
        this.animationId = requestAnimationFrame(() => this.detectFaces());
    }

    drawDebugView(predictions) {
        // Clear canvas
        this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        
        // Set canvas dimensions to match video
        this.debugCanvas.width = this.video.videoWidth;
        this.debugCanvas.height = this.video.videoHeight;
        
        // Draw video frame
        this.debugCtx.drawImage(this.video, 0, 0, this.debugCanvas.width, this.debugCanvas.height);
        
        // Draw face boxes
        predictions.forEach(prediction => {
            const start = prediction.topLeft;
            const end = prediction.bottomRight;
            const size = [end[0] - start[0], end[1] - start[1]];
            
            // Draw rectangle around face
            this.debugCtx.strokeStyle = '#ff3e3e';
            this.debugCtx.lineWidth = 2;
            this.debugCtx.strokeRect(start[0], start[1], size[0], size[1]);
            
            // Draw paddle position indicator
            const paddlePos = (1 - this.facePosition) * this.debugCanvas.width;
            this.debugCtx.fillStyle = 'rgba(255, 62, 62, 0.7)';
            this.debugCtx.fillRect(paddlePos - 10, this.debugCanvas.height - 10, 20, 5);
        });
    }
}