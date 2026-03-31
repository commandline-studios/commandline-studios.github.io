const GameState = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

let gameState = GameState.START;
let score = 0;
let health = 3;
let gameTime = 0;
let highScore = parseInt(localStorage.getItem('spaceBallsHighScore')) || 0;
let wave = 1;
let kills = 0;
let combo = 1;
let comboTimer = 0;
let energy = 100;
let dashCooldown = 0;
let isDashing = false;
let screenShake = { x: 0, y: 0, intensity: 0 };

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0a0f);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 0);

const ambientLight = new THREE.AmbientLight(0x222233, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const gridSize = 100;
const gridDivisions = 50;

const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x00ffff, 0x1a1a2e);
gridHelper.position.y = 0;
scene.add(gridHelper);

const gridHelper2 = new THREE.GridHelper(gridSize, gridDivisions / 2, 0xff00ff, 0x1a1a2e);
gridHelper2.position.y = 0.01;
gridHelper2.material.transparent = true;
gridHelper2.material.opacity = 0.3;
scene.add(gridHelper2);

const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
const floorMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x0a0a0f,
    transparent: true,
    opacity: 0.9
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
scene.add(floor);

const boundary = 45;

const keys = { w: false, a: false, s: false, d: false, ' ': false };
const playerVelocity = new THREE.Vector3();
const playerSpeed = 18;
const dashSpeed = 80;
const friction = 0.88;
let pitch = 0;
let yaw = 0;
const mouseSensitivity = 0.002;

const touchInput = { x: 0, y: 0 };
let touchLookId = null;
let lastTouchX = 0, lastTouchY = 0;
let joystickTouchId = null;
let joystickStartX = 0, joystickStartY = 0;

const orbs = [];
const drones = [];
const projectiles = [];
const enemyProjectiles = [];
const particles = [];

let speedBoostActive = false;
let speedBoostTimer = 0;
let freezeDronesActive = false;
let freezeDronesTimer = 0;
let invincibleTimer = 0;
let lastSurvivalBonus = 0;

let shieldActive = false;
let shieldTimer = 0;
let magnetActive = false;
let magnetTimer = 0;
let currentWeapon = 'normal';
let weaponTimer = 0;

let totalShots = 0;
let totalHits = 0;
let highestCombo = 1;
let highestWave = 1;
let totalKills = 0;
let gamesPlayed = 0;

const achievements = {
    firstBlood: { name: 'First Blood', desc: 'Get your first kill', unlocked: false, icon: '!' },
    comboMaster: { name: 'Combo Master', desc: 'Reach x5 combo', unlocked: false, icon: 'x' },
    waveSurvivor5: { name: 'Survivor', desc: 'Reach wave 5', unlocked: false, icon: 'W' },
    waveSurvivor10: { name: 'Veteran', desc: 'Reach wave 10', unlocked: false, icon: 'V' },
    sharpshooter: { name: 'Sharpshooter', desc: 'Achieve 80% accuracy', unlocked: false, icon: 'S' },
    bossKiller: { name: 'Boss Killer', desc: 'Defeat a boss', unlocked: false, icon: 'B' },
    hundredKills: { name: 'Century', desc: 'Get 100 kills', unlocked: false, icon: 'C' },
    scoreChaser: { name: 'Score Chaser', desc: 'Reach 10,000 points', unlocked: false, icon: '$' }
};

function loadStats() {
    const saved = localStorage.getItem('spaceBallsStats');
    if (saved) {
        const data = JSON.parse(saved);
        totalKills = data.totalKills || 0;
        gamesPlayed = data.gamesPlayed || 0;
        highestWave = data.highestWave || 1;
        highestCombo = data.highestCombo || 1;
        const savedAchievements = data.achievements || {};
        for (let key in savedAchievements) {
            if (achievements[key]) achievements[key].unlocked = savedAchievements[key];
        }
    }
}

function saveStats() {
    const savedAchievements = {};
    for (let key in achievements) {
        savedAchievements[key] = achievements[key].unlocked;
    }
    localStorage.setItem('spaceBallsStats', JSON.stringify({
        totalKills,
        gamesPlayed,
        highestWave,
        highestCombo,
        achievements: savedAchievements
    }));
}

function checkAchievements() {
    if (kills >= 1 && !achievements.firstBlood.unlocked) {
        achievements.firstBlood.unlocked = true;
        showAchievement('firstBlood');
    }
    if (combo >= 5 && !achievements.comboMaster.unlocked) {
        achievements.comboMaster.unlocked = true;
        showAchievement('comboMaster');
    }
    if (wave >= 5 && !achievements.waveSurvivor5.unlocked) {
        achievements.waveSurvivor5.unlocked = true;
        showAchievement('waveSurvivor5');
    }
    if (wave >= 10 && !achievements.waveSurvivor10.unlocked) {
        achievements.waveSurvivor10.unlocked = true;
        showAchievement('waveSurvivor10');
    }
    if (totalShots > 0 && totalHits / totalShots >= 0.8 && !achievements.sharpshooter.unlocked) {
        achievements.sharpshooter.unlocked = true;
        showAchievement('sharpshooter');
    }
    if (totalKills >= 100 && !achievements.hundredKills.unlocked) {
        achievements.hundredKills.unlocked = true;
        showAchievement('hundredKills');
    }
    if (score >= 10000 && !achievements.scoreChaser.unlocked) {
        achievements.scoreChaser.unlocked = true;
        showAchievement('scoreChaser');
    }
    saveStats();
}

function showAchievement(key) {
    const ach = achievements[key];
    const notification = document.getElementById('achievementNotification');
    notification.innerHTML = `<div class="ach-icon">${ach.icon}</div><div class="ach-text"><div class="ach-name">${ach.name}</div><div class="ach-desc">${ach.desc}</div></div>`;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
    if (sounds.powerup) sounds.powerup();
}

function triggerNuke() {
    spawnParticles(camera.position.clone(), 0xff0000, 100, 0.5);
    triggerScreenShake(1, 1);
    
    for (let i = drones.length - 1; i >= 0; i--) {
        const drone = drones[i];
        score += drone.userData.points * combo;
        kills++;
        totalKills++;
        spawnParticles(drone.position.clone(), drone.children[0].material.color.getHex(), 30, 0.3);
        scene.remove(drone);
        drones.splice(i, 1);
    }
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        scene.remove(projectiles[i]);
        projectiles.splice(i, 1);
    }
    
    updateScoreDisplay();
    updateWaveDisplay();
    if (sounds.explosion) sounds.explosion();
}

const sounds = {
    shoot: null,
    collect: null,
    damage: null,
    powerup: null,
    explosion: null
};

function initSounds() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const audioCtx = new AudioContext();
    
    sounds.shoot = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    };
    
    sounds.collect = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    };
    
    sounds.damage = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    };
    
    sounds.powerup = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    };
    
    sounds.explosion = () => {
        const bufferSize = audioCtx.sampleRate * 0.3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        noise.start();
    };
}

initSounds();
loadStats();

function detectTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
}

if (detectTouchDevice()) {
    document.body.classList.add('touch-enabled');
}

function createOrb() {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.8,
        metalness: 0.8,
        roughness: 0.2
    });
    const orb = new THREE.Mesh(geometry, material);
    
    const light = new THREE.PointLight(0xffff00, 1.5, 12);
    orb.add(light);
    
    orb.position.set(
        (Math.random() - 0.5) * 70,
        1.5,
        (Math.random() - 0.5) * 70
    );
    orb.userData.baseY = orb.position.y;
    orb.userData.phase = Math.random() * Math.PI * 2;
    orb.userData.rotationSpeed = 0.02 + Math.random() * 0.02;
    
    scene.add(orb);
    orbs.push(orb);
}

function createPowerUp(type) {
    const geometry = type === 'health' ? new THREE.IcosahedronGeometry(0.5, 0) : new THREE.OctahedronGeometry(0.5, 0);
    let color;
    switch(type) {
        case 'speed': color = 0x00ff00; break;
        case 'freeze': color = 0x0088ff; break;
        case 'energy': color = 0xff8800; break;
        case 'shield': color = 0x00ffff; break;
        case 'nuke': color = 0xff0000; break;
        case 'magnet': color = 0xff00ff; break;
        case 'health': color = 0x00ff00; break;
        case 'spread': color = 0xffaa00; break;
        case 'pierce': color = 0x00aaff; break;
        case 'rapid': color = 0xff5500; break;
        default: color = 0xff8800;
    }
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.8,
        metalness: 0.8,
        roughness: 0.2
    });
    const powerUp = new THREE.Mesh(geometry, material);
    
    const light = new THREE.PointLight(color, 1.5, 10);
    powerUp.add(light);
    
    powerUp.position.set(
        (Math.random() - 0.5) * 70,
        1.5,
        (Math.random() - 0.5) * 70
    );
    powerUp.userData.type = type;
    powerUp.userData.baseY = powerUp.position.y;
    powerUp.userData.phase = Math.random() * Math.PI * 2;
    powerUp.userData.rotationSpeed = 0.03;
    
    scene.add(powerUp);
    orbs.push(powerUp);
}

function createDroppedOrb(position, type) {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const color = type === 'energy' ? 0xff8800 : 0xffff00;
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.8,
        metalness: 0.8,
        roughness: 0.2
    });
    const orb = new THREE.Mesh(geometry, material);
    
    const light = new THREE.PointLight(color, 1.5, 12);
    orb.add(light);
    
    orb.position.copy(position);
    orb.position.y = 1.5;
    orb.userData.baseY = orb.position.y;
    orb.userData.phase = Math.random() * Math.PI * 2;
    orb.userData.rotationSpeed = 0.02 + Math.random() * 0.02;
    orb.userData.type = type;
    
    scene.add(orb);
    return orb;
}

function createDrone(type = 'normal') {
    const group = new THREE.Group();
    
    const config = {
        normal: { color: 0xff3333, emissive: 0xff3333, scale: 1, speed: 8, health: 1, points: 100 },
        fast: { color: 0xff8800, emissive: 0xff8800, scale: 0.7, speed: 14, health: 1, points: 150 },
        tank: { color: 0x8800ff, emissive: 0x8800ff, scale: 1.5, speed: 5, health: 3, points: 300 },
        boss: { color: 0xff0000, emissive: 0xff0000, scale: 3, speed: 4, health: 10, points: 1000 }
    };
    
    const c = config[type];
    
    const bodyGeom = new THREE.SphereGeometry(c.scale, 24, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: c.color,
        emissive: c.emissive,
        emissiveIntensity: 0.7,
        metalness: 0.9,
        roughness: 0.1
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);
    
    const ringCount = type === 'boss' ? 3 : 1;
    for (let i = 0; i < ringCount; i++) {
        const ringGeom = new THREE.TorusGeometry(c.scale * 1.4 + i * 0.3, 0.12, 8, 32);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2 + i * 0.3;
        ring.userData.offset = i;
        group.add(ring);
    }
    
    const light = new THREE.PointLight(c.color, 2, 20);
    group.add(light);
    
    group.position.set(
        (Math.random() - 0.5) * 50,
        1 + Math.random() * 0.5,
        (Math.random() - 0.5) * 50
    );
    
    group.userData.type = type;
    group.userData.health = c.health;
    group.userData.maxHealth = c.health;
    group.userData.speed = c.speed;
    group.userData.points = c.points;
    group.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(c.speed);
    group.userData.waypoint = new THREE.Vector3(
        (Math.random() - 0.5) * 70,
        1,
        (Math.random() - 0.5) * 70
    );
    group.userData.rotationPhase = 0;
    group.userData.attackTimer = 0;
    group.userData.lastShot = 0;
    group.userData.isHit = false;
    group.userData.hitFlashTimer = 0;
    
    scene.add(group);
    drones.push(group);
}

function createProjectile() {
    const energyCost = currentWeapon === 'rapid' ? 8 : 15;
    if (energy < energyCost) return;
    
    energy -= energyCost;
    if (sounds.shoot) sounds.shoot();
    
    let color = 0x00ffff;
    if (currentWeapon === 'spread') color = 0xffaa00;
    if (currentWeapon === 'pierce') color = 0x00aaff;
    if (currentWeapon === 'rapid') color = 0xff5500;
    
    const geometry = new THREE.SphereGeometry(0.2, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1,
        metalness: 1,
        roughness: 0
    });
    
    const createSingleProjectile = (direction, pierceCount = 0) => {
        const projectile = new THREE.Mesh(geometry.clone(), material.clone());
        const light = new THREE.PointLight(color, 2, 8);
        projectile.add(light);
        projectile.position.copy(camera.position);
        projectile.userData.velocity = direction.clone().normalize().multiplyScalar(80);
        projectile.userData.life = 3;
        projectile.userData.pierceCount = pierceCount;
        scene.add(projectile);
        projectiles.push(projectile);
    };
    
    const baseDirection = new THREE.Vector3(0, 0, -1);
    baseDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    
    totalShots++;
    
    if (currentWeapon === 'spread') {
        const angles = [-0.15, 0, 0.15];
        angles.forEach(angle => {
            const dir = baseDirection.clone();
            dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            createSingleProjectile(dir);
        });
    } else if (currentWeapon === 'pierce') {
        createSingleProjectile(baseDirection, 3);
    } else {
        createSingleProjectile(baseDirection);
    }
    
    document.getElementById('crosshair').classList.add('shooting');
    setTimeout(() => {
        document.getElementById('crosshair').classList.remove('shooting');
    }, 100);
}

function createParticle(position, color, size = 0.15) {
    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1
    });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(position);
    particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        Math.random() * 8,
        (Math.random() - 0.5) * 15
    );
    particle.userData.life = 1;
    
    scene.add(particle);
    particles.push(particle);
}

function spawnParticles(position, color, count = 20, size = 0.15) {
    for (let i = 0; i < count; i++) {
        createParticle(position, color, size * (0.5 + Math.random()));
    }
}

function createDroneProjectile(startPos, targetPos) {
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1,
        metalness: 1,
        roughness: 0
    });
    const projectile = new THREE.Mesh(geometry, material);
    
    const light = new THREE.PointLight(0xff0000, 2, 8);
    projectile.add(light);
    
    const direction = targetPos.clone().sub(startPos).normalize();
    
    projectile.position.copy(startPos);
    projectile.userData.velocity = direction.multiplyScalar(25);
    projectile.userData.life = 5;
    
    scene.add(projectile);
    enemyProjectiles.push(projectile);
}

function triggerScreenShake(intensity, duration = 0.3) {
    screenShake.intensity = intensity;
    setTimeout(() => {
        screenShake.intensity = 0;
    }, duration * 1000);
}

function takeDamage() {
    if (invincibleTimer > 0) return;
    
    if (shieldActive) {
        shieldActive = false;
        shieldTimer = 0;
        spawnParticles(camera.position.clone(), 0x00ffff, 30, 0.2);
        triggerScreenShake(0.3, 0.2);
        updatePowerUpIndicator();
        if (sounds.powerup) sounds.powerup();
        return;
    }
    
    health--;
    invincibleTimer = 1.5;
    updateHealthDisplay();
    triggerScreenShake(0.5, 0.2);
    
    if (sounds.damage) sounds.damage();
    
    const overlay = document.getElementById('damageOverlay');
    overlay.style.opacity = '1';
    setTimeout(() => overlay.style.opacity = '0', 200);
    
    if (health <= 0) {
        gameOver();
    }
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.velocity.y -= 20 * delta;
        p.position.add(p.userData.velocity.clone().multiplyScalar(delta));
        p.userData.life -= delta * 1.5;
        p.material.opacity = p.userData.life;
        p.scale.multiplyScalar(0.98);
        
        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

function spawnWave() {
    const waveAnnounce = document.getElementById('waveAnnounce');
    waveAnnounce.textContent = `WAVE ${wave}`;
    waveAnnounce.style.opacity = '1';
    waveAnnounce.style.transform = 'translate(-50%, -50%) scale(1.2)';
    
    setTimeout(() => {
        waveAnnounce.style.opacity = '0';
        waveAnnounce.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }, 2000);
    
    let droneCount = 3 + Math.floor(wave * 1.5);
    let bossWave = wave % 5 === 0;
    
    if (bossWave) {
        const warning = document.getElementById('bossWarning');
        warning.classList.remove('hidden');
        setTimeout(() => warning.classList.add('hidden'), 3000);
        droneCount = Math.floor(droneCount / 2);
    }
    
    setTimeout(() => {
        for (let i = 0; i < droneCount; i++) {
            let type = 'normal';
            if (wave >= 3 && Math.random() < 0.3) type = 'fast';
            if (wave >= 5 && Math.random() < 0.2) type = 'tank';
            if (bossWave && i === 0) type = 'boss';
            
            setTimeout(() => createDrone(type), i * 500);
        }
    }, 1000);
    
    updateWaveDisplay();
}

for (let i = 0; i < 5; i++) createOrb();

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    
    if (key === 'escape' && gameState === GameState.PLAYING) {
        gameState = GameState.PAUSED;
        document.exitPointerLock();
        document.getElementById('pauseScreen').classList.remove('hidden');
    } else if (key === 'escape' && gameState === GameState.PAUSED) {
        gameState = GameState.PLAYING;
        canvas.requestPointerLock();
        document.getElementById('pauseScreen').classList.add('hidden');
    }
    
    if (key === ' ' && gameState === GameState.PLAYING && dashCooldown <= 0) {
        isDashing = true;
        dashCooldown = 2;
        
        const direction = new THREE.Vector3();
        if (keys.w) direction.z -= 1;
        if (keys.s) direction.z += 1;
        if (keys.a) direction.x -= 1;
        if (keys.d) direction.x += 1;
        direction.normalize();
        
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        
        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(forward, -direction.z);
        moveDir.addScaledVector(right, direction.x);
        
        if (moveDir.length() < 0.1) moveDir.copy(forward);
        
        playerVelocity.copy(moveDir.normalize().multiplyScalar(dashSpeed));
        
        spawnParticles(camera.position.clone(), 0x00ffff, 15);
        triggerScreenShake(0.3, 0.15);
        
        setTimeout(() => isDashing = false, 150);
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

document.addEventListener('mousemove', (e) => {
    if (gameState !== GameState.PLAYING || document.pointerLockElement !== canvas) return;
    
    yaw -= e.movementX * mouseSensitivity;
    pitch -= e.movementY * mouseSensitivity;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
});

canvas.addEventListener('mousedown', (e) => {
    if (gameState !== GameState.PLAYING) return;
    if (e.target !== canvas) return;
    
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    } else if (e.button === 0) {
        createProjectile();
    }
});

const joystickArea = document.getElementById('joystickArea');
const joystickKnob = document.getElementById('joystickKnob');
const shootArea = document.getElementById('shootArea');
const dashBtn = document.getElementById('dashBtn');

joystickArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    const rect = joystickArea.getBoundingClientRect();
    joystickStartX = rect.left + rect.width / 2;
    joystickStartY = rect.top + rect.height / 2;
});

joystickArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let touch of e.changedTouches) {
        if (touch.identifier === joystickTouchId) {
            let dx = touch.clientX - joystickStartX;
            let dy = touch.clientY - joystickStartY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 35;
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            touchInput.x = dx / maxDist;
            touchInput.y = dy / maxDist;
        }
    }
});

joystickArea.addEventListener('touchend', (e) => {
    for (let touch of e.changedTouches) {
        if (touch.identifier === joystickTouchId) {
            joystickTouchId = null;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
            touchInput.x = 0;
            touchInput.y = 0;
        }
    }
});

shootArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === GameState.PLAYING) {
        createProjectile();
    }
});

dashBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === GameState.PLAYING && dashCooldown <= 0) {
        isDashing = true;
        dashCooldown = 2;
        
        const moveDir = new THREE.Vector3(touchInput.x, 0, touchInput.y);
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const right = new THREE.Vector3(1, 0, 0);
        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        
        const dashDir = new THREE.Vector3();
        dashDir.addScaledVector(forward, -touchInput.y);
        dashDir.addScaledVector(right, touchInput.x);
        
        if (dashDir.length() < 0.1) dashDir.copy(forward);
        
        playerVelocity.copy(dashDir.normalize().multiplyScalar(dashSpeed));
        spawnParticles(camera.position.clone(), 0x00ffff, 15);
        triggerScreenShake(0.3, 0.15);
        
        setTimeout(() => isDashing = false, 150);
    }
});

canvas.addEventListener('touchstart', (e) => {
    if (gameState === GameState.PLAYING && e.touches.length === 1) {
        const touch = e.touches[0];
        if (touch.clientX > window.innerWidth * 0.3) {
            touchLookId = touch.identifier;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (gameState === GameState.PLAYING) {
        for (let touch of e.changedTouches) {
            if (touch.identifier === touchLookId) {
                const dx = touch.clientX - lastTouchX;
                const dy = touch.clientY - lastTouchY;
                yaw -= dx * 0.005;
                pitch -= dy * 0.005;
                pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
            }
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    for (let touch of e.changedTouches) {
        if (touch.identifier === touchLookId) {
            touchLookId = null;
        }
    }
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

function startGame() {
    score = 0;
    health = 3;
    gameTime = 0;
    wave = 1;
    kills = 0;
    combo = 1;
    comboTimer = 0;
    energy = 100;
    dashCooldown = 0;
    speedBoostActive = false;
    freezeDronesActive = false;
    shieldActive = false;
    shieldTimer = 0;
    magnetActive = false;
    magnetTimer = 0;
    currentWeapon = 'normal';
    weaponTimer = 0;
    totalShots = 0;
    totalHits = 0;
    
    camera.position.set(0, 2, 0);
    playerVelocity.set(0, 0, 0);
    pitch = 0;
    yaw = 0;
    lastSurvivalBonus = 0;
    invincibleTimer = 0;
    
    gamesPlayed++;
    
    orbs.forEach(orb => scene.remove(orb));
    orbs.length = 0;
    drones.forEach(drone => scene.remove(drone));
    drones.length = 0;
    projectiles.forEach(p => scene.remove(p));
    projectiles.length = 0;
    enemyProjectiles.forEach(p => scene.remove(p));
    enemyProjectiles.length = 0;
    particles.forEach(p => scene.remove(p));
    particles.length = 0;
    
    for (let i = 0; i < 5; i++) createOrb();
    
    updateHealthDisplay();
    updateScoreDisplay();
    updateTimerDisplay();
    updateWaveDisplay();
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) {
        document.getElementById('crosshair').classList.remove('hidden');
        canvas.requestPointerLock();
    }
    
    gameState = GameState.PLAYING;
    
    setTimeout(spawnWave, 1000);
}

function gameOver() {
    gameState = GameState.GAME_OVER;
    document.exitPointerLock();
    
    if (wave > highestWave) highestWave = wave;
    saveStats();
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('spaceBallsHighScore', highScore);
    }
    
    const accuracy = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0;
    
    document.getElementById('finalScore').textContent = `SCORE: ${score}`;
    document.getElementById('highScore').textContent = `HIGH SCORE: ${highScore}`;
    document.getElementById('waveReached').textContent = `WAVE REACHED: ${wave}`;
    document.getElementById('gameStats').innerHTML = `
        <div class="stat-row"><span>KILLS:</span> ${kills}</div>
        <div class="stat-row"><span>MAX COMBO:</span> x${highestCombo}</div>
        <div class="stat-row"><span>ACCURACY:</span> ${accuracy}%</div>
        <div class="stat-row"><span>TIME:</span> ${document.getElementById('timer').textContent}</div>
    `;
    
    let unlockedAch = Object.values(achievements).filter(a => a.unlocked);
    document.getElementById('achievementSummary').innerHTML = unlockedAch.length > 0 
        ? `<div class="ach-list">${unlockedAch.map(a => `<div class="ach-badge" title="${a.name}: ${a.desc}">${a.icon}</div>`).join('')}</div>` 
        : '<div class="no-achs">No achievements unlocked</div>';
    
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('crosshair').classList.add('hidden');
}

function updateHealthDisplay() {
    const hearts = document.querySelectorAll('.heart');
    hearts.forEach((heart, i) => {
        heart.classList.toggle('lost', i >= health);
    });
}

function updateScoreDisplay() {
    document.getElementById('score').textContent = `SCORE: ${score}`;
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateWaveDisplay() {
    document.getElementById('wave').textContent = `WAVE ${wave}`;
    document.getElementById('kills').textContent = `KILLS: ${kills}`;
}

function updateComboDisplay() {
    const comboEl = document.getElementById('combo');
    if (combo > 1) {
        comboEl.textContent = `x${combo} COMBO`;
        comboEl.classList.add('active');
    } else {
        comboEl.classList.remove('active');
    }
}

function updatePowerUpIndicator() {
    const indicator = document.getElementById('powerupIndicator');
    let activePower = null;
    let color = '#00ff00';
    
    if (speedBoostActive) {
        activePower = 'SPEED BOOST!';
        color = '#00ff00';
    } else if (freezeDronesActive) {
        activePower = 'DRONES FROZEN!';
        color = '#0088ff';
    } else if (shieldActive) {
        activePower = 'SHIELD ACTIVE!';
        color = '#00ffff';
    } else if (magnetActive) {
        activePower = 'MAGNET ACTIVE!';
        color = '#ff00ff';
    } else if (currentWeapon !== 'normal') {
        activePower = `${currentWeapon.toUpperCase()} WEAPON!`;
        color = currentWeapon === 'spread' ? '#ffaa00' : (currentWeapon === 'pierce' ? '#00aaff' : '#ff5500');
    }
    
    if (activePower) {
        indicator.textContent = activePower;
        indicator.style.color = color;
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
}

function updateEnergyDisplay() {
    document.getElementById('energyFill').style.width = `${energy}%`;
}

function updateDashDisplay() {
    const dashReady = document.getElementById('dashReady');
    dashReady.classList.toggle('cooldown', dashCooldown > 0);
    const touchDashBtn = document.getElementById('dashBtn');
    touchDashBtn.classList.toggle('cooldown', dashCooldown > 0);
}

let lastTime = performance.now();
let waveSpawned = false;

function update() {
    const now = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    
    if (gameState !== GameState.PLAYING) {
        renderer.render(scene, camera);
        requestAnimationFrame(update);
        return;
    }
    
    if (screenShake.intensity > 0) {
        screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
        screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    } else {
        screenShake.x = 0;
        screenShake.y = 0;
    }
    
    gameTime += delta;
    
    if (dashCooldown > 0) dashCooldown -= delta;
    updateDashDisplay();
    
    if (energy < 100) energy += delta * 15;
    updateEnergyDisplay();
    
    if (comboTimer > 0) {
        comboTimer -= delta;
        if (comboTimer <= 0) {
            combo = 1;
            updateComboDisplay();
        }
    }
    
    updateTimerDisplay();
    
    if (gameTime - lastSurvivalBonus >= 30) {
        lastSurvivalBonus = Math.floor(gameTime / 30) * 30;
        score += 50;
        updateScoreDisplay();
    }
    
    if (invincibleTimer > 0) {
        invincibleTimer -= delta;
        document.getElementById('invincibleOverlay').style.opacity = '1';
    } else {
        document.getElementById('invincibleOverlay').style.opacity = '0';
    }
    
    if (shieldActive) {
        document.getElementById('shieldOverlay').style.opacity = '1';
    } else {
        document.getElementById('shieldOverlay').style.opacity = '0';
    }
    
    if (speedBoostActive) {
        speedBoostTimer -= delta;
        if (speedBoostTimer <= 0) {
            speedBoostActive = false;
            updatePowerUpIndicator();
        }
    }
    
    if (freezeDronesActive) {
        freezeDronesTimer -= delta;
        if (freezeDronesTimer <= 0) {
            freezeDronesActive = false;
            updatePowerUpIndicator();
        }
    }
    
    if (shieldActive) {
        shieldTimer -= delta;
        if (shieldTimer <= 0) {
            shieldActive = false;
            updatePowerUpIndicator();
        }
    }
    
    if (magnetActive) {
        magnetTimer -= delta;
        if (magnetTimer <= 0) {
            magnetActive = false;
            updatePowerUpIndicator();
        }
    }
    
    if (weaponTimer > 0) {
        weaponTimer -= delta;
        if (weaponTimer <= 0) {
            currentWeapon = 'normal';
            updatePowerUpIndicator();
        }
    }
    
    const moveSpeed = playerSpeed * (speedBoostActive ? 2 : 1);
    const direction = new THREE.Vector3();
    
    if (keys.w) direction.z -= 1;
    if (keys.s) direction.z += 1;
    if (keys.a) direction.x -= 1;
    if (keys.d) direction.x += 1;
    
    if (direction.length() === 0 && (touchInput.x !== 0 || touchInput.y !== 0)) {
        direction.x = touchInput.x;
        direction.z = touchInput.y;
    }
    
    direction.normalize();
    
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    
    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, -direction.z);
    moveDir.addScaledVector(right, direction.x);
    
    if (!isDashing) {
        playerVelocity.add(moveDir.multiplyScalar(moveSpeed * delta * 10));
        playerVelocity.multiplyScalar(friction);
    }
    
    camera.position.add(playerVelocity.clone().multiplyScalar(delta));
    
    camera.position.x = Math.max(-boundary, Math.min(boundary, camera.position.x));
    camera.position.z = Math.max(-boundary, Math.min(boundary, camera.position.z));
    camera.position.y = 2;
    
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    
    const time = now * 0.001;
    
    orbs.forEach((orb, index) => {
        if (orb.userData.type) {
            orb.position.y = orb.userData.baseY + Math.sin(time * 2 + orb.userData.phase) * 0.3;
            orb.rotation.y += orb.userData.rotationSpeed * 2;
            orb.rotation.x += orb.userData.rotationSpeed;
        } else {
            orb.position.y = orb.userData.baseY + Math.sin(time * 3 + orb.userData.phase) * 0.2;
            orb.rotation.y += orb.userData.rotationSpeed;
        }
        
        let dist = camera.position.distanceTo(orb.position);
        if (magnetActive && orb.userData.type !== 'shield' && orb.userData.type !== 'nuke') {
            const toPlayer = camera.position.clone().sub(orb.position);
            orb.position.add(toPlayer.normalize().multiplyScalar(delta * 20));
            dist = camera.position.distanceTo(orb.position);
        }
        
        if (dist < 1.5) {
            let points = 10;
            
            if (orb.userData.type === 'speed') {
                speedBoostActive = true;
                speedBoostTimer = 5;
                updatePowerUpIndicator();
                spawnParticles(orb.position.clone(), 0x00ff00, 15, 0.2);
                if (sounds.powerup) sounds.powerup();
            } else if (orb.userData.type === 'freeze') {
                freezeDronesActive = true;
                freezeDronesTimer = 5;
                updatePowerUpIndicator();
                spawnParticles(orb.position.clone(), 0x0088ff, 15, 0.2);
                if (sounds.powerup) sounds.powerup();
            } else if (orb.userData.type === 'energy') {
                energy = Math.min(100, energy + 30);
                spawnParticles(orb.position.clone(), 0xff8800, 15, 0.2);
                if (sounds.collect) sounds.collect();
            } else if (orb.userData.type === 'shield') {
                shieldActive = true;
                shieldTimer = 10;
                updatePowerUpIndicator();
                spawnParticles(orb.position.clone(), 0x00ffff, 20, 0.2);
                if (sounds.powerup) sounds.powerup();
            } else if (orb.userData.type === 'nuke') {
                triggerNuke();
            } else if (orb.userData.type === 'magnet') {
                magnetActive = true;
                magnetTimer = 8;
                updatePowerUpIndicator();
                spawnParticles(orb.position.clone(), 0xff00ff, 20, 0.2);
                if (sounds.powerup) sounds.powerup();
            } else if (orb.userData.type === 'health') {
                health = Math.min(3, health + 1);
                updateHealthDisplay();
                spawnParticles(orb.position.clone(), 0x00ff00, 20, 0.2);
                if (sounds.powerup) sounds.powerup();
            } else if (orb.userData.type === 'spread' || orb.userData.type === 'pierce' || orb.userData.type === 'rapid') {
                currentWeapon = orb.userData.type;
                weaponTimer = 10;
                updatePowerUpIndicator();
                let weaponColor = orb.userData.type === 'spread' ? 0xffaa00 : (orb.userData.type === 'pierce' ? 0x00aaff : 0xff5500);
                spawnParticles(orb.position.clone(), weaponColor, 20, 0.2);
                if (sounds.powerup) sounds.powerup();
            } else {
                comboTimer = 2;
                combo = Math.min(combo + 1, 10);
                highestCombo = Math.max(highestCombo, combo);
                if (combo >= 5) checkAchievements();
                updateComboDisplay();
                
                points *= combo;
                spawnParticles(orb.position.clone(), 0xffff00, 20);
                
                if (Math.random() < 0.2) {
                    const rand = Math.random();
                    const types = ['speed', 'freeze', 'energy', 'shield', 'magnet', 'health', 'spread', 'pierce', 'rapid', 'nuke'];
                    const weights = [0.15, 0.15, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05];
                    let r = Math.random();
                    let cumulative = 0;
                    let selected = types[0];
                    for (let i = 0; i < types.length; i++) {
                        cumulative += weights[i];
                        if (r < cumulative) {
                            selected = types[i];
                            break;
                        }
                    }
                    createPowerUp(selected);
                }
                
                if (orbs.length < 8) createOrb();
            }
            
            score += points;
            if (score >= 10000) checkAchievements();
            if (sounds.collect) sounds.collect();
            updateScoreDisplay();
            
            scene.remove(orb);
            orbs.splice(index, 1);
        }
    });
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.position.add(proj.userData.velocity.clone().multiplyScalar(delta));
        proj.userData.life -= delta;
        
        let hitDrone = false;
        for (let j = drones.length - 1; j >= 0; j--) {
            const drone = drones[j];
            const hitRadius = drone.userData.type === 'boss' ? 3 : 1.5;
            if (proj.position.distanceTo(drone.position) < hitRadius) {
                drone.userData.health--;
                drone.userData.hitFlashTimer = 0.15;
                totalHits++;
                
                if (drone.children[0] && drone.children[0].material) {
                    drone.children[0].material.emissiveIntensity = 2;
                }
                
                let projColor = 0x00ffff;
                if (currentWeapon === 'spread') projColor = 0xffaa00;
                if (currentWeapon === 'pierce') projColor = 0x00aaff;
                if (currentWeapon === 'rapid') projColor = 0xff5500;
                spawnParticles(proj.position.clone(), projColor, 10);
                
                if (drone.userData.health <= 0) {
                    score += drone.userData.points * combo;
                    kills++;
                    totalKills++;
                    if (kills === 1) checkAchievements();
                    if (totalKills >= 100) checkAchievements();
                    
                    if (score >= 10000) checkAchievements();
                    updateScoreDisplay();
                    updateWaveDisplay();
                    
                    if (sounds.explosion) sounds.explosion();
                    
                    if (drone.userData.type === 'boss' && !achievements.bossKiller.unlocked) {
                        achievements.bossKiller.unlocked = true;
                        showAchievement('bossKiller');
                    }
                    
                    const particleCount = drone.userData.type === 'boss' ? 50 : 25;
                    const particleSize = drone.userData.type === 'boss' ? 0.4 : 0.2;
                    spawnParticles(drone.position.clone(), drone.children[0].material.color.getHex(), particleCount, particleSize);
                    triggerScreenShake(drone.userData.type === 'boss' ? 1 : 0.3, drone.userData.type === 'boss' ? 0.5 : 0.2);
                    
                    if (drone.userData.type !== 'boss') {
                        const energyOrb = createDroppedOrb(drone.position.clone(), 'energy');
                        orbs.push(energyOrb);
                    }
                    
                    scene.remove(drone);
                    drones.splice(j, 1);
                }
                
                if (proj.userData.pierceCount !== undefined && proj.userData.pierceCount > 0) {
                    proj.userData.pierceCount--;
                    hitDrone = false;
                } else {
                    hitDrone = true;
                    break;
                }
            }
        }
        
        if (hitDrone) {
            scene.remove(proj);
            projectiles.splice(i, 1);
            continue;
        }
        
        if (proj.userData.life <= 0 || 
            Math.abs(proj.position.x) > boundary + 10 || 
            Math.abs(proj.position.z) > boundary + 10) {
            scene.remove(proj);
            projectiles.splice(i, 1);
        }
    }
    
    drones.forEach((drone) => {
        if (!freezeDronesActive) {
            const toPlayer = camera.position.clone().sub(drone.position);
            toPlayer.y = 0;
            const distToPlayer = toPlayer.length();
            
            if (distToPlayer < 25 && drone.userData.type !== 'boss') {
                toPlayer.normalize();
                drone.userData.velocity.lerp(toPlayer.multiplyScalar(drone.userData.speed), 0.03);
            } else {
                const toWaypoint = drone.userData.waypoint.clone().sub(drone.position);
                const distToWaypoint = toWaypoint.length();
                
                if (distToWaypoint < 5) {
                    drone.userData.waypoint.set(
                        (Math.random() - 0.5) * 70,
                        1,
                        (Math.random() - 0.5) * 70
                    );
                }
                
                toWaypoint.normalize();
                drone.userData.velocity.lerp(toWaypoint.multiplyScalar(drone.userData.speed), 0.02);
            }
            
            drone.position.add(drone.userData.velocity.clone().multiplyScalar(delta));
            drone.position.x = Math.max(-boundary, Math.min(boundary, drone.position.x));
            drone.position.z = Math.max(-boundary, Math.min(boundary, drone.position.z));
        }
        
        drone.userData.rotationPhase += delta * 2;
        drone.children.forEach((child, i) => {
            if (child.geometry && child.geometry.type === 'TorusGeometry') {
                child.rotation.z = drone.userData.rotationPhase * (child.userData.offset + 1);
            }
            if (drone.userData.hitFlashTimer > 0) {
                drone.userData.hitFlashTimer -= delta;
                if (drone.userData.hitFlashTimer <= 0 && child.material) {
                    child.material.emissiveIntensity = 0.7;
                }
            }
        });
        
        if (drone.userData.type === 'boss' && !freezeDronesActive) {
            drone.userData.lastShot += delta;
            if (drone.userData.lastShot > 2) {
                drone.userData.lastShot = 0;
                createDroneProjectile(drone.position.clone(), camera.position.clone());
            }
        }
        
        const dist = camera.position.distanceTo(drone.position);
        const hitRadius = drone.userData.type === 'boss' ? 4 : (drone.userData.type === 'tank' ? 2.5 : 2);
        
        if (dist < hitRadius) {
            takeDamage();
            
            const pushDir = drone.position.clone().sub(camera.position).normalize();
            drone.position.add(pushDir.multiplyScalar(10));
            drone.userData.waypoint.copy(drone.position);
        }
    });
    
    if (drones.length === 0 && !waveSpawned) {
        waveSpawned = true;
        wave++;
        if (wave >= 5) checkAchievements();
        if (wave >= 10) checkAchievements();
        setTimeout(() => {
            spawnWave();
            waveSpawned = false;
        }, 3000);
    }
    
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i];
        proj.position.add(proj.userData.velocity.clone().multiplyScalar(delta));
        proj.userData.life -= delta;
        
        if (proj.position.distanceTo(camera.position) < 1.5) {
            takeDamage();
            spawnParticles(proj.position.clone(), 0xff0000, 15, 0.2);
            scene.remove(proj);
            enemyProjectiles.splice(i, 1);
            continue;
        }
        
        if (proj.userData.life <= 0 || 
            Math.abs(proj.position.x) > boundary + 10 || 
            Math.abs(proj.position.z) > boundary + 10) {
            scene.remove(proj);
            enemyProjectiles.splice(i, 1);
        }
    }
    
    updateParticles(delta);
    
    camera.position.x += screenShake.x;
    camera.position.y += screenShake.y;
    
    renderer.render(scene, camera);
    
    camera.position.x -= screenShake.x;
    camera.position.y -= screenShake.y;
    
    requestAnimationFrame(update);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

update();
