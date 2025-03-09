import * as BABYLON from '@babylonjs/core';
import { StandardMaterial, DynamicTexture, Color3, MeshBuilder, Scene, TransformNode, Vector3, NodeMaterial } from '@babylonjs/core';

// Array of billboard materials
const billboardMaterials: StandardMaterial[] = [];

// Default billboard content
const DEFAULT_BILLBOARD_TEXT = [
  'CYBERPUNK',
  'NEON TECH',
  'CYBER MODS',
  'FLYING CARS',
  'NIGHT CITY',
  'NEURAL LINK',
  'THE FUTURE IS NOW'
];

// Billboard data type
interface BillboardUserData {
  rotationSpeed: number;
  adChangeInterval: number;
  lastAdChange: number;
  width: number;
  height: number;
  screen: BABYLON.Mesh;
}

/**
 * Create a billboard for a building
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @param {Scene} scene - The Babylon scene
 * @returns {TransformNode} - The billboard transform node
 */
export function createBillboard(width: number, height: number, scene: Scene): TransformNode {
  // Create group to hold billboard elements
  const billboardGroup = new TransformNode("billboard", scene);
  
  // Create the billboard frame
  const frame = MeshBuilder.CreateBox("frame", {
    width: width + 2,
    height: height + 2,
    depth: 1
  }, scene);
  
  const frameMaterial = new StandardMaterial("frameMaterial", scene);
  frameMaterial.diffuseColor = new Color3(0.07, 0.07, 0.07);
  frameMaterial.specularColor = new Color3(0.8, 0.8, 0.8);
  frameMaterial.emissiveColor = new Color3(0.08, 0.08, 0.08);
  frame.material = frameMaterial;
  frame.position.z = -0.5;
  frame.parent = billboardGroup;
  
  // Create the billboard screen
  const screen = MeshBuilder.CreatePlane("screen", {
    width: width,
    height: height
  }, scene);
  
  // Create screen material with texture or procedural content
  const material = getBillboardMaterial(width, height, scene);
  
  screen.material = material;
  screen.position.z = 0.1;
  screen.parent = billboardGroup;
  
  // Add neon light around the frame
  addNeonBorder(billboardGroup, width, height, scene);
  
  // Store billboard data
  billboardGroup.metadata = {
    rotationSpeed: (Math.random() - 0.5) * 0.001,
    adChangeInterval: 5000 + Math.random() * 15000,
    lastAdChange: Date.now(),
    width,
    height,
    screen: screen
  } as BillboardUserData;
  
  // Randomly rotate the billboard slightly
  billboardGroup.rotation.y = (Math.random() - 0.5) * 0.2;
  
  return billboardGroup;
}

/**
 * Add neon border to the billboard
 * @param {TransformNode} group - The billboard group
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @param {Scene} scene - The Babylon scene
 */
function addNeonBorder(group: TransformNode, width: number, height: number, scene: Scene): void {
  // Random neon color
  const neonColors = [
    new Color3(1, 0, 1),    // purple
    new Color3(0, 1, 1),    // cyan
    new Color3(1, 1, 0),    // yellow
    new Color3(1, 0.2, 0),  // orange
    new Color3(0.2, 1, 0)   // green
  ];
  
  const color = neonColors[Math.floor(Math.random() * neonColors.length)];
  
  // Create neon border with lines
  const halfWidth = (width + 2.5) / 2;
  const halfHeight = (height + 2.5) / 2;
  
  // Create lines for each edge of the border
  const createLine = (start: Vector3, end: Vector3) => {
    const line = MeshBuilder.CreateLines("line", {
      points: [start, end],
      updatable: false
    }, scene);
    line.color = color;
    line.parent = group;
    
    // Add to glow layer (create if not exists)
    let glowLayer = scene.getGlowLayerByName("billboardGlowLayer");
    if (!glowLayer) {
      glowLayer = new BABYLON.GlowLayer("billboardGlowLayer", scene);
      glowLayer.intensity = 1.0;
    }
    glowLayer.addIncludedOnlyMesh(line);
    
    return line;
  };
  
  // Top line
  createLine(
    new Vector3(-halfWidth, halfHeight, 0),
    new Vector3(halfWidth, halfHeight, 0)
  );
  
  // Bottom line
  createLine(
    new Vector3(-halfWidth, -halfHeight, 0),
    new Vector3(halfWidth, -halfHeight, 0)
  );
  
  // Left line
  createLine(
    new Vector3(-halfWidth, -halfHeight, 0),
    new Vector3(-halfWidth, halfHeight, 0)
  );
  
  // Right line
  createLine(
    new Vector3(halfWidth, -halfHeight, 0),
    new Vector3(halfWidth, halfHeight, 0)
  );
  
  // Add a glow plane behind the billboard
  const glowPlane = MeshBuilder.CreatePlane("glow", {
    width: width + 6,
    height: height + 6
  }, scene);
  
  const glowMaterial = new StandardMaterial("glowMaterial", scene);
  glowMaterial.emissiveColor = color.scale(0.3);
  glowMaterial.alpha = 0.5;
  glowMaterial.disableLighting = true;
  
  glowPlane.material = glowMaterial;
  glowPlane.position.z = -1;
  glowPlane.parent = group;
}

/**
 * Get a billboard material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @param {Scene} scene - The Babylon scene
 * @returns {BABYLON.Material} - The billboard material
 */
function getBillboardMaterial(width: number, height: number, scene: Scene): BABYLON.Material {
  // Use a cached material sometimes
  if (billboardMaterials.length > 0 && Math.random() > 0.7) {
    const clonedMaterial = billboardMaterials[Math.floor(Math.random() * billboardMaterials.length)].clone("clonedBillboardMaterial");
    return clonedMaterial;
  }
  
  // Decide between different types of materials
  const textureType = Math.random();
  
  if (textureType > 0.7) {
    // Create procedural texture
    return createProceduralAdMaterial(width, height, scene);
  } else if (textureType > 0.3) {
    // Create text-based ad
    return createTextAdMaterial(width, height, scene);
  } else {
    // Create animated ad
    return createAnimatedAdMaterial(width, height, scene);
  }
}

/**
 * Create a procedural ad material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @param {Scene} scene - The Babylon scene
 * @returns {StandardMaterial} - The billboard material
 */
function createProceduralAdMaterial(width: number, height: number, scene: Scene): StandardMaterial {
  // Create a dynamic texture
  const ratio = height / width;
  const textureSize = 512;
  const dynamicTexture = new DynamicTexture("proceduralAdTexture", {
    width: textureSize,
    height: Math.floor(textureSize * ratio)
  }, scene, false);
  
  const ctx = dynamicTexture.getContext();
  
  // Fill background
  const gradient = ctx.createLinearGradient(0, 0, textureSize, textureSize * ratio);
  gradient.addColorStop(0, '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'));
  gradient.addColorStop(1, '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, textureSize, textureSize * ratio);
  
  // Add some shapes
  const numShapes = 5 + Math.floor(Math.random() * 10);
  for (let i = 0; i < numShapes; i++) {
    ctx.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    
    const shapeType = Math.random();
    const x = Math.random() * textureSize;
    const y = Math.random() * (textureSize * ratio);
    const size = 20 + Math.random() * 100;
    
    if (shapeType < 0.3) {
      // Circle
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (shapeType < 0.6) {
      // Rectangle
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    } else {
      // Triangle
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Add some text
  const text = DEFAULT_BILLBOARD_TEXT[Math.floor(Math.random() * DEFAULT_BILLBOARD_TEXT.length)];
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#ffffff';
  (ctx as CanvasRenderingContext2D).textAlign = 'center';
  (ctx as CanvasRenderingContext2D).textBaseline = 'middle';
  ctx.fillText(text, textureSize / 2, (textureSize * ratio) / 2);
  
  // Update the texture
  dynamicTexture.update();
  
  // Create material with texture
  const material = new StandardMaterial("proceduralMaterial", scene);
  material.diffuseTexture = dynamicTexture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.emissiveTexture = dynamicTexture;
  material.disableLighting = true;
  
  // Cache the material for future use
  if (billboardMaterials.length < 10) {
    billboardMaterials.push(material);
  }
  
  return material;
}

/**
 * Create a text-based ad material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @param {Scene} scene - The Babylon scene
 * @returns {StandardMaterial} - The billboard material
 */
function createTextAdMaterial(width: number, height: number, scene: Scene): StandardMaterial {
  // Create a dynamic texture
  const ratio = height / width;
  const textureSize = 512;
  const dynamicTexture = new DynamicTexture("textAdTexture", {
    width: textureSize,
    height: Math.floor(textureSize * ratio)
  }, scene, false);
  
  const ctx = dynamicTexture.getContext();
  
  // Fill background with dark color
  ctx.fillStyle = '#' + Math.floor(Math.random() * 0x333333).toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, textureSize, textureSize * ratio);
  
  // Random neon text color
  const neonColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff3300', '#33ff00'];
  const textColor = neonColors[Math.floor(Math.random() * neonColors.length)];
  
  // Add neon border
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, textureSize - 20, textureSize * ratio - 20);
  
  // Add text content
  const title = DEFAULT_BILLBOARD_TEXT[Math.floor(Math.random() * DEFAULT_BILLBOARD_TEXT.length)];
  
  // Draw neon title
  ctx.font = 'bold 60px Arial';
  ctx.fillStyle = textColor;
  (ctx as CanvasRenderingContext2D).textAlign = 'center';
  ctx.fillText(title, textureSize / 2, (textureSize * ratio) / 3);
  
  // Draw some additional lines of text
  ctx.font = '40px Arial';
  ctx.fillStyle = '#ffffff';
  
  const phrases = [
    'THE FUTURE IS NOW',
    'UPGRADE YOURSELF',
    'NEXT GENERATION',
    'BEYOND REALITY',
    'CITY OF DREAMS'
  ];
  
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  ctx.fillText(phrase, textureSize / 2, (textureSize * ratio) * 2/3);
  
  // Update the texture
  dynamicTexture.update();
  
  // Create material with texture
  const material = new StandardMaterial("textAdMaterial", scene);
  material.diffuseTexture = dynamicTexture;
  material.emissiveTexture = dynamicTexture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  
  // Cache the material for future use
  if (billboardMaterials.length < 10) {
    billboardMaterials.push(material);
  }
  
  return material;
}

/**
 * Create an animated ad material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @param {Scene} scene - The Babylon scene
 * @returns {BABYLON.Material} - The billboard material
 */
function createAnimatedAdMaterial(width: number, height: number, scene: Scene): BABYLON.Material {
  // Create a basic material for the animated ad
  const material = new StandardMaterial("animatedAdMaterial", scene);
  
  // Random color for the animation
  const neonColors = [
    new Color3(1, 0, 1),    // purple
    new Color3(0, 1, 1),    // cyan
    new Color3(1, 1, 0),    // yellow
    new Color3(1, 0.2, 0),  // orange
    new Color3(0.2, 1, 0)   // green
  ];
  
  const color = neonColors[Math.floor(Math.random() * neonColors.length)];
  
  material.emissiveColor = color;
  material.disableLighting = true;
  
  // Create a dynamic texture for base content
  const ratio = height / width;
  const textureSize = 512;
  const dynamicTexture = new DynamicTexture("animatedBaseTexture", {
    width: textureSize,
    height: Math.floor(textureSize * ratio)
  }, scene, false);
  
  const ctx = dynamicTexture.getContext();
  
  // Fill with dark background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, textureSize, textureSize * ratio);
  
  // Add some static content
  const text = DEFAULT_BILLBOARD_TEXT[Math.floor(Math.random() * DEFAULT_BILLBOARD_TEXT.length)];
  ctx.font = 'bold 60px Arial';
  ctx.fillStyle = '#ffffff';
  (ctx as CanvasRenderingContext2D).textAlign = 'center';
  ctx.fillText(text, textureSize / 2, (textureSize * ratio) / 2);
  
  // Update the texture
  dynamicTexture.update();
  
  // Apply the texture
  material.diffuseTexture = dynamicTexture;
  
  // Set up animation for the emissive color
  scene.registerBeforeRender(() => {
    // Pulse animation
    const time = scene.getEngine().getFps() / 1000;
    const pulse = (Math.sin(time * 2) + 1) / 4 + 0.5;
    material.emissiveColor = color.scale(pulse);
  });
  
  return material;
}

/**
 * Update billboard (change ads, animate, etc.)
 * @param {TransformNode} billboard - The billboard to update
 * @param {number} deltaTime - Time since last frame
 * @param {Scene} scene - The Babylon scene
 */
export function updateBillboard(billboard: TransformNode, deltaTime: number, scene: Scene): void {
  if (!billboard.metadata) return;
  
  const userData = billboard.metadata as BillboardUserData;
  
  // Slowly rotate the billboard if it has rotation speed
  if (userData.rotationSpeed) {
    billboard.rotation.y += userData.rotationSpeed * deltaTime;
  }
  
  // Change ad content periodically
  const currentTime = Date.now();
  if (currentTime - userData.lastAdChange > userData.adChangeInterval) {
    // Get a new material for the screen
    const screen = userData.screen;
    if (screen) {
      screen.material = getBillboardMaterial(userData.width, userData.height, scene);
    }
    
    // Reset timer
    userData.lastAdChange = currentTime;
    
    // Randomize next change interval
    userData.adChangeInterval = 8000 + Math.random() * 15000;
  }
} 