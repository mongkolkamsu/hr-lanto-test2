// Face Detection Implementation for HR Lanto
// Uses face-api.js for face detection

// Global variables
let faceDetectionModelsLoaded = false;
let faceDetectionInterval;
let currentFaceDetectionStatus = 'none'; // 'none', 'detected', 'not-detected', 'partial'
let smileDetectionEnabled = false; // Default to false until loaded

// Load the required face-api.js models
async function loadFaceDetectionModels() {
    try {
        if (faceDetectionModelsLoaded) return true;

        // Use models from CDN
        const modelPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

        console.log('Starting to load face detection models from CDN...');
        // Show loading notification
        showFaceDetectionMessage('กำลังโหลดโมเดลตรวจจับใบหน้า...', 'info');

        // Load required models
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
            faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
            faceapi.nets.faceExpressionNet.loadFromUri(modelPath)
        ]);

        console.log('Face detection models loaded successfully!');
        faceDetectionModelsLoaded = true;
        showFaceDetectionMessage('โหลดโมเดลสำเร็จ', 'success');
        setTimeout(() => {
            hideFaceDetectionMessage();
        }, 2000);

        return true;
    } catch (error) {
        console.error('Error loading face detection models:', error);
        showFaceDetectionMessage('ไม่สามารถโหลดโมเดลตรวจจับใบหน้าได้', 'error');
        return false;
    }
}


// Create and append the face detection message element
function createFaceDetectionElements() {
    // Create message element if it doesn't exist
    if (!document.getElementById('face-detection-message')) {
        const messageElement = document.createElement('div');
        messageElement.id = 'face-detection-message';
        messageElement.className = 'face-detection-message';
        messageElement.style.display = 'none';

        // Custom styling to place it at the top of the camera container
        messageElement.style.position = 'absolute';
        messageElement.style.top = '20px';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translateX(-50%)';
        messageElement.style.marginTop = '0';
        messageElement.style.marginBottom = '0';
        messageElement.style.marginLeft = 'auto';
        messageElement.style.marginRight = 'auto';
        messageElement.style.width = 'fit-content'; // Keep pill shape
        messageElement.style.maxWidth = '90%'; // Prevent overflow
        messageElement.style.textAlign = 'center';
        messageElement.style.zIndex = '1000';

        // Find and add inside camera container so it floats over the video
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) {
            cameraContainer.appendChild(messageElement);
        } else {
            // Fallback to body
            document.body.appendChild(messageElement);
        }
    }

    // Create face detection overlay if it doesn't exist
    if (!document.getElementById('face-detection-overlay')) {
        const overlayElement = document.createElement('div');
        overlayElement.id = 'face-detection-overlay';
        overlayElement.className = 'face-detection-overlay';

        // Find and add to camera container
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) {
            cameraContainer.appendChild(overlayElement);
        }
    }

    // Create face status indicator - REMOVED per user request
    // if (!document.getElementById('face-status-indicator')) ...

    // Create scanning effect element
    if (!document.getElementById('scanning-effect')) {
        const scanningEffect = document.createElement('div');
        scanningEffect.id = 'scanning-effect';
        scanningEffect.className = 'scanning-effect';

        // Find and add to camera container
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) {
            cameraContainer.appendChild(scanningEffect);
        }
    }
}

// Show face detection message
function showFaceDetectionMessage(message, type = 'info') {
    const messageElement = document.getElementById('face-detection-message');
    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = `face-detection-message ${type}`;
    messageElement.style.display = 'block';

    // Auto-hide info/success messages after 3 seconds
    // ERRORS should persist until resolved
    if (type === 'info' || type === 'success') {
        const currentMessage = message;
        setTimeout(() => {
            // Check if message is still the same before hiding
            if (messageElement.textContent === currentMessage) {
                messageElement.style.display = 'none';
            }
        }, 3000);
    }
}

// Hide face detection message
function hideFaceDetectionMessage() {
    const messageElement = document.getElementById('face-detection-message');
    if (messageElement) {
        messageElement.style.display = 'none';
    }
}

// Update face status indicator
function updateFaceStatusIndicator(status, message) {
    // statusIndicator removed per user request
    currentFaceDetectionStatus = status; // Keep status tracking for logic
}

// Start face detection
async function startFaceDetection() {
    try {
        // First make sure models are loaded
        if (!faceDetectionModelsLoaded) {
            const loaded = await loadFaceDetectionModels();
            if (!loaded) return false;
        }

        // Make sure UI elements are created
        createFaceDetectionElements();

        // Show scanning effect and status indicator
        const scanningEffect = document.getElementById('scanning-effect');
        if (scanningEffect) scanningEffect.style.display = 'block';

        // const statusIndicator = document.getElementById('face-status-indicator');
        // if (statusIndicator) statusIndicator.style.display = 'flex';

        // Start detection interval
        faceDetectionInterval = setInterval(detectFace, 120); // 120ms interval to catch fast blinks

        return true;
    } catch (error) {
        console.error('Error starting face detection:', error);
        showFaceDetectionMessage('ไม่สามารถเริ่มตรวจจับใบหน้าได้', 'error');
        return false;
    }
}

// Stop face detection
function stopFaceDetection() {
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }

    const scanningEffect = document.getElementById('scanning-effect');
    if (scanningEffect) scanningEffect.style.display = 'none';

    // const statusIndicator = document.getElementById('face-status-indicator');
    // if (statusIndicator) statusIndicator.style.display = 'none';

    // Clear any detection boxes
    const overlay = document.getElementById('face-detection-overlay');
    if (overlay) overlay.innerHTML = '';
}

// Variable to track face detection stability
let validFaceFrameCount = 0;
let lastAutoCapture = 0;
const REQUIRED_STABLE_FRAMES = 2;  // Reduced from 4 to 2 for faster capture
const AUTO_CAPTURE_COOLDOWN = 400; // Reduced from 1000ms to 500ms
const LOW_LIGHT_THRESHOLD = 50;    // Increased from 50 to 80 for stricter lighting requirement

// --- Liveness Detection Variables ---
let livenessState = 'detect_face'; // 'detect_face', 'request_blink', 'passed'
let blinkHistory = [];

// Calculate Eye Aspect Ratio (EAR) for blink detection
function getEyeAspectRatio(eye) {
    if (!eye || eye.length < 6) return 0;
    const A = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const B = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const C = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (A + B) / (2.0 * C);
}

// Add an event listener to debug when face-api is loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM Content Loaded - Face API loaded?', typeof faceapi !== 'undefined');

    // Wait a bit for face-api to load
    setTimeout(() => {
        if (typeof faceapi === 'undefined') {
            console.error('Face API is still not loaded after timeout');
            showFaceDetectionMessage('ไม่สามารถโหลด Face API ได้ กรุณารีเฟรชหน้าเว็บ', 'error');
        } else {
            console.log('Face API loaded successfully!');
        }
    }, 2000);
});

// Check brightness of the video stream
function checkBrightness(video) {
    try {
        if (!video || video.videoWidth === 0) return 255;

        // Create a small canvas for processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Sample a small area (50x50) to reduce performance impact
        canvas.width = 50;
        canvas.height = 50;

        // Draw the center part of the video
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let totalBrightness = 0;

        // Calculate average brightness
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Standard luminance formula
            const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
            totalBrightness += brightness;
        }

        const avgBrightness = totalBrightness / (data.length / 4);
        return avgBrightness;
    } catch (e) {
        console.error('Error checking brightness:', e);
        return 255; // Assume bright enough on error
    }
}


// Detect face in the video stream
async function detectFace() {
    try {
        const video = document.getElementById('camera-video');
        const overlay = document.getElementById('face-detection-overlay');

        if (!video || !overlay || video.paused || video.ended || !video.srcObject) {
            return;
        }

        // Only run detection if video dimensions are available
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            return;
        }

        // Check for low light
        const brightness = checkBrightness(video);
        if (brightness < LOW_LIGHT_THRESHOLD) {
            updateFaceStatusIndicator('not-detected', 'แสงน้อยเกินไป ⚠️');
            showFaceDetectionMessage('แสงน้อยเกินไป กรุณาขยับไปที่สว่างกว่านี้', 'error');
            validFaceFrameCount = 0;

            // Clear any previous detection boxes
            overlay.innerHTML = '';

            // Return false immediately to prevent "detected" status overrides
            // This effectively blocks capture
            return false;
        }


        // Get detections
        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 320,
            scoreThreshold: 0.5 // Relaxed from 0.75 to 0.5
        });

        const detections = await faceapi.detectAllFaces(video, options)
            .withFaceLandmarks()
            .withFaceExpressions();

        // Clear previous detection boxes
        overlay.innerHTML = '';

        // Process detections
        if (detections.length === 0) {
            // No face detected
            livenessState = 'detect_face'; // reset liveness
            updateFaceStatusIndicator('not-detected', 'ไม่พบใบหน้า ⚠️');
            showFaceDetectionMessage('กรุณาให้เห็นใบหน้าชัดเจน', 'error');
            validFaceFrameCount = 0;
            return false;
        } else if (detections.length > 1) {
            // Multiple faces detected
            livenessState = 'detect_face'; // reset liveness
            updateFaceStatusIndicator('not-detected', 'พบใบหน้าหลายคน ⚠️');
            showFaceDetectionMessage('กรุณาให้เห็นเพียงใบหน้าเดียวในกล้อง', 'error');

            // Show all detected faces
            detections.forEach(detection => {
                drawDetectionBox(detection, overlay, false);
            });

            validFaceFrameCount = 0;
            return false;
        } else {
            // Single face detected - check if it's within the guide and large enough
            const detection = detections[0];
            const faceBox = detection.detection.box;

            // Check face size (should be at least 25% of the frame height)
            const minFaceHeight = video.videoHeight * 0.25; // Relaxed from 0.30 to 0.25

            // Check if face is properly positioned (should be centered)
            const videoCenter = {
                x: video.videoWidth / 2,
                y: video.videoHeight / 2
            };

            const faceCenter = {
                x: faceBox.x + faceBox.width / 2,
                y: faceBox.y + faceBox.height / 2
            };

            // Calculate distance from center (as percentage of frame width/height)
            const distanceX = Math.abs(faceCenter.x - videoCenter.x) / video.videoWidth;
            const distanceY = Math.abs(faceCenter.y - videoCenter.y) / video.videoHeight;

            // Make less strict conditions
            const isCentered = distanceX < 0.35 && distanceY < 0.35; // Increased from 0.30 to 0.35
            const isLargeEnough = faceBox.height >= (minFaceHeight * 0.7); // Reduced from 0.8

            // Check for Smile first (to adjust eye validation)
            const expressions = detection.expressions;
            // Lowered threshold from 0.1 to 0.01 for very subtle smiles
            let isMouthSmiling = false;
            try {
                const mouth = detection.landmarks.getMouth();
                if (mouth && mouth.length >= 20) {
                    const leftCornerY = mouth[0].y;
                    const rightCornerY = mouth[6].y;
                    const topLipCenterY = mouth[3].y;
                    const bottomLipCenterY = mouth[9].y;

                    const avgCornerY = (leftCornerY + rightCornerY) / 2.0;
                    const mouthCenterY = (topLipCenterY + bottomLipCenterY) / 2.0;

                    // If corners are higher (smaller Y) than the mouth center, it's a physical smile
                    // We add a +2 offset so even a straight lip with a tiny curl triggers it
                    if (avgCornerY < mouthCenterY + 2) {
                        isMouthSmiling = true;
                    }
                }
            } catch (e) { }

            const isSmiling = !smileDetectionEnabled || (expressions && expressions.happy > 0.01) || isMouthSmiling;

            // Validate Landmarks (Eyes, Nose, Mouth) - pass smile state
            const landmarkValidation = validateLandmarks(detection, video, isSmiling);

            // Debug info
            // console.log(`Face detected! Score: ${detection.detection.score.toFixed(2)}, Happy: ${expressions ? expressions.happy.toFixed(2) : 'N/A'}, Enabled: ${smileDetectionEnabled}`);

            console.log('Face detection info:', {
                distanceX,
                distanceY,
                isCentered,
                faceHeight: faceBox.height,
                requiredHeight: minFaceHeight * 0.8,
                isLargeEnough,
                landmarkValidation,
                isSmiling,
                happyScore: expressions ? expressions.happy : 0
            });

            // Debug logging for smile detection
            // if (validFaceFrameCount % 10 === 0) { // Log every 10 frames to avoid spam
            console.log(`Smile Check: Enabled=${smileDetectionEnabled}, Happy=${expressions ? expressions.happy.toFixed(2) : 'N/A'}, isSmiling=${isSmiling}`);
            // }

            if (isLargeEnough && isCentered && landmarkValidation.isValid && isSmiling) {
                // Face detected and properly positioned

                // --- Start Liveness Check ---
                if (livenessState === 'detect_face') {
                    livenessState = 'request_blink';
                    blinkHistory = [];

                    showFaceDetectionMessage('กรุณากะพริบตาเพื่อยืนยันตัวตน', 'info');
                    updateFaceStatusIndicator('partial', 'กรุณากะพริบตา �️');
                    drawDetectionBox(detection, overlay, true);
                    return true;
                }

                if (livenessState === 'request_blink') {
                    const leftEye = detection.landmarks.getLeftEye();
                    const rightEye = detection.landmarks.getRightEye();
                    const avgEAR = (getEyeAspectRatio(leftEye) + getEyeAspectRatio(rightEye)) / 2.0;

                    blinkHistory.push(avgEAR);
                    // Keep 25 frames of history (~3 seconds at 120ms interval)
                    if (blinkHistory.length > 25) blinkHistory.shift();

                    console.log(`EAR: ${avgEAR.toFixed(3)}`);

                    // Detect blink: sequence must contain a sudden drop in EAR
                    let hasBlinked = false;
                    if (blinkHistory.length >= 4) {
                        const maxEAR = Math.max(...blinkHistory);
                        const minEAR = Math.min(...blinkHistory);

                        // A blink usually causes a drop of at least 0.05 in EAR
                        // We lower this to 0.02 to make it very sensitive to small blinks or squints
                        // and the current eye state must be opening back up slightly
                        if (maxEAR - minEAR >= 0.02 && avgEAR >= minEAR + 0.005) {
                            hasBlinked = true;
                        }
                    }

                    if (hasBlinked) {
                        livenessState = 'passed';
                        showFaceDetectionMessage('ยืนยันตัวตนสำเร็จ กำลังบันทึก...', 'success');
                        updateFaceStatusIndicator('detected', 'สแกนใบหน้าสำเร็จ ✅');
                    } else {
                        // Still waiting for blink
                        showFaceDetectionMessage('กรุณากะพริบตา 1 ครั้ง', 'info');
                        updateFaceStatusIndicator('partial', 'กรุณากะพริบตา 👁️');
                    }
                    drawDetectionBox(detection, overlay, true);
                    return true;
                }

                if (livenessState === 'passed') {
                    updateFaceStatusIndicator('detected', 'ใบหน้าและการยิ้มสมบูรณ์ ✅');
                    hideFaceDetectionMessage();
                    drawDetectionBox(detection, overlay, true);

                    // Increment counter for stable face detection
                    validFaceFrameCount++;

                    // Check if we should auto-capture (stable face detection for X frames)
                    if (validFaceFrameCount >= REQUIRED_STABLE_FRAMES) {
                        const currentTime = Date.now();
                        if (currentTime - lastAutoCapture > AUTO_CAPTURE_COOLDOWN) {
                            // Auto capture the photo
                            triggerAutoCapture();
                            lastAutoCapture = currentTime;
                            validFaceFrameCount = 0; // Reset counter after capture
                            livenessState = 'detect_face'; // reset for next scan
                        }
                    }
                    return true;
                }

                // Fallback for safety
                return true;
            } else {
                // If the face stops being valid (e.g., they look completely away or stop smiling), keep asking or reset
                if (livenessState !== 'passed') {
                    // Try to be forgiving so they don't have to restart entirely for brief tracking errors
                    // livenessState = 'detect_face'; // Uncomment to be strict
                }
                // Face detected but not properly positioned or too small or invalid landmarks
                let message = '';

                if (!isLargeEnough) {
                    message = 'กรุณาเข้าใกล้กล้องมากขึ้น';
                } else if (!isCentered) {
                    message = 'กรุณาจัดใบหน้าให้อยู่กลางกรอบ';
                } else if (!landmarkValidation.isValid) {
                    message = landmarkValidation.message;
                } else if (!isSmiling) {
                    message = 'กรุณายิ้มหวานๆ เพื่อถ่ายรูป 😊'; // Smile prompt
                }

                updateFaceStatusIndicator('partial', (!isSmiling && smileDetectionEnabled) ? 'กรุณายิ้มหวานอีกนิด 😊' : 'ปรับตำแหน่งใบหน้า ⚠️');
                showFaceDetectionMessage(message, 'error');
                drawDetectionBox(detection, overlay, false);
                validFaceFrameCount = 0;
                return false;
            }
        }
    } catch (error) {
        console.error('Error in face detection:', error);
        validFaceFrameCount = 0;
        return false;
    }
}

// Function to trigger auto capture
function triggerAutoCapture() {
    // Double check brightness before capturing
    const video = document.getElementById('camera-video');
    const brightness = checkBrightness(video);

    if (brightness < LOW_LIGHT_THRESHOLD) {
        // Too dark to capture
        showFaceDetectionMessage('แสงน้อยเกินไป ไม่สามารถถ่ายอัตโนมัติได้', 'error');
        validFaceFrameCount = 0; // Reset counter
        return;
    }

    // Show message that photo is being taken
    showFaceDetectionMessage('กำลังถ่ายรูปอัตโนมัติ...', 'success');

    // Trigger the capturePhoto function in app.js
    if (typeof capturePhoto === 'function') {
        // No delay needed as we don't have flash anymore
        capturePhoto();
    }
}



// Draw detection box
function drawDetectionBox(detection, overlay, isValid) {
    const video = document.getElementById('camera-video');
    if (!video) return;

    // Get detection box
    const box = detection.detection.box;

    // Calculate scale factors
    const scaleX = overlay.offsetWidth / video.videoWidth;
    const scaleY = overlay.offsetHeight / video.videoHeight;

    // Create box element
    const boxElement = document.createElement('div');
    boxElement.className = `face-detection-box ${isValid ? '' : 'error'}`;
    boxElement.style.left = `${box.x * scaleX}px`;
    boxElement.style.top = `${box.y * scaleY}px`;
    boxElement.style.width = `${box.width * scaleX}px`;
    boxElement.style.height = `${box.height * scaleY}px`;

    overlay.appendChild(boxElement);
}

// Check if face is valid before capture
function isFaceValid() {
    return currentFaceDetectionStatus === 'detected';
}

// Initialize face detection when page loads
document.addEventListener('DOMContentLoaded', function () {
    // Pre-load models in background
    setTimeout(() => {
        loadFaceDetectionModels();
    }, 3000);
});

// Helper function to validate facial landmarks
// Helper function to validate facial landmarks
function validateLandmarks(detection, video, isSmiling = false) {
    const landmarks = detection.landmarks;
    const nose = landmarks.getNose();
    const mouth = landmarks.getMouth();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    if (!nose || !mouth || !leftEye || !rightEye) {
        return { isValid: false, message: 'ไม่พบองค์ประกอบใบหน้าครบถ้วน' };
    }

    // 1. Vertical Alignment Check (Tilt/Upside down)
    // Note: Y coordinates increase downwards
    // Using points for more stability than entire array averages
    const noseTipY = nose[3].y;
    // Eye vertical center is average of top(1) and bottom(4) of eye points
    const leftEyeCenterY = (leftEye[1].y + leftEye[4].y) / 2;
    const rightEyeCenterY = (rightEye[1].y + rightEye[4].y) / 2;
    const mouthTopY = mouth[0].y; // Upper lip top

    // If eye center is BELOW nose tip, that's definitely wrong (upside down)
    // Relaxed check: just ensure they aren't drastically below
    if (leftEyeCenterY > noseTipY + 10 || rightEyeCenterY > noseTipY + 10) {
        return { isValid: false, message: 'กรุณาหันหน้าให้ตรง' };
    }

    if (noseTipY > mouthTopY) {
        return { isValid: false, message: 'กรุณาหันหน้าให้ตรง (จมูกต่ำกว่าปาก)' };
    }

    // 2. Horizontal Symmetry Check (Looking at camera / Yaw)
    // Use inner canthus (eye corners near nose)
    // Left eye inner corner: index 3
    // Right eye inner corner: index 0
    const noseX = nose[3].x;
    const leftEyeInnerX = leftEye[3].x;
    const rightEyeInnerX = rightEye[0].x;

    const distToLeftEye = Math.abs(leftEyeInnerX - noseX);
    const distToRightEye = Math.abs(noseX - rightEyeInnerX);

    // Avoid division by zero
    if (distToRightEye === 0 || distToLeftEye === 0) return { isValid: false, message: 'กรุณาหันหน้าให้ตรง' };

    const ratio = distToLeftEye / distToRightEye;

    // Relaxed range for "Looking at camera" to handle shadows shifting landmarks
    if (ratio < 0.3 || ratio > 3.0) { // Relaxed from 0.4-2.5
        return { isValid: false, message: 'กรุณามองตรงไปที่กล้อง' };
    }

    // 3. Occlusion / Hand Check
    // 3.1 Check Mouth Width vs Eye Distance
    // Pupil to Pupil distance
    const leftPupilX = (leftEye[0].x + leftEye[3].x) / 2;
    const rightPupilX = (rightEye[0].x + rightEye[3].x) / 2;
    const pupilDistance = Math.abs(leftPupilX - rightPupilX);

    const mouthWidth = Math.abs(mouth[6].x - mouth[0].x); // Corner to corner

    // Relaxed check: Mouth width usually shouldn't be too small for a neutral expression
    // Stricter: Hand/Mask often reduces effective mouth width or detection confidence
    if (mouthWidth < pupilDistance * 0.4) { // Relaxed from 0.5 back to 0.4
        return { isValid: false, message: 'กรุณาเปิดเผยใบหน้า/ปากให้ชัดเจน (ห้ามใส่แมส)' };
    }

    // 3.2 Check Nose visibility height (Bridge to Tip)
    const noseHeight = Math.abs(nose[6].y - nose[0].y);
    const facePartHeight = Math.abs(mouth[0].y - leftEyeCenterY);

    if (noseHeight < facePartHeight * 0.15) { // Relaxed from 0.2 back to 0.15
        return { isValid: false, message: 'ไม่พบสันจมูก (ห้ามเอามือปิด)' };
    }

    // 3.3 Check Nose to Mouth Distance (Philtrum area)
    // If hand covers mouth, often the "mouth" is detected too far or too close
    const noseToMouthDist = Math.abs(mouth[3].y - nose[6].y); // Upper lip center to Nose tip

    // Distance should be reasonable relative to face size (using pupil distance as scale)
    // Typical philtrum + lip height is about 20-30% of pupil distance
    // If < 15% (too close) or > 80% (too far) - Hand/Mask indicators
    if (noseToMouthDist < pupilDistance * 0.15 || noseToMouthDist > pupilDistance * 0.8) {
        return { isValid: false, message: 'กรุณาถอดหน้ากากอนามัย และอย่าเอามือปิดปาก' };
    }

    // 4. Jawline Check (To prevent hand-masking)
    const jaw = landmarks.getJawOutline();
    const jawWidth = Math.abs(jaw[16].x - jaw[0].x);
    // const jawHeight = Math.abs(jaw[8].y - (jaw[0].y + jaw[16].y) / 2); // Unused

    // Check if jaw is too narrow (hand often makes face look thinner/squashed)
    // Relaxed from 1.1 to 0.9 to be more forgiving
    if (jawWidth < pupilDistance * 0.9) { // Relaxed from 1.0 back to 0.9
        return { isValid: false, message: 'ไม่พบกรอบหน้าชัดเจน (อาจมีสิ่งบดบัง)' };
    }

    // Check Jaw Symmetry (Left vs Right side width from nose)
    const leftJawDist = Math.abs(noseX - jaw[0].x);
    const rightJawDist = Math.abs(jaw[16].x - noseX);
    const jawSymmetryRatio = leftJawDist / rightJawDist;

    // Stricter symmetry check for "Half Face" detection
    // If one side of face is covered, symmetry is usually way off
    if (jawSymmetryRatio < 0.6 || jawSymmetryRatio > 1.7) {
        return { isValid: false, message: 'กรุณาหันหน้าตรง และอย่าบังใบหน้า' };
    }

    /* 
    // 5. Eye Openness Check (DISABLED per user request)
    // Left Eye
    const leftEyeHeight = Math.abs(leftEye[4].y - leftEye[1].y);
    const rightEyeHeight = Math.abs(rightEye[4].y - rightEye[1].y);
    // If eyes are too closed (or covered by flat hand which flattens features)
    // Relaxed check: reduced from 0.15 to 0.11 to find middle ground
    // If smiling, relax even more (effectively disable check)
    const minEyeRatio = isSmiling ? 0.01 : 0.11;

    if (leftEyeHeight < pupilDistance * minEyeRatio || rightEyeHeight < pupilDistance * minEyeRatio) {
        return { isValid: false, message: 'กรุณาลืมตาให้กว้างทั้งสองข้าง' };
    }
    */

    // 6. Sunglasses / Dark Glasses Check
    // Compare eye brightness with face skin brightness
    if (video) {
        const sunglassesCheck = detectSunglasses(video, landmarks);
        if (sunglassesCheck.isWearingSunglasses) {
            // Make this a warning instead of blocking error if it's borderline
            console.log('Suspicious of sunglasses but allowing capture for now');
            // return { isValid: false, message: 'กรุณาถอดแว่นดำ/แว่นกันแดดออก' };
        }
    }

    return { isValid: true, message: '' };
}

// Helper to detect sunglasses based on region brightness
function detectSunglasses(video, landmarks) {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        const getAvgBrightness = (points) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });

            // Add small padding
            const w = Math.max(1, maxX - minX);
            const h = Math.max(1, maxY - minY);

            if (w <= 0 || h <= 0) return 255;

            try {
                const imageData = ctx.getImageData(minX, minY, w, h);
                const data = imageData.data;
                let total = 0;

                for (let i = 0; i < data.length; i += 4) {
                    // Luminance
                    total += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                }
                return total / (data.length / 4);
            } catch (e) {
                return 255;
            }
        };

        const leftEyeBrightness = getAvgBrightness(landmarks.getLeftEye());
        const rightEyeBrightness = getAvgBrightness(landmarks.getRightEye());
        const eyeBrightness = (leftEyeBrightness + rightEyeBrightness) / 2;

        // Use Nose Bridge (between eyes) as skin reference
        const noseBridge = landmarks.getNose().slice(0, 4); // Top part of nose
        const skinBrightness = getAvgBrightness(noseBridge);

        // console.log('Brightness Check:', { eye: eyeBrightness, skin: skinBrightness, ratio: eyeBrightness / skinBrightness });

        // Stricter sunglasses detection - only if VERY dark compared to skin
        if (eyeBrightness < skinBrightness * 0.4) {
            return { isWearingSunglasses: true };
        }

        return { isWearingSunglasses: false };

    } catch (e) {
        console.error('Sunglasses detection error:', e);
        return { isWearingSunglasses: false };
    }
}

// Load app settings
function loadAppSettings() {
    fetch('api/employee.php?action=get_app_settings')
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                // Use loose comparison or String conversion to handle both '1' and 1
                smileDetectionEnabled = String(response.data.smile_detection_enabled) === '1';
                console.log('App settings loaded: Smile Detection ' + (smileDetectionEnabled ? 'Enabled' : 'Disabled') + ' (Value: ' + response.data.smile_detection_enabled + ')');
            }
        })
        .catch(err => console.error('Error loading app settings:', err));
}

// Call on startup
document.addEventListener('DOMContentLoaded', loadAppSettings);
