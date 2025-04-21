// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded and parsed');

    // Game elements
    const screens = {
        welcome: document.getElementById('welcome-screen'),
        instructions: document.getElementById('instructions-screen'),
        playerInfo: document.getElementById('player-info-screen'),
        cameraPermission: document.getElementById('camera-permission-screen'),
        game: document.getElementById('game-screen'),
        pause: document.getElementById('pause-screen'),
        gameOver: document.getElementById('game-over-screen'),
        leaderboard: document.getElementById('leaderboard-screen')
    };

    // Game canvas
    const gameCanvas = document.getElementById('game-canvas');
    const ctx = gameCanvas.getContext('2d');

    // Face detector
    const faceDetector = new FaceDetector();

    // Game state
    const gameState = {
        playerName: '',
        playerEmail: '',
        isRunning: false,
        isPaused: false,
        canvasWidth: 0,
        canvasHeight: 0,
        currentTime: 0,
        paddle: {
            x: 0,
            y: 0,
            width: 100,
            height: 15,
            color: '#ff3a4b' // Brighter red for better visibility
        },
        ball: {
            x: 0,
            y: 0,
            radius: 10,
            speedX: 5,
            speedY: 5,
            maxSpeed: 8,
            color: '#ffffff' // White for better visibility
        }
    };

    // Initialize leaderboard
    const leaderboard = new Leaderboard();

    // Global variable to track if this is the first update after game start
    let isFirstPaddleUpdate = true;
    let gameStartTime = 0;

    // Make sure welcome screen is active
    showScreen(screens.welcome);

    // Set up event listeners
    function setupEventListeners() {
        // Welcome screen buttons
        document.getElementById('start-button').addEventListener('click', function () {
            console.log('Start button clicked');
            showScreen(screens.playerInfo);
        });

        document.getElementById('instructions-btn').addEventListener('click', function () {
            console.log('Instructions button clicked');
            showScreen(screens.instructions);
        });

        document.getElementById('leaderboard-btn').addEventListener('click', function () {
            console.log('Leaderboard button clicked');
            leaderboard.renderLeaderboard('leaderboard-body');
            showScreen(screens.leaderboard);
        });

        // Player form
        document.getElementById('player-form').addEventListener('submit', async function (e) {
            e.preventDefault();
            console.log('Player form submitted');
            gameState.playerName = document.getElementById('player-name-input').value;
            gameState.playerEmail = document.getElementById('player-email').value || '';

            // Skip camera permission screen and initialize face detector directly
            try {
                console.log('Initializing face detector...');
                const initialized = await faceDetector.initialize();

                if (initialized) {
                    console.log('Face detector initialized successfully');
                    showScreen(screens.game);
                    startGame();
                } else {
                    throw new Error('Failed to initialize face detector');
                }
            } catch (error) {
                console.error('Camera access error:', error);
                console.error(error); 
                alert('Camera access failed. Please check your camera settings and try again.');
            }
        });

        // Camera permission
        document.getElementById('grant-permission-btn').addEventListener('click', async function () {
            console.log('Grant permission button clicked');
            this.textContent = 'Connecting to camera...';
            this.disabled = true;

            try {
                console.log('Initializing face detector...');
                const initialized = await faceDetector.initialize();

                if (initialized) {
                    console.log('Face detector initialized successfully');
                    showScreen(screens.game);
                    startGame();
                } else {
                    throw new Error('Failed to initialize face detector');
                }
            } catch (error) {
                console.error('Camera access error:', error);
                this.textContent = 'Try Again';
                this.disabled = false;

                // Show error message
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error-message';
                errorMessage.innerHTML = `
                    <p><strong>Camera access failed.</strong></p>
                    <p>Please check:</p>
                    <ul>
                        <li>DroidCam is running and connected</li>
                        <li>You've allowed browser camera permissions</li>
                        <li>No other application is using the camera</li>
                    </ul>
                    <p>Try refreshing the page after fixing these issues.</p>
                `;

                // Remove any existing error message
                const existingError = document.querySelector('.error-message');
                if (existingError) {
                    existingError.remove();
                }

                // Insert error message
                const permissionScreen = document.getElementById('camera-permission-screen');
                permissionScreen.insertBefore(errorMessage, this);
            }
        });

        // Back buttons
        document.getElementById('back-to-welcome').addEventListener('click', function () {
            showScreen(screens.welcome);
        });

        document.getElementById('back-from-instructions').addEventListener('click', function () {
            showScreen(screens.welcome);
        });

        document.getElementById('back-from-leaderboard').addEventListener('click', function () {
            showScreen(screens.welcome);
        });

        // Game controls
        document.getElementById('pause-btn').addEventListener('click', pauseGame);
        document.getElementById('resume-btn').addEventListener('click', resumeGame);
        document.getElementById('quit-btn').addEventListener('click', function () {
            endGame();
            showScreen(screens.welcome);
        });

        // Game over screen
        document.getElementById('play-again-btn').addEventListener('click', async function () {
            console.log('Play again button clicked');
            this.disabled = true;
            this.textContent = 'Restarting...';

            try {
                // Reset paddle tracking flags
                isFirstPaddleUpdate = true;
                gameStartTime = Date.now();

                // Force paddle to center position immediately
                gameState.paddle.x = (gameState.canvasWidth - gameState.paddle.width) / 2;

                // Complete reinitialize the face detector
                if (faceDetector) {
                    // Clean up and reinitialize
                    console.log('Reinitializing face detector...');
                    const initialized = await faceDetector.initialize();

                    if (initialized) {
                        console.log('Face detector reinitialized successfully');
                        showScreen(screens.game);
                        startGame();
                    } else {
                        console.error('Failed to reinitialize face detector');
                        showScreen(screens.cameraPermission);
                    }
                } else {
                    showScreen(screens.game);
                    startGame();
                }
            } catch (error) {
                console.error('Error during play again:', error);
                this.disabled = false;
                this.textContent = 'Play Again';
                alert('Error restarting the game. Please refresh the page and try again.');
            }
        });

        document.getElementById('view-leaderboard-btn').addEventListener('click', function () {
            leaderboard.renderLeaderboard('leaderboard-body');
            showScreen(screens.leaderboard);
        });

        // Debug toggle
        const debugToggle = document.getElementById('debug-toggle');
        if (debugToggle) {
            debugToggle.addEventListener('change', function () {
                faceDetector.toggleDebugView(this.checked);
            });
            // Initialize debug view
            faceDetector.toggleDebugView(debugToggle.checked);
        }

        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivity-slider');
        const sensitivityValue = document.getElementById('sensitivity-value');
        if (sensitivitySlider && sensitivityValue) {
            sensitivitySlider.addEventListener('input', function () {
                const value = parseFloat(this.value);
                sensitivityValue.textContent = value.toFixed(1);
                if (faceDetector.setSensitivity) {
                    faceDetector.setSensitivity(value);
                }
            });
            // Set initial value
            sensitivityValue.textContent = sensitivitySlider.value;
        }

        // Keyboard controls
        document.addEventListener('keydown', function (e) {
            if (!gameState.isRunning) return;

            if (e.key === 'Escape' || e.key === 'p') {
                if (gameState.isPaused) {
                    resumeGame();
                } else {
                    pauseGame();
                }
            }
        });

        // Window resize
        window.addEventListener('resize', function () {
            if (gameState.isRunning) {
                resizeCanvas();
            }
        });
    }

    // Call setup function
    setupEventListeners();

    // Game functions
    function showScreen(screen) {
        // Hide all screens
        Object.values(screens).forEach(function (s) {
            if (s) s.classList.remove('active');
        });

        // Show the requested screen
        if (screen) {
            screen.classList.add('active');
            console.log('Showing screen:', screen.id);
        } else {
            console.error('Attempted to show undefined screen');
        }
    }

    function startGame() {
        console.log('Starting game');
        resetGame();

        // Update player name display
        document.getElementById('display-name').textContent = gameState.playerName;

        // Reset paddle tracking flags
        isFirstPaddleUpdate = true;
        gameStartTime = Date.now();

        // Force paddle to center position
        gameState.paddle.x = (gameState.canvasWidth - gameState.paddle.width) / 2;

        // Start face detection if not already running
        if (faceDetector) {
            // Make sure we're not already running
            if (!faceDetector.isRunning) {
                console.log('Starting face detection');
                faceDetector.start(updatePaddlePosition);
            } else {
                console.log('Face detection already running, updating callback');
                faceDetector.onFaceMove = updatePaddlePosition;
            }
        }

        gameState.isRunning = true;
        gameState.isPaused = false;

        // Start game loop
        requestAnimationFrame(gameLoop);
    }

    function pauseGame() {
        if (!gameState.isRunning) return;

        console.log('Pausing game');
        gameState.isPaused = true;
        showScreen(screens.pause);
    }

    function resumeGame() {
        if (!gameState.isRunning) return;

        console.log('Resuming game');
        gameState.isPaused = false;
        showScreen(screens.game);
        requestAnimationFrame(gameLoop);
    }

    function endGame() {
        // Prevent multiple calls to endGame
        if (!gameState.isRunning) return;

        console.log('Ending game');
        gameState.isRunning = false;
        gameState.isPaused = false;

        // Stop face detection
        if (faceDetector) {
            faceDetector.stop();
        }

        // Add to leaderboard
        if (leaderboard && gameState.playerName && gameState.currentTime > 0) {
            try {
                leaderboard.addScore(gameState.playerName, gameState.currentTime);
            } catch (error) {
                console.error('Error adding score to leaderboard:', error);
            }
        }

        // Add this to your game.js file
        function generateQRCode(url) {
            // You can use a QR code API like https://api.qrserver.com
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            
            const qrCodeContainer = document.querySelector('.qr-code-container');
            if (qrCodeContainer) {
            qrCodeContainer.innerHTML = `
            <p>Scan to visit our website!</p>
            <a href="${url}" target="_blank" rel="noopener noreferrer">
                <img src="${qrCodeUrl}" alt="WebOccult Technologies Website" class="qr-code">
            </a>
        `;
    }
}

    // Call this function when showing the game over screen
    function showGameOver() {
        // Other game over code...
        generateQRCode('https://weboccult.com');
    }

        // Update game over screen
        const finalScore = document.getElementById('final-score');
        if (finalScore) {
            finalScore.textContent = gameState.currentTime.toFixed(2);
        }

        // Show game over screen
        showScreen(screens.gameOver);
    }

    function resetGame() {
        console.log('Resetting game');

        // Resize canvas
        resizeCanvas();

        // Reset paddle position to center
        gameState.paddle.x = (gameState.canvasWidth - gameState.paddle.width) / 2;
        gameState.paddle.y = gameState.canvasHeight - 90; // Increased distance from bottom for better visibility

        // Reset ball position
        gameState.ball.x = gameState.canvasWidth / 2;
        gameState.ball.y = gameState.canvasHeight / 2;

        // Set random ball direction
        gameState.ball.speedX = (Math.random() > 0.5 ? 1 : -1) * 3;
        gameState.ball.speedY = -3; // Start going up

        // Reset time
        gameState.currentTime = 0;
        document.getElementById('time').textContent = '0.00';
    }

    function resizeCanvas() {
        const container = gameCanvas.parentElement;
        if (!container) return;

        gameCanvas.width = container.clientWidth;
        gameCanvas.height = container.clientHeight;

        gameState.canvasWidth = gameCanvas.width;
        gameState.canvasHeight = gameCanvas.height;

        // Adjust paddle position after resize
        gameState.paddle.y = gameState.canvasHeight - 30;

        console.log('Canvas resized:', gameState.canvasWidth, 'x', gameState.canvasHeight);
    }

    function updatePaddlePosition(facePosition) {
        // If game is not running, don't update paddle
        if (!gameState.isRunning || gameState.isPaused) return;

        // CRITICAL FIX: Force the paddle to center for the first 3 seconds
        const timeSinceStart = Date.now() - gameStartTime;

        if (timeSinceStart < 3000) {
            // Force paddle to center position during the initial period
            gameState.paddle.x = (gameState.canvasWidth - gameState.paddle.width) / 2;
            return;
        }

        // After the initial period, calculate the target position based on face position
        // Convert normalized face position (0-1) to canvas coordinates
        const targetX = facePosition * (gameState.canvasWidth - gameState.paddle.width);

        // Calculate transition factor for smooth handover from center to face control
        // This creates a gradual transition between 3-4 seconds after game start
        const transitionFactor = Math.min(1, (timeSinceStart - 3000) / 1000);

        if (transitionFactor < 1) {
            // During transition, blend between center position and face-controlled position
            const centerX = (gameState.canvasWidth - gameState.paddle.width) / 2;
            const blendedTargetX = centerX * (1 - transitionFactor) + targetX * transitionFactor;

            // Move paddle towards blended target with increased responsiveness during transition
            const dx = blendedTargetX - gameState.paddle.x;
            gameState.paddle.x += dx * 0.9; // Higher smoothing factor during transition
        } else {
            // After transition, move paddle towards target with normal responsiveness
            const dx = targetX - gameState.paddle.x;
            gameState.paddle.x += dx * 0.7;
        }

        // Ensure paddle stays within canvas bounds
        gameState.paddle.x = Math.max(0, Math.min(gameState.canvasWidth - gameState.paddle.width, gameState.paddle.x));
    }

    function updateBall() {
        // If game is not running, don't update ball
        if (!gameState.isRunning || gameState.isPaused) return;

        // Move ball
        gameState.ball.x += gameState.ball.speedX;
        gameState.ball.y += gameState.ball.speedY;

        // Bounce off walls
        if (gameState.ball.x - gameState.ball.radius < 0 ||
            gameState.ball.x + gameState.ball.radius > gameState.canvasWidth) {
            gameState.ball.speedX = -gameState.ball.speedX;
        }

        // Bounce off ceiling
        if (gameState.ball.y - gameState.ball.radius < 0) {
            gameState.ball.speedY = -gameState.ball.speedY;
        }

        // Check for paddle collision
        if (gameState.ball.y + gameState.ball.radius > gameState.paddle.y &&
            gameState.ball.y - gameState.ball.radius < gameState.paddle.y + gameState.paddle.height &&
            gameState.ball.x > gameState.paddle.x &&
            gameState.ball.x < gameState.paddle.x + gameState.paddle.width) {

            // Calculate bounce angle based on where ball hit paddle
            const hitPosition = (gameState.ball.x - gameState.paddle.x) / gameState.paddle.width;
            const angle = hitPosition * Math.PI - Math.PI / 2; // -PI/2 to PI/2

            // Set new direction
            const speed = Math.sqrt(gameState.ball.speedX * gameState.ball.speedX +
                gameState.ball.speedY * gameState.ball.speedY);
            gameState.ball.speedX = Math.cos(angle) * speed;
            gameState.ball.speedY = Math.sin(angle) * speed;

            // Ensure ball is moving upward
            if (gameState.ball.speedY > 0) {
                gameState.ball.speedY = -gameState.ball.speedY;
            }

            // Increase speed slightly with a smaller factor (1.02 instead of 1.05)
            gameState.ball.speedX *= 1.02;
            gameState.ball.speedY *= 1.02;

            // Cap maximum ball speed
            if (Math.abs(gameState.ball.speedX) > gameState.ball.maxSpeed) {
                gameState.ball.speedX = Math.sign(gameState.ball.speedX) * gameState.ball.maxSpeed;
            }
            if (Math.abs(gameState.ball.speedY) > gameState.ball.maxSpeed) {
                gameState.ball.speedY = Math.sign(gameState.ball.speedY) * gameState.ball.maxSpeed;
            }
        }

        // Check for game over (ball below paddle)
        if (gameState.ball.y - gameState.ball.radius > gameState.canvasHeight) {
            endGame();
        }
    }

    function updateTime() {
        if (!gameState.isRunning || gameState.isPaused) return;

        gameState.currentTime += 1 / 60; // Assuming 60 FPS
        document.getElementById('time').textContent = gameState.currentTime.toFixed(2);
    }

    function drawGame() {
        // Clear canvas
        ctx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

        // Draw paddle
        ctx.fillStyle = gameState.paddle.color;
        ctx.fillRect(gameState.paddle.x, gameState.paddle.y,
            gameState.paddle.width, gameState.paddle.height);

        // Draw ball
        ctx.fillStyle = gameState.ball.color;
        ctx.beginPath();
        ctx.arc(gameState.ball.x, gameState.ball.y,
            gameState.ball.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function gameLoop() {
        if (!gameState.isRunning) return;
        if (gameState.isPaused) return;

        updateTime();
        updateBall();
        drawGame();

        requestAnimationFrame(gameLoop);
    }
});