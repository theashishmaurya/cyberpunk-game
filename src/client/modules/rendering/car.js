import * as THREE from 'three';

// Car colors for different players
const CAR_COLORS = [
  0xff0000, // Red
  0x00ff00, // Green
  0x0000ff, // Blue
  0xffff00, // Yellow
  0xff00ff, // Magenta
  0x00ffff, // Cyan
  0xff8800, // Orange
  0x8800ff  // Purple
];

/**
 * Create a flying car model
 * @param {number} [colorIndex=null] - Optional color index
 * @returns {THREE.Group} - The car model object
 */
export async function createCarModel(colorIndex = null) {
  // Create car group
  const carGroup = new THREE.Group();
  
  // Determine car color
  const color = colorIndex !== null ? 
    CAR_COLORS[colorIndex % CAR_COLORS.length] : 
    CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  
  // Create car body
  const bodyGeometry = new THREE.BoxGeometry(8, 2, 16);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.8,
    roughness: 0.2,
    emissive: color,
    emissiveIntensity: 0.2
  });
  
  const carBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
  carBody.position.y = 0;
  carBody.castShadow = true;
  carBody.receiveShadow = true;
  carGroup.add(carBody);
  
  // Create cockpit
  const cockpitGeometry = new THREE.SphereGeometry(3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.5,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7
  });
  
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.set(0, 1.5, -2);
  cockpit.scale.set(1, 0.7, 1.5);
  cockpit.castShadow = true;
  carGroup.add(cockpit);
  
  // Create wings
  const wingGeometry = new THREE.BoxGeometry(12, 0.5, 4);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.position.set(0, -0.5, 4);
  leftWing.castShadow = true;
  leftWing.receiveShadow = true;
  carGroup.add(leftWing);
  
  // Create engines
  const engineGeometry = new THREE.CylinderGeometry(1, 1.2, 3, 8);
  const engineMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.3
  });
  
  // Left engine
  const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
  leftEngine.position.set(-5, -0.5, 4);
  leftEngine.rotation.x = Math.PI / 2;
  leftEngine.castShadow = true;
  carGroup.add(leftEngine);
  
  // Right engine
  const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
  rightEngine.position.set(5, -0.5, 4);
  rightEngine.rotation.x = Math.PI / 2;
  rightEngine.castShadow = true;
  carGroup.add(rightEngine);
  
  // Add engine glow
  addEngineGlow(leftEngine);
  addEngineGlow(rightEngine);
  
  // Add car details
  addCarDetails(carGroup, color);
  
  // Rotate to face -Z direction (forward)
  carGroup.rotation.y = Math.PI;
  
  return carGroup;
}

/**
 * Add glow effect to engines
 * @param {THREE.Mesh} engine - The engine mesh
 */
function addEngineGlow(engine) {
  // Create engine glow
  const glowGeometry = new THREE.CylinderGeometry(1.3, 1.5, 0.1, 8);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.set(0, -1.5, 0);
  
  engine.add(glow);
  
  // Add exhaust light
  const light = new THREE.PointLight(0x0088ff, 0.5, 5);
  light.position.set(0, -2, 0);
  engine.add(light);
}

/**
 * Add details to the car
 * @param {THREE.Group} carGroup - The car group
 * @param {number} color - Car body color
 */
function addCarDetails(carGroup, color) {
  // Add front lights
  const frontLightGeometry = new THREE.BoxGeometry(1, 0.5, 0.5);
  const frontLightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1
  });
  
  // Left front light
  const leftFrontLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
  leftFrontLight.position.set(-3, 0, -8);
  carGroup.add(leftFrontLight);
  
  // Right front light
  const rightFrontLight = new THREE.Mesh(frontLightGeometry, frontLightMaterial);
  rightFrontLight.position.set(3, 0, -8);
  carGroup.add(rightFrontLight);
  
  // Add front light cones
  addLightCone(leftFrontLight);
  addLightCone(rightFrontLight);
  
  // Add rear lights
  const rearLightGeometry = new THREE.BoxGeometry(2, 0.5, 0.5);
  const rearLightMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1
  });
  
  // Left rear light
  const leftRearLight = new THREE.Mesh(rearLightGeometry, rearLightMaterial);
  leftRearLight.position.set(-2.5, 0, 8);
  carGroup.add(leftRearLight);
  
  // Right rear light
  const rightRearLight = new THREE.Mesh(rearLightGeometry, rearLightMaterial);
  rightRearLight.position.set(2.5, 0, 8);
  carGroup.add(rightRearLight);
  
  // Add decorative fins
  const finGeometry = new THREE.BoxGeometry(0.5, 2, 3);
  const finMaterial = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const fin = new THREE.Mesh(finGeometry, finMaterial);
  fin.position.set(0, 1, 7);
  fin.castShadow = true;
  carGroup.add(fin);
  
  // Add antenna
  const antennaGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
  const antennaMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.9,
    roughness: 0.1
  });
  
  const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  antenna.position.set(0, 2.5, 3);
  carGroup.add(antenna);
  
  // Add antenna top
  const antennaTopGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const antennaTopMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1
  });
  
  const antennaTop = new THREE.Mesh(antennaTopGeometry, antennaTopMaterial);
  antennaTop.position.set(0, 4, 3);
  carGroup.add(antennaTop);
}

/**
 * Add light cone effect to front lights
 * @param {THREE.Mesh} light - The light mesh
 */
function addLightCone(light) {
  // Create light cone with simpler geometry
  const coneGeometry = new THREE.CylinderGeometry(2, 0, 8, 8, 1, true); // Reduced from 16 segments to 8
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide
  });
  
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.rotation.x = Math.PI / 2;
  cone.position.set(0, 0, -5);
  
  light.add(cone);
  
  // Add actual light - use less intense spotlight for better performance
  const pointLight = new THREE.SpotLight(0xffffff, 0.5, 20, Math.PI / 8); // Reduced intensity and distance
  pointLight.position.set(0, 0, 0);
  pointLight.target.position.set(0, 0, -10);
  light.add(pointLight);
  light.add(pointLight.target);
} 