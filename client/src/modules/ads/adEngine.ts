import * as BABYLON from '@babylonjs/core';
import { getSocket } from '../network/network';

// Active billboards
interface Billboard {
  id: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  size: {
    width: number;
    height: number;
  };
  currentAd: AdData;
  object: BABYLON.TransformNode | null;
}

interface AdData {
  position: {
    x: number;
    y: number;
    z: number;
  };
  size: {
    width: number;
    height: number;
  };
  name?: string;
  content?: string;
  color?: string;
}

const billboards: Record<string, Billboard> = {};

/**
 * Initialize the ad engine on the client side
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @returns {Object} - The ad engine
 */
export async function initializeAdEngine(scene: BABYLON.Scene) {
  // Setup event listener for ad updates from server
  const socket = getSocket();
  
  if (socket) {
    socket.on('game:state', (state: any) => {
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
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
function updateAdsFromServer(adsData: Record<string, AdData>, scene: BABYLON.Scene) {
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
 * @param {Billboard} billboard - The billboard object
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
function updateBillboard(billboard: Billboard, scene: BABYLON.Scene) {
  const adData = billboard.currentAd;
  
  if (!adData) return;
  
  // If billboard doesn't have a 3D object yet, create one
  if (!billboard.object) {
    createBillboardObject(billboard, scene);
    return;
  }
  
  // Update existing billboard with new ad content
  if (billboard.object) {
    const screen = billboard.object.getChildMeshes().find(
      child => child.metadata && child.metadata.isScreen
    ) as BABYLON.Mesh;
    
    if (screen) {
      // Update material with new ad content
      updateBillboardMaterial(screen, adData, scene);
    }
  }
}

/**
 * Create a 3D billboard object
 * @param {Billboard} billboard - The billboard object
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
function createBillboardObject(billboard: Billboard, scene: BABYLON.Scene) {
  const { position, size, currentAd } = billboard;
  
  // Create billboard group
  const billboardGroup = new BABYLON.TransformNode("billboard-" + billboard.id, scene);
  billboardGroup.position = new BABYLON.Vector3(position.x, position.y, position.z);
  
  // Create the billboard frame
  const frame = BABYLON.MeshBuilder.CreateBox("frame", {
    width: size.width,
    height: size.height,
    depth: 2
  }, scene);
  const frameMaterial = new BABYLON.StandardMaterial("frameMaterial", scene);
  frameMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
  frameMaterial.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
  frameMaterial.roughness = 0.2;
  frame.material = frameMaterial;
  frame.parent = billboardGroup;
  
  // Create the screen
  const screen = BABYLON.MeshBuilder.CreatePlane("screen", {
    width: size.width * 0.9,
    height: size.height * 0.9
  }, scene);
  screen.position.z = 1.1;
  screen.metadata = { isScreen: true };
  screen.parent = billboardGroup;
  
  // Update screen with ad content
  updateBillboardMaterial(screen, currentAd, scene);
  
  // Add neon border
  addNeonBorder(billboardGroup, size, scene);
  
  // Store reference to 3D object
  billboard.object = billboardGroup;
}

/**
 * Update billboard material with ad content
 * @param {BABYLON.Mesh} screen - The screen mesh
 * @param {AdData} adData - The ad data
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
function updateBillboardMaterial(screen: BABYLON.Mesh, adData: AdData, scene: BABYLON.Scene) {
  // Create a canvas to draw the ad
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;
  
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
  const lines: string[] = [];
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
  
  // Create dynamic texture from canvas
  const texture = new BABYLON.DynamicTexture("billboardTexture", {width: canvas.width, height: canvas.height}, scene, false);
  const context = texture.getContext();
  context.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  texture.update();
  
  // Create material with texture
  const material = new BABYLON.StandardMaterial("screenMaterial", scene);
  material.diffuseTexture = texture;
  material.emissiveColor = new BABYLON.Color3(1, 1, 1);
  material.backFaceCulling = false;
  
  // Update mesh material
  screen.material = material;
}

/**
 * Add neon border to billboard
 * @param {BABYLON.TransformNode} billboardGroup - The billboard group
 * @param {Object} size - The billboard size
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
function addNeonBorder(billboardGroup: BABYLON.TransformNode, size: {width: number, height: number}, scene: BABYLON.Scene) {
  const width = size.width;
  const height = size.height;
  
  // Create lines for neon effect
  const borderColor = BABYLON.Color3.FromHexString('#00ffff');
  
  const lines = [
    // Top
    createNeonLine(
      new BABYLON.Vector3(-width/2 * 1.05, height/2 * 1.05, 0),
      new BABYLON.Vector3(width/2 * 1.05, height/2 * 1.05, 0),
      borderColor,
      scene
    ),
    // Bottom
    createNeonLine(
      new BABYLON.Vector3(-width/2 * 1.05, -height/2 * 1.05, 0),
      new BABYLON.Vector3(width/2 * 1.05, -height/2 * 1.05, 0),
      borderColor,
      scene
    ),
    // Left
    createNeonLine(
      new BABYLON.Vector3(-width/2 * 1.05, -height/2 * 1.05, 0),
      new BABYLON.Vector3(-width/2 * 1.05, height/2 * 1.05, 0),
      borderColor,
      scene
    ),
    // Right
    createNeonLine(
      new BABYLON.Vector3(width/2 * 1.05, -height/2 * 1.05, 0),
      new BABYLON.Vector3(width/2 * 1.05, height/2 * 1.05, 0),
      borderColor,
      scene
    )
  ];
  
  lines.forEach(line => {
    line.parent = billboardGroup;
  });
}

/**
 * Create a neon line
 * @param {BABYLON.Vector3} start - Start position
 * @param {BABYLON.Vector3} end - End position
 * @param {BABYLON.Color3} color - Line color
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @returns {BABYLON.Mesh} - The line mesh
 */
function createNeonLine(start: BABYLON.Vector3, end: BABYLON.Vector3, color: BABYLON.Color3, scene: BABYLON.Scene): BABYLON.Mesh {
  const points = [start, end];
  const line = BABYLON.MeshBuilder.CreateLines("line", {points: points}, scene);
  line.color = color;
  
  // Add glow layer if not already in scene
  // Find the glow layer by iterating through effect layers
  let glowLayer: BABYLON.GlowLayer | null = null;
  for (const layer of scene.effectLayers) {
    if (layer instanceof BABYLON.GlowLayer && layer.name === "glowLayer") {
      glowLayer = layer;
      break;
    }
  }
  
  if (!glowLayer) {
    glowLayer = new BABYLON.GlowLayer("glowLayer", scene);
    glowLayer.intensity = 1.0;
  }
  
  glowLayer.addIncludedOnlyMesh(line as BABYLON.Mesh);
  
  return line;
} 