import * as THREE from 'three';

/**
 * Create a laser beam
 * @returns {THREE.Group} - The laser object
 */
export function createLaser() {
  // Create laser group
  const laserGroup = new THREE.Group();
  
  // Create laser beam with better performance settings
  const beamGeometry = new THREE.CylinderGeometry(0.2, 0.2, 20, 6); // Slight quality increase
  beamGeometry.rotateX(Math.PI / 2);
  beamGeometry.translate(0, 0, -10); // Position beam ahead of the car
  
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.8 // Increased opacity for better visibility
  });
  
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  laserGroup.add(beam);
  
  // Add glow effect - slightly reduced for performance
  const glowGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 6);
  glowGeometry.rotateX(Math.PI / 2);
  glowGeometry.translate(0, 0, -10);
  
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5555,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });
  
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  laserGroup.add(glow);
  
  // Add a small light for visual effect - reduced intensity for performance
  const light = new THREE.PointLight(0xff0000, 0.6, 5);
  light.position.set(0, 0, -10);
  laserGroup.add(light);
  
  // Add a small particle effect at the front of the laser
  const particleGeometry = new THREE.SphereGeometry(0.3, 4, 4);
  const particleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  const particle = new THREE.Mesh(particleGeometry, particleMaterial);
  particle.position.set(0, 0, -20); // At the front of laser
  laserGroup.add(particle);
  
  return laserGroup;
}

/**
 * Create an explosion effect
 * @param {THREE.Vector3} position - Position of the explosion
 * @param {THREE.Scene} scene - The scene to add the explosion to
 * @param {string} [color='red'] - Color of the explosion
 * @returns {Function} - Function to update the explosion
 */
export function createExplosion(position, scene, color = 'red') {
  // Determine explosion color
  let explosionColor;
  switch (color) {
    case 'blue':
      explosionColor = 0x0088ff;
      break;
    case 'green':
      explosionColor = 0x00ff88;
      break;
    case 'yellow':
      explosionColor = 0xffff00;
      break;
    case 'red':
    default:
      explosionColor = 0xff0000;
      break;
  }
  
  // Create particle geometry
  const particleCount = 100;
  const particleGeometry = new THREE.BufferGeometry();
  
  // Create particle positions
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  for (let i = 0; i < particleCount; i++) {
    // Random direction for each particle
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = Math.random() * 0.1 + 0.1;
    
    // Calculate position (initially at center)
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    
    // Calculate velocity direction
    velocities[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    velocities[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    velocities[i * 3 + 2] = radius * Math.cos(phi);
    
    // Random size for each particle
    sizes[i] = Math.random() * 2 + 1;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  // Create particle material
  const particleMaterial = new THREE.PointsMaterial({
    color: explosionColor,
    size: 1,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  
  // Create particle system
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.position.copy(position);
  
  // Add to scene
  scene.add(particles);
  
  // Add explosion light
  const light = new THREE.PointLight(explosionColor, 2, 20);
  light.position.copy(position);
  scene.add(light);
  
  // Explosion duration
  const duration = 1; // seconds
  let time = 0;
  
  // Create update function
  return function updateExplosion(deltaTime) {
    time += deltaTime;
    
    if (time >= duration) {
      // Remove explosion after duration
      scene.remove(particles);
      scene.remove(light);
      return false;
    }
    
    // Update particles
    const positionAttribute = particleGeometry.getAttribute('position');
    const positions = positionAttribute.array;
    
    for (let i = 0; i < particleCount; i++) {
      // Update position based on velocity
      positions[i * 3] += velocities[i * 3] * deltaTime * 20;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime * 20;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime * 20;
    }
    
    positionAttribute.needsUpdate = true;
    
    // Fade out
    particleMaterial.opacity = 1 - (time / duration);
    light.intensity = 2 * (1 - (time / duration));
    
    return true;
  };
}

/**
 * Create a thruster effect for engines
 * @param {THREE.Object3D} engine - The engine object
 * @returns {Function} - Function to update the thruster
 */
export function createThruster(engine) {
  // Create particle geometry
  const particleCount = 50;
  const particleGeometry = new THREE.BufferGeometry();
  
  // Create particle positions and other attributes
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lifetimes = new Float32Array(particleCount);
  const maxLifetimes = new Float32Array(particleCount);
  
  for (let i = 0; i < particleCount; i++) {
    // Initialize positions at engine
    positions[i * 3] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 2] = 0;
    
    // Velocity in engine direction
    velocities[i * 3] = (Math.random() - 0.5) * 0.5;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    velocities[i * 3 + 2] = -5 - Math.random() * 5; // Backward
    
    // Random lifetime for continuous effect
    maxLifetimes[i] = 0.5 + Math.random() * 0.5;
    lifetimes[i] = Math.random() * maxLifetimes[i];
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Create particle material
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x0088ff,
    size: 0.5,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  
  // Create particle system
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.position.set(0, -1.5, 0);
  particles.rotation.x = Math.PI / 2;
  
  // Add to engine
  engine.add(particles);
  
  // Create update function
  return function updateThruster(deltaTime, thrust = 1.0) {
    const positionAttribute = particleGeometry.getAttribute('position');
    const positions = positionAttribute.array;
    
    for (let i = 0; i < particleCount; i++) {
      // Update lifetime
      lifetimes[i] += deltaTime;
      
      if (lifetimes[i] >= maxLifetimes[i]) {
        // Reset particle
        positions[i * 3] = (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 2] = 0;
        
        lifetimes[i] = 0;
      } else {
        // Update position
        positions[i * 3] += velocities[i * 3] * deltaTime * thrust;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime * thrust;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime * thrust;
      }
    }
    
    positionAttribute.needsUpdate = true;
    
    // Adjust particle material based on thrust
    particleMaterial.opacity = 0.4 + (thrust * 0.4);
    particleMaterial.size = 0.3 + (thrust * 0.4);
  };
} 