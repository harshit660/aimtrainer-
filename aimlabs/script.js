document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const scoreDisplay = document.getElementById('score-display');
    const gunDisplay = document.getElementById('gun-display');
    const crosshair = document.getElementById('crosshair');

    let score = 0;
    let targets = [];
    let currentGun = 1; // 1: Manual, 2: Rapid, 3: Burst
    let canShoot = true;
    let isShooting = false; // For rapid fire state
    let rapidFireInterval = null;
    let burstTimeout = null; // To manage burst cooldown

    const MAX_TARGETS = 5; // Max targets on screen
    const TARGET_SIZE = 50;
    const SPAWN_INTERVAL_MS = 800; // How often new targets appear
    const MOVEMENT_SPEED = 1; // Pixels per frame update
    const TARGET_COLORS = ['target-blue', 'target-red', 'target-green'];
    const BURST_DELAY_MS = 60; // Delay between burst shots
    const BURST_COOLDOWN_MS = 300; // Cooldown after a burst
    const RAPID_FIRE_RATE_MS = 100; // Rate for Gun 2

    // --- Game Loop ---
    function gameLoop() {
        moveTargets();
        requestAnimationFrame(gameLoop); // Smooth animation loop
    }

    // --- Target Management ---
    function createTarget() {
        if (targets.length >= MAX_TARGETS) return;

        const targetElement = document.createElement('div');
        targetElement.classList.add('target', TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)]);

        // Random initial position within viewport bounds
        const maxX = gameContainer.clientWidth - TARGET_SIZE;
        const maxY = gameContainer.clientHeight - TARGET_SIZE;
        let startX = Math.random() * maxX;
        let startY = Math.random() * maxY;

        // Ensure targets don't spawn too close to edges initially if moving outwards
        const margin = 100; // Start further in if moving outwards
        let moveDirectionX = 0;
        let moveDirectionY = 0;

        if (Math.random() > 0.5) { // Move horizontally
            moveDirectionX = Math.random() > 0.5 ? MOVEMENT_SPEED : -MOVEMENT_SPEED;
            if (moveDirectionX > 0) startX = Math.random() * margin; // Start left if moving right
            else startX = maxX - Math.random() * margin; // Start right if moving left
            startY = Math.random() * maxY;
        } else { // Move vertically
            moveDirectionY = Math.random() > 0.5 ? MOVEMENT_SPEED : -MOVEMENT_SPEED;
            if (moveDirectionY > 0) startY = Math.random() * margin; // Start top if moving down
            else startY = maxY - Math.random() * margin; // Start bottom if moving up
            startX = Math.random() * maxX;
        }

        targetElement.style.left = `${startX}px`;
        targetElement.style.top = `${startY}px`;

        // Add spawn animation class and remove after short delay
        targetElement.classList.add('spawn');
        setTimeout(() => targetElement.classList.remove('spawn'), 50);


        const targetData = {
            element: targetElement,
            x: startX,
            y: startY,
            vx: moveDirectionX * (0.5 + Math.random()), // Slight speed variation
            vy: moveDirectionY * (0.5 + Math.random()),
            id: Date.now() + Math.random() // Unique ID
        };

        targets.push(targetData);
        gameContainer.appendChild(targetElement);

        // Add click listener directly to the target
        targetElement.addEventListener('mousedown', (e) => {
             // Prevent shooting if the click wasn't the primary button or if we can't shoot yet
             if (e.button !== 0 || !canShoot) return;
             handleTargetHit(targetData.id);
             // Trigger shot effects based on current gun (even if target is missed, effects happen on click)
             triggerShotEffects();
        });
    }

    function moveTargets() {
        const targetsToRemove = [];
        targets.forEach((target, index) => {
            target.x += target.vx;
            target.y += target.vy;

            // Update element position smoothly
            target.element.style.left = `${target.x}px`;
            target.element.style.top = `${target.y}px`;

            // Remove targets that go off-screen
            if (target.x < -TARGET_SIZE || target.x > gameContainer.clientWidth ||
                target.y < -TARGET_SIZE || target.y > gameContainer.clientHeight) {
                targetsToRemove.push(index);
                gameContainer.removeChild(target.element);
            }
        });

        // Remove off-screen targets from array (iterate backwards to avoid index issues)
        for (let i = targetsToRemove.length - 1; i >= 0; i--) {
            targets.splice(targetsToRemove[i], 1);
        }
    }

    function handleTargetHit(targetId) {
        const targetIndex = targets.findIndex(t => t.id === targetId);
        if (targetIndex === -1) return; // Target already removed

        const targetData = targets[targetIndex];

        // Add hit animation
        targetData.element.classList.add('hit');

        // Remove target after animation
        setTimeout(() => {
            // Check if element still exists in DOM before removing
            if (targetData.element.parentNode === gameContainer) {
                 gameContainer.removeChild(targetData.element);
            }
        }, 200); // Matches CSS opacity transition

        // Remove from array immediately so it's not processed further
        targets.splice(targetIndex, 1);

        // Update score
        score++;
        updateScoreDisplay();
    }

    // --- Shooting Logic ---
    function handleMouseDown(event) {
        if (event.button !== 0) return; // Only react to left click

        if (currentGun === 1) { // Manual
            shoot();
        } else if (currentGun === 2) { // Rapid Fire
            isShooting = true;
            shoot(); // Fire immediately
            clearInterval(rapidFireInterval); // Clear previous interval if any
            rapidFireInterval = setInterval(shoot, RAPID_FIRE_RATE_MS);
        } else if (currentGun === 3) { // Burst Fire
            shootBurst();
        }
    }

    function handleMouseUp(event) {
         if (event.button !== 0) return; // Only react to left click release

        if (currentGun === 2) { // Stop Rapid Fire
            isShooting = false;
            clearInterval(rapidFireInterval);
        }
    }

    function shoot() {
        if (!canShoot) return;
        triggerShotEffects();
        // In this version, hit detection is handled by clicking *on* the target element itself
    }

    function shootBurst() {
        if (!canShoot) return;

        canShoot = false; // Disable shooting during burst and cooldown
        let burstCount = 0;

        function fireSingleBurst() {
            if (burstCount >= 3) {
                 // Start cooldown after burst finishes
                 clearTimeout(burstTimeout); // Clear previous if any
                 burstTimeout = setTimeout(() => { canShoot = true; }, BURST_COOLDOWN_MS);
                 return;
            }
            triggerShotEffects();
            // Again, actual hit detection is via target's mousedown event
            burstCount++;
            setTimeout(fireSingleBurst, BURST_DELAY_MS);
        }

        fireSingleBurst(); // Start the burst sequence
    }

    function triggerShotEffects() {
        // 1. Camera Shake
        gameContainer.classList.add('shake');
        setTimeout(() => gameContainer.classList.remove('shake'), 80); // Match animation duration

        // 2. Optional: Add crosshair recoil/animation here if desired
        // crosshair.style.transform = 'translate(-50%, -50%) scale(1.2)';
        // setTimeout(() => crosshair.style.transform = 'translate(-50%, -50%) scale(1)', 50);
    }

    // --- Gun Switching ---
    function switchGun(gunNumber) {
        if (gunNumber < 1 || gunNumber > 3) return;

        // Stop rapid fire if switching away from Gun 2
        if (currentGun === 2 && isShooting) {
            isShooting = false;
            clearInterval(rapidFireInterval);
        }
        // Reset burst capability immediately when switching
        canShoot = true;
        clearTimeout(burstTimeout);


        currentGun = gunNumber;
        let gunName = "";
        switch (currentGun) {
            case 1: gunName = "Manual"; break;
            case 2: gunName = "Rapid"; break;
            case 3: gunName = "Burst"; break;
        }
        gunDisplay.textContent = `Gun: ${currentGun} (${gunName})`;

        // Optional: Add gun swap animation/sound here
    }

    // --- UI Updates ---
    function updateScoreDisplay() {
        scoreDisplay.textContent = `Score: ${score}`;
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Use gameContainer for shooting clicks to avoid issues if clicking background
        gameContainer.addEventListener('mousedown', handleMouseDown);
        // Mouseup listener on document captures release even if cursor moved outside container
        document.addEventListener('mouseup', handleMouseUp);

        // Gun switching
        document.addEventListener('keydown', (event) => {
            if (event.key === '1') switchGun(1);
            if (event.key === '2') switchGun(2);
            if (event.key === '3') switchGun(3);
        });

        // Crosshair following mouse
        document.addEventListener('mousemove', (event) => {
            // Use clientX/clientY because crosshair is fixed position
            crosshair.style.left = `${event.clientX}px`;
            crosshair.style.top = `${event.clientY}px`;
        });
    }

    // --- Initialization ---
    function init() {
        console.log("Initializing Aim Trainer...");
        setupEventListeners();
        setInterval(createTarget, SPAWN_INTERVAL_MS); // Start spawning targets
        updateScoreDisplay(); // Initial score display
        switchGun(1); // Set initial gun display
        requestAnimationFrame(gameLoop); // Start the main game loop
        console.log("Game running.");
    }

    init(); // Start the game
});