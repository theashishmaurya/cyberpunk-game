import * as BABYLON from '@babylonjs/core';
import { Color3, Vector3, MeshBuilder, StandardMaterial } from '@babylonjs/core';

/**
 * Create a laser beam effect
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {Object} options - Laser options
 * @returns {BABYLON.Mesh} - The laser mesh
 */
export function createLaser(scene: BABYLON.Scene, options: {
  position: BABYLON.Vector3,
  direction: BABYLON.Vector3,
  color?: string,
  speed?: number,
  duration?: number
}): BABYLON.Mesh {
  // Default options
  const color = options.color || '#00ffff';
  const speed = options.speed || 500;
  const duration = options.duration || 1.5;
  
  // Create a cylinder for the laser beam
  const laserBeam = MeshBuilder.CreateCylinder("laser", {
    height: 10,
    diameter: 0.5,
    tessellation: 8
  }, scene);
  
  // Position and orient the laser
  laserBeam.position = options.position.clone();
  
  // Orient the laser along its direction vector
  const direction = options.direction.normalize();
  
  // Set the direction using lookAt - first, create a suitable "up" vector
  const up = new BABYLON.Vector3(0, 1, 0);
  if (Math.abs(BABYLON.Vector3.Dot(direction, up)) > 0.99) {
    // If direction is near-parallel to up, use a different up vector
    up.set(0, 0, 1);
  }
  
  // Set orientation using lookAt
  const targetPoint = options.position.add(direction.scale(10));
  laserBeam.lookAt(targetPoint);
  
  // Create material for the laser
  const laserMaterial = new StandardMaterial("laserMaterial", scene);
  
  // Parse the color string to RGB
  const colorHex = color.replace('#', '');
  const r = parseInt(colorHex.substring(0, 2), 16) / 255;
  const g = parseInt(colorHex.substring(2, 4), 16) / 255;
  const b = parseInt(colorHex.substring(4, 6), 16) / 255;
  
  laserMaterial.diffuseColor = new Color3(r, g, b);
  laserMaterial.emissiveColor = new Color3(r, g, b);
  laserMaterial.specularColor = new Color3(1, 1, 1);
  laserMaterial.alpha = 0.7;
  
  laserBeam.material = laserMaterial;
  
  // Create a point light at the muzzle
  const muzzleLight = new BABYLON.PointLight("laserMuzzleLight", options.position.clone(), scene);
  muzzleLight.diffuse = new Color3(r, g, b);
  muzzleLight.intensity = 10;
  
  // Animate muzzle light intensity
  const lightAnimation = new BABYLON.Animation(
    "muzzleLightAnimation", 
    "intensity", 
    30, 
    BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  
  const lightKeyFrames = [];
  lightKeyFrames.push({ frame: 0, value: 10 });
  lightKeyFrames.push({ frame: 15, value: 0 });
  
  lightAnimation.setKeys(lightKeyFrames);
  muzzleLight.animations.push(lightAnimation);
  scene.beginAnimation(muzzleLight, 0, 15, false, 1, () => {
    muzzleLight.dispose();
  });
  
  // Create particle system for laser trail
  const particleSystem = new BABYLON.ParticleSystem("laserParticles", 500, scene);
  particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/particle.png", scene);
  
  // Set the emitter and its parameters
  particleSystem.emitter = laserBeam;
  particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
  particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
  
  // Set particle colors
  particleSystem.color1 = new BABYLON.Color4(r, g, b, 1.0);
  particleSystem.color2 = new BABYLON.Color4(r, g, b, 1.0);
  particleSystem.colorDead = new BABYLON.Color4(r * 0.5, g * 0.5, b * 0.5, 0);
  
  // Set particle size and lifetime
  particleSystem.minSize = 0.1;
  particleSystem.maxSize = 0.3;
  particleSystem.minLifeTime = 0.1;
  particleSystem.maxLifeTime = 0.3;
  
  // Set emission parameters
  particleSystem.emitRate = 200;
  particleSystem.direction1 = new Vector3(-0.2, -0.2, -0.2);
  particleSystem.direction2 = new Vector3(0.2, 0.2, 0.2);
  particleSystem.minEmitPower = 0.5;
  particleSystem.maxEmitPower = 1.5;
  
  // Start the particle system
  particleSystem.start();
  
  // Create animation to move the laser
  const moveAnimation = new BABYLON.Animation(
    "laserMoveAnimation", 
    "position", 
    60, 
    BABYLON.Animation.ANIMATIONTYPE_VECTOR3, 
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  
  // Calculate end position based on direction and speed
  const endPosition = options.position.add(direction.scale(speed * duration));
  
  const positionKeyFrames = [];
  positionKeyFrames.push({ frame: 0, value: options.position.clone() });
  positionKeyFrames.push({ frame: 60 * duration, value: endPosition });
  
  moveAnimation.setKeys(positionKeyFrames);
  laserBeam.animations.push(moveAnimation);
  
  // Create animation for fading out the laser
  const fadeAnimation = new BABYLON.Animation(
    "laserFadeAnimation", 
    "visibility", 
    30, 
    BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  
  const fadeKeyFrames = [];
  fadeKeyFrames.push({ frame: 0, value: 1 });
  fadeKeyFrames.push({ frame: 60 * duration - 10, value: 1 });
  fadeKeyFrames.push({ frame: 60 * duration, value: 0 });
  
  fadeAnimation.setKeys(fadeKeyFrames);
  laserBeam.animations.push(fadeAnimation);
  
  // Start animations
  scene.beginAnimation(laserBeam, 0, 60 * duration, false, 1, () => {
    // Disposal callback
    particleSystem.stop();
    setTimeout(() => {
      particleSystem.dispose();
      laserBeam.dispose();
    }, 500); // Give particle system time to finish emitting
  });
  
  return laserBeam;
}

/**
 * Create a trail effect behind a moving object
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {BABYLON.Mesh} mesh - The mesh to create a trail for
 * @param {Object} options - Trail options
 * @returns {BABYLON.ParticleSystem} - The particle system for the trail
 */
export function createTrail(scene: BABYLON.Scene, mesh: BABYLON.Mesh, options: {
  color?: string,
  size?: number,
  lifetime?: number
} = {}): BABYLON.ParticleSystem {
  // Default options
  const color = options.color || '#00ffff';
  const size = options.size || 1;
  const lifetime = options.lifetime || 0.5;
  
  // Parse the color string to RGB
  const colorHex = color.replace('#', '');
  const r = parseInt(colorHex.substring(0, 2), 16) / 255;
  const g = parseInt(colorHex.substring(2, 4), 16) / 255;
  const b = parseInt(colorHex.substring(4, 6), 16) / 255;
  
  // Create particle system
  const trailSystem = new BABYLON.ParticleSystem("trail", 500, scene);
  trailSystem.particleTexture = new BABYLON.Texture("/assets/textures/particle.png", scene);
  
  // Set the emitter to the mesh
  trailSystem.emitter = mesh;
  trailSystem.minEmitBox = new Vector3(-0.5, -0.5, -0.5);
  trailSystem.maxEmitBox = new Vector3(0.5, 0.5, 0.5);
  
  // Set particle colors
  trailSystem.color1 = new BABYLON.Color4(r, g, b, 0.8);
  trailSystem.color2 = new BABYLON.Color4(r * 0.7, g * 0.7, b * 0.7, 0.6);
  trailSystem.colorDead = new BABYLON.Color4(r * 0.3, g * 0.3, b * 0.3, 0);
  
  // Set particle size
  trailSystem.minSize = 0.1 * size;
  trailSystem.maxSize = 0.4 * size;
  
  // Set particle lifetime
  trailSystem.minLifeTime = 0.1 * lifetime;
  trailSystem.maxLifeTime = lifetime;
  
  // Set emission parameters
  trailSystem.emitRate = 100;
  trailSystem.direction1 = new Vector3(-0.1, -0.1, -0.1);
  trailSystem.direction2 = new Vector3(0.1, 0.1, 0.1);
  trailSystem.minEmitPower = 0.1;
  trailSystem.maxEmitPower = 0.5;
  
  // Gravity - particles should slowly rise
  trailSystem.gravity = new Vector3(0, 0.05, 0);
  
  // Start the particle system
  trailSystem.start();
  
  return trailSystem;
} 