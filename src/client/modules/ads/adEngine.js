import * as THREE from 'three';
import { getSocket } from '../network/network.js';

// Active billboards
const billboards = {};

/**
 * Initialize the ad engine on the client side
 * @param {THREE.Scene} scene - The Three.js scene
 * @returns {Object} - The ad engine
 */
export async function initializeAdEngine(scene) {
  // Setup event listener for ad updates from server
  const socket = getSocket();
  
  if (socket) {
    socket.on('game:state', (state) => {
      if (state.ads) {
        updateAdsFromServer(state.ads, scene);
      }
    });
  }
  
  return {
    updateBillboard,
    getBillboards: () => billboards
  };
}

/**
 * Update ad content from server data
 * @param {Object} adsData - Billboard ad data from server
 * @param {THREE.Scene} scene - The Three.js scene
 */
function updateAdsFromServer(adsData, scene) {
  // Process each ad from the server
  Object.keys(adsData).forEach(billboardId => {
    const adData = adsData[billboardId];
    
    // Check if we already have this billboard
    if (!billboards[billboardId]) {
      // Create new billboard
      billboards[billboardId] = {
        id: billboardId,
        position: adData.position,
        size: adData.size,
        currentAd: adData,
        object: null
      };
    } else {
      // Update existing billboard
      billboards[billboardId].currentAd = adData;
    }
    
    // Update the 3D object if needed
    updateBillboard(billboards[billboardId], scene);
  });
}

/**
 * Update a billboard with new ad content
 * @param {Object} billboard - The billboard object
 * @param {THREE.Scene} scene - The Three.js scene
 */
function updateBillboard(billboard, scene) {
  const adData = billboard.currentAd;
  
  if (!adData) return;
  
  // If billboard doesn't have a 3D object yet, create one
  if (!billboard.object) {
    createBillboardObject(billboard, scene);
    return;
  }
  
  // Update existing billboard with new ad content
  const screen = billboard.object.children.find(child => child.userData.isScreen);
  
  if (screen) {
    // Update material with new ad content
    updateBillboardMaterial(screen, adData);
  }
}

/**
 * Create a 3D billboard object
 * @param {Object} billboard - The billboard object
 * @param {THREE.Scene} scene - The Three.js scene
 */
function createBillboardObject(billboard, scene) {
  const { position, size, currentAd } = billboard;
  
  // Create billboard group
  const billboardGroup = new THREE.Group();
  billboardGroup.position.set(position.x, position.y, position.z);
  
  // Create the billboard frame
  const frameGeometry = new THREE.BoxGeometry(size.width, size.height, 2);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  billboardGroup.add(frame);
  
  // Create the screen
  const screenGeometry = new THREE.PlaneGeometry(size.width * 0.9, size.height * 0.9);
  const screenMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.5
  });
  
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.z = 1.1;
  screen.userData.isScreen = true;
  billboardGroup.add(screen);
  
  // Update screen with ad content
  updateBillboardMaterial(screen, currentAd);
  
  // Add neon border
  addNeonBorder(billboardGroup, size);
  
  // Add to scene
  scene.add(billboardGroup);
  
  // Store reference to 3D object
  billboard.object = billboardGroup;
}

/**
 * Update billboard material with ad content
 * @param {THREE.Mesh} screen - The screen mesh
 * @param {Object} adData - The ad data
 */
function updateBillboardMaterial(screen, adData) {
  // Create a canvas to draw the ad
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Parse color from ad data
  const color = adData.color || '#00ffff';
  
  // Fill background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add border
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  
  // Add ad content
  const title = adData.name || 'ADVERTISEMENT';
  const content = adData.content || 'CYBERPUNK CITY';
  
  // Draw title
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 70);
  
  // Draw content
  const words = content.split(' ');
  const lines = [];
  let currentLine = '';
  
  // Split content into lines
  words.forEach(word => {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > canvas.width - 60) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) {
    lines.push(currentLine.trim());
  }
  
  // Draw lines
  ctx.font = '36px Arial';
  ctx.fillStyle = '#ffffff';
  
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, 140 + index * 40);
  });
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Update material with new texture
  if (screen.material) {
    screen.material.map = texture;
    screen.material.needsUpdate = true;
  }
}

/**
 * Add neon border to billboard
 * @param {THREE.Group} billboardGroup - The billboard group
 * @param {Object} size - The billboard size
 */
function addNeonBorder(billboardGroup, size) {
  const width = size.width;
  const height = size.height;
  
  // Create wireframe for neon effect
  const borderGeometry = new THREE.BoxGeometry(width * 1.05, height * 1.05, 3);
  const edges = new THREE.EdgesGeometry(borderGeometry);
  
  // Parse color from ad data or use default
  const borderColor = 0x00ffff;
  
  const borderMaterial = new THREE.LineBasicMaterial({
    color: borderColor,
    linewidth: 2
  });
  
  const border = new THREE.LineSegments(edges, borderMaterial);
  billboardGroup.add(border);
} 