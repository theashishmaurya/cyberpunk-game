import * as BABYLON from '@babylonjs/core';
import { Color3, Vector3, MeshBuilder, StandardMaterial } from '@babylonjs/core';

/**
 * Create a flying car model using Babylon.js
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {string} id - Unique identifier for the car
 * @returns {Promise<BABYLON.Mesh>} - The car mesh
 */
export async function createCarModel(scene: BABYLON.Scene, id: string): Promise<BABYLON.Mesh> {
  // Create a root mesh for the car
  const carRoot = new BABYLON.Mesh(`car-${id}`, scene);
  
  // Create body material
  const bodyMaterial = new StandardMaterial("carBodyMaterial", scene);
  bodyMaterial.diffuseColor = new Color3(0.8, 0.1, 0.2);
  bodyMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
  bodyMaterial.specularPower = 32;
  
  // Create glass material
  const glassMaterial = new StandardMaterial("carGlassMaterial", scene);
  glassMaterial.diffuseColor = new Color3(0.3, 0.85, 1);
  glassMaterial.alpha = 0.4;
  glassMaterial.specularColor = new Color3(1, 1, 1);
  glassMaterial.specularPower = 64;
  
  // Create detail material
  const detailMaterial = new StandardMaterial("carDetailMaterial", scene);
  detailMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);
  detailMaterial.specularColor = new Color3(0.3, 0.3, 0.3);
  
  // Create engine glow material
  const glowMaterial = new StandardMaterial("carGlowMaterial", scene);
  glowMaterial.diffuseColor = new Color3(0, 0.8, 1);
  glowMaterial.emissiveColor = new Color3(0, 0.5, 1);
  glowMaterial.specularColor = new Color3(1, 1, 1);
  
  // Create car body - main body
  const carBody = MeshBuilder.CreateBox("carBody", {
    width: 8,
    height: 2,
    depth: 15
  }, scene);
  carBody.material = bodyMaterial;
  carBody.parent = carRoot;
  
  // Create the upper part of the car (cabin)
  const carCabin = MeshBuilder.CreateBox("carCabin", {
    width: 6,
    height: 1.5,
    depth: 8
  }, scene);
  carCabin.material = bodyMaterial;
  carCabin.position.y = 1.75;
  carCabin.position.z = -1;
  carCabin.parent = carRoot;
  
  // Create windshield
  const windshield = MeshBuilder.CreateBox("windshield", {
    width: 5.5,
    height: 1.4,
    depth: 0.1
  }, scene);
  windshield.material = glassMaterial;
  windshield.position.y = 1.8;
  windshield.position.z = 3; // Front of the car
  windshield.rotation.x = Math.PI / 6; // Tilt the windshield
  windshield.parent = carRoot;
  
  // Create side windows
  const leftWindow = MeshBuilder.CreateBox("leftWindow", {
    width: 0.1,
    height: 1.2,
    depth: 7
  }, scene);
  leftWindow.material = glassMaterial;
  leftWindow.position.x = 3.05;
  leftWindow.position.y = 1.8;
  leftWindow.position.z = -1;
  leftWindow.parent = carRoot;
  
  const rightWindow = MeshBuilder.CreateBox("rightWindow", {
    width: 0.1,
    height: 1.2,
    depth: 7
  }, scene);
  rightWindow.material = glassMaterial;
  rightWindow.position.x = -3.05;
  rightWindow.position.y = 1.8;
  rightWindow.position.z = -1;
  rightWindow.parent = carRoot;
  
  // Create engines/thrusters
  const leftThruster = MeshBuilder.CreateCylinder("leftThruster", {
    height: 2.5,
    diameter: 1.5,
    tessellation: 12
  }, scene);
  leftThruster.material = detailMaterial;
  leftThruster.position.x = 3;
  leftThruster.position.y = 0;
  leftThruster.position.z = -6;
  leftThruster.rotation.x = Math.PI / 2;
  leftThruster.parent = carRoot;
  
  const rightThruster = MeshBuilder.CreateCylinder("rightThruster", {
    height: 2.5,
    diameter: 1.5,
    tessellation: 12
  }, scene);
  rightThruster.material = detailMaterial;
  rightThruster.position.x = -3;
  rightThruster.position.y = 0;
  rightThruster.position.z = -6;
  rightThruster.rotation.x = Math.PI / 2;
  rightThruster.parent = carRoot;
  
  // Create engine glow
  const leftGlow = MeshBuilder.CreateCylinder("leftGlow", {
    height: 0.2,
    diameter: 1.3,
    tessellation: 12
  }, scene);
  leftGlow.material = glowMaterial;
  leftGlow.position.x = 3;
  leftGlow.position.y = 0;
  leftGlow.position.z = -7.2;
  leftGlow.rotation.x = Math.PI / 2;
  leftGlow.parent = carRoot;
  
  const rightGlow = MeshBuilder.CreateCylinder("rightGlow", {
    height: 0.2,
    diameter: 1.3,
    tessellation: 12
  }, scene);
  rightGlow.material = glowMaterial;
  rightGlow.position.x = -3;
  rightGlow.position.y = 0;
  rightGlow.position.z = -7.2;
  rightGlow.rotation.x = Math.PI / 2;
  rightGlow.parent = carRoot;
  
  // Create front lights
  const leftLight = MeshBuilder.CreateSphere("leftLight", {
    diameter: 1,
    segments: 8
  }, scene);
  leftLight.scaling.x = 0.7;
  leftLight.scaling.y = 0.4;
  leftLight.scaling.z = 0.1;
  leftLight.position.x = 3;
  leftLight.position.y = 0;
  leftLight.position.z = 7.5;
  
  const leftLightMaterial = new StandardMaterial("leftLightMaterial", scene);
  leftLightMaterial.diffuseColor = new Color3(1, 0.9, 0.5);
  leftLightMaterial.emissiveColor = new Color3(1, 0.9, 0.5);
  leftLight.material = leftLightMaterial;
  leftLight.parent = carRoot;
  
  const rightLight = leftLight.clone("rightLight");
  rightLight.position.x = -3;
  rightLight.material = leftLightMaterial;
  rightLight.parent = carRoot;
  
  // Create boosters
  if (id === 'player') {
    // Only add particle systems for the player's car to save resources
    
    const particleSystem = new BABYLON.ParticleSystem("engineParticles", 2000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("/assets/textures/particle.png", scene);
    
    // Set emission colors
    particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0);
    
    // Set particle size and lifetime
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.5;
    particleSystem.minLifeTime = 0.1;
    particleSystem.maxLifeTime = 0.5;
    
    // Set emission rate and speed
    particleSystem.emitRate = 500;
    particleSystem.direction1 = new Vector3(0, 0, -1);
    particleSystem.direction2 = new Vector3(0, 0, -1);
    particleSystem.minEmitPower = 10;
    particleSystem.maxEmitPower = 30;
    particleSystem.updateSpeed = 0.01;
    
    // Create emitter for right thruster
    particleSystem.emitter = rightThruster;
    particleSystem.start();
    
    // Clone the particle system for the left thruster
    const leftParticleSystem = particleSystem.clone("leftEngineParticles", leftThruster);
    leftParticleSystem.emitter = leftThruster;
    leftParticleSystem.start();
    
    // Add engine light
    const engineLight = new BABYLON.PointLight("engineLight", new Vector3(0, 0, -7), scene);
    engineLight.diffuse = new Color3(0, 0.5, 1);
    engineLight.intensity = 2;
    engineLight.parent = carRoot;
    
    // Animate engine glow
    const glowAnimation = new BABYLON.Animation(
      "glowAnimation",
      "emissiveColor",
      30,
      BABYLON.Animation.ANIMATIONTYPE_COLOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );
    
    const keyFrames = [];
    keyFrames.push({ frame: 0, value: new Color3(0, 0.3, 0.8) });
    keyFrames.push({ frame: 15, value: new Color3(0, 0.5, 1) });
    keyFrames.push({ frame: 30, value: new Color3(0, 0.3, 0.8) });
    glowAnimation.setKeys(keyFrames);
    glowMaterial.animations = glowMaterial.animations || [];
    glowMaterial.animations.push(glowAnimation);
    scene.beginAnimation(glowMaterial, 0, 30, true);
  }
  
  // Apply shadows to car
  carRoot.receiveShadows = true;
  
  // Make car castable for ray picking/collision
  carRoot.isPickable = true;
  
  return carRoot;
} 