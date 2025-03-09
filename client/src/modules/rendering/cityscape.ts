import * as BABYLON from '@babylonjs/core';
import { Color3, Vector3, MeshBuilder, StandardMaterial, Texture } from '@babylonjs/core';

// Buildings data
const DEFAULT_BUILDINGS_COUNT = 500;
const CITY_SIZE = 2000;
const MAX_BUILDING_HEIGHT = 300;
const MIN_BUILDING_HEIGHT = 50;

// Building materials
let buildingMaterials: StandardMaterial[] = [];
let windowMaterials: StandardMaterial[] = [];

// Store city meshes
let cityMeshes: BABYLON.AbstractMesh[] = [];

// Export building collisions for the collision system
export const buildingCollisions: {
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}[] = [];

// Debug function to check that buildingCollisions is available
export function getBuildingCollisions() {
  console.log("Getting building collisions, count:", buildingCollisions.length);
  return buildingCollisions;
}

/**
 * Generate the cyberpunk cityscape
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {boolean} isMobile - Whether the device is mobile
 * @param {number} [buildingCount] - Optional building count, defaults based on mobile status
 * @returns {Promise<BABYLON.AbstractMesh[]>} - Array of generated meshes
 */
export async function generateCityscape(
  scene: BABYLON.Scene, 
  isMobile: boolean,
  buildingCount?: number
): Promise<BABYLON.AbstractMesh[]> {
  console.log("Generating cityscape, clearing buildingCollisions");
  // Clear any existing building collisions
  buildingCollisions.length = 0;
  
  // Create ground
  await createGround(scene);
  
  // Create building materials if not already created
  if (buildingMaterials.length === 0) {
    createBuildingMaterials(scene);
  }
  
  // Generate buildings
  const count = buildingCount || (isMobile ? DEFAULT_BUILDINGS_COUNT / 2 : DEFAULT_BUILDINGS_COUNT);
  await generateBuildings(scene, count);
  
  console.log("After generating buildings, collision count:", buildingCollisions.length);
  
  // Add some neon signs and additional details (skip for very low building counts)
  if (!isMobile && count > 100) {
    await addCityDetails(scene);
  }
  
  // Create roads
  await createRoads(scene);
  
  return cityMeshes;
}

/**
 * Create the ground plane
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
async function createGround(scene: BABYLON.Scene): Promise<void> {
  // Create a large ground plane
  const ground = MeshBuilder.CreateGround('ground', {
    width: CITY_SIZE,
    height: CITY_SIZE,
  }, scene);
  
  // Create ground material
  const groundMaterial = new StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseColor = new Color3(0.1, 0.1, 0.1);
  groundMaterial.specularColor = new Color3(0.05, 0.05, 0.05);
  
  // Add grid texture
  const gridTexture = new Texture('/assets/textures/grid.png', scene);
  gridTexture.uScale = CITY_SIZE / 20;
  gridTexture.vScale = CITY_SIZE / 20;
  groundMaterial.diffuseTexture = gridTexture;
  
  // Add some emissive glow to simulate city lights reflecting
  groundMaterial.emissiveColor = new Color3(0.02, 0.02, 0.05);
  
  ground.material = groundMaterial;
  ground.receiveShadows = true;
  
  cityMeshes.push(ground);
}

/**
 * Create materials for buildings
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
function createBuildingMaterials(scene: BABYLON.Scene): void {
  // Create different building materials
  const buildingColors = [
    { r: 0.05, g: 0.05, b: 0.15 }, // Dark blue
    { r: 0.1, g: 0.05, b: 0.1 },  // Dark purple
    { r: 0.15, g: 0.05, b: 0.05 }, // Dark red
    { r: 0.05, g: 0.1, b: 0.1 },  // Dark teal
    { r: 0.05, g: 0.05, b: 0.05 }  // Nearly black
  ];
  
  // Create building materials
  for (let i = 0; i < buildingColors.length; i++) {
    const color = buildingColors[i];
    const material = new StandardMaterial(`building-${i}`, scene);
    
    material.diffuseColor = new Color3(color.r, color.g, color.b);
    material.specularColor = new Color3(0.2, 0.2, 0.3);
    material.emissiveColor = new Color3(color.r * 0.1, color.g * 0.1, color.b * 0.2);
    
    buildingMaterials.push(material);
  }
  
  // Create window materials (emissive)
  const windowColors = [
    { r: 0, g: 1, b: 1 },     // Cyan
    { r: 1, g: 0, b: 1 },     // Magenta
    { r: 1, g: 1, b: 0 },     // Yellow
    { r: 0.5, g: 0, b: 1 },   // Purple
    { r: 0, g: 0.5, b: 1 }    // Blue
  ];
  
  for (let i = 0; i < windowColors.length; i++) {
    const color = windowColors[i];
    const material = new StandardMaterial(`window-${i}`, scene);
    
    material.diffuseColor = new Color3(color.r, color.g, color.b);
    material.emissiveColor = new Color3(color.r * 0.8, color.g * 0.8, color.b * 0.8);
    material.specularColor = new Color3(1, 1, 1);
    
    windowMaterials.push(material);
  }
}

/**
 * Generate buildings for the cityscape
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {number} count - Number of buildings to generate
 */
async function generateBuildings(scene: BABYLON.Scene, count: number): Promise<void> {
  // Clear existing buildings
  cityMeshes = cityMeshes.filter(mesh => !mesh.name.startsWith('building'));
  
  // Use a more efficient approach with batches to avoid freezing
  const batchSize = 50; // Process this many buildings at once
  
  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);
    
    // Create buildings in this batch
    for (let i = batchStart; i < batchEnd; i++) {
      createSingleBuilding(scene, i);
    }
    
    // Give the browser a chance to update the UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/**
 * Create a single building
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {number} index - Building index
 */
function createSingleBuilding(scene: BABYLON.Scene, index: number): void {
  // Calculate position
  const x = (Math.random() - 0.5) * CITY_SIZE;
  const z = (Math.random() - 0.5) * CITY_SIZE;
  
  // Skip buildings too close to center (player start zone)
  if (Math.abs(x) < 100 && Math.abs(z) < 100) {
    return;
  }
  
  // Random building dimensions
  const width = 20 + Math.random() * 40;
  const depth = 20 + Math.random() * 40;
  const height = MIN_BUILDING_HEIGHT + Math.random() * (MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT);
  
  // Create building mesh
  const building = MeshBuilder.CreateBox(`building_${index}`, {
    width,
    depth,
    height
  }, scene);
  
  // Position building (y is half height because box origin is center)
  building.position.x = x;
  building.position.y = height / 2;
  building.position.z = z;
  
  // Random slight rotation to make city less perfect
  building.rotation.y = Math.random() * Math.PI * 0.1;
  
  // Apply random material
  const materialIndex = Math.floor(Math.random() * buildingMaterials.length);
  building.material = buildingMaterials[materialIndex];
  
  // Add building to city meshes
  cityMeshes.push(building);
  
  // Create windows for the building (except for very small buildings)
  // Skip window creation for more than half the buildings to improve performance
  if (height > 60 && Math.random() > 0.5) {
    createBuildingWindows(scene, building, width, height, depth);
  }
  
  // Add collision data for this building
  buildingCollisions.push({
    position: {
      x: building.position.x,
      y: building.position.y,
      z: building.position.z
    },
    size: {
      x: width,
      y: height,
      z: depth
    }
  });
}

/**
 * Create windows for a building
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 * @param {BABYLON.Mesh} building - The building mesh
 * @param {number} width - Building width
 * @param {number} height - Building height
 * @param {number} depth - Building depth
 */
function createBuildingWindows(scene: BABYLON.Scene, building: BABYLON.Mesh, width: number, height: number, depth: number): void {
  // Decide whether all windows use same color or random
  const useSameColor = Math.random() > 0.5;
  const windowMaterialIndex = Math.floor(Math.random() * windowMaterials.length);
  
  // Window dimensions
  const windowSize = 1.5;
  const spacingX = 3;
  const spacingY = 4;
  
  // Windows parent transform
  const windows = new BABYLON.Mesh(`windows-${building.name}`, scene);
  windows.parent = building;
  windows.position = new Vector3(0, 0, 0);
  
  // Calculate number of windows
  const windowsX = Math.floor((width - 2) / spacingX);
  const windowsY = Math.floor((height - 2) / spacingY);
  const windowsZ = Math.floor((depth - 2) / spacingX);
  
  // Create windows for each face
  for (let side = 0; side < 4; side++) {
    const isXSide = side % 2 === 0;
    const numWidth = isXSide ? windowsZ : windowsX;
    const faceWidth = isXSide ? depth : width;
    
    // Position offset for this face
    const rotationY = side * Math.PI / 2;
    const offsetX = Math.sin(rotationY) * (width / 2);
    const offsetZ = Math.cos(rotationY) * (depth / 2);
    
    for (let wx = 0; wx < numWidth; wx++) {
      for (let wy = 0; wy < windowsY; wy++) {
        // Randomly skip some windows (not all lit)
        if (Math.random() > 0.7) continue;
        
        // Create window pane
        const window = MeshBuilder.CreatePlane(`window-${side}-${wx}-${wy}`, {
          width: windowSize,
          height: windowSize
        }, scene);
        
        // Position window
        const xPos = isXSide ? 0 : (-faceWidth/2 + wx * spacingX + spacingX/2);
        const zPos = isXSide ? (-faceWidth/2 + wx * spacingX + spacingX/2) : 0;
        
        window.position = new Vector3(
          xPos + offsetX, 
          -height/2 + wy * spacingY + spacingY/2,
          zPos + offsetZ
        );
        
        // Rotate window to face outward
        window.rotation.y = rotationY;
        
        // Apply material
        const material = useSameColor 
          ? windowMaterials[windowMaterialIndex] 
          : windowMaterials[Math.floor(Math.random() * windowMaterials.length)];
        
        window.material = material;
        window.parent = windows;
      }
    }
  }
}

/**
 * Add city details like neon signs and special structures
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
async function addCityDetails(scene: BABYLON.Scene): Promise<void> {
  // Container for city details
  const detailsContainer = new BABYLON.Mesh('cityDetails', scene);
  
  // Add a few large neon billboards
  for (let i = 0; i < 20; i++) {
    // Random position
    const x = (Math.random() - 0.5) * (CITY_SIZE - 100);
    const z = (Math.random() - 0.5) * (CITY_SIZE - 100);
    const y = 50 + Math.random() * 150;
    
    // Random dimensions
    const width = 10 + Math.random() * 30;
    const height = 5 + Math.random() * 20;
    
    // Create billboard
    const billboard = MeshBuilder.CreatePlane(`billboard-${i}`, {
      width,
      height
    }, scene);
    
    // Position and rotate
    billboard.position = new Vector3(x, y, z);
    billboard.rotation.y = Math.random() * Math.PI * 2;
    
    // Create neon material
    const neonMaterial = new StandardMaterial(`neon-${i}`, scene);
    
    // Random neon color
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    
    neonMaterial.diffuseColor = new Color3(r, g, b);
    neonMaterial.emissiveColor = new Color3(r, g, b);
    neonMaterial.specularColor = new Color3(1, 1, 1);
    
    billboard.material = neonMaterial;
    billboard.parent = detailsContainer;
  }
  
  cityMeshes.push(detailsContainer);
}

/**
 * Create roads in the city
 * @param {BABYLON.Scene} scene - The Babylon.js scene
 */
async function createRoads(scene: BABYLON.Scene): Promise<void> {
  // Create a grid of roads
  const roadContainer = new BABYLON.Mesh('roads', scene);
  const roadMaterial = new StandardMaterial('roadMaterial', scene);
  
  // Create dark material for roads
  roadMaterial.diffuseColor = new Color3(0.05, 0.05, 0.05);
  roadMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
  
  // Add some emissive for lane markings
  roadMaterial.emissiveTexture = new Texture('/assets/textures/road.png', scene);
  roadMaterial.emissiveColor = new Color3(0.2, 0.2, 0.2);
  
  // Grid parameters
  const gridSize = 200;
  const roadWidth = 20;
  
  // Create roads along x axis
  for (let i = -CITY_SIZE/2; i <= CITY_SIZE/2; i += gridSize) {
    const road = MeshBuilder.CreatePlane(`roadX-${i}`, {
      width: CITY_SIZE,
      height: roadWidth
    }, scene);
    
    road.position = new Vector3(0, 0.1, i);
    road.rotation.x = Math.PI / 2;
    road.material = roadMaterial;
    road.parent = roadContainer;
  }
  
  // Create roads along z axis
  for (let i = -CITY_SIZE/2; i <= CITY_SIZE/2; i += gridSize) {
    const road = MeshBuilder.CreatePlane(`roadZ-${i}`, {
      width: roadWidth,
      height: CITY_SIZE
    }, scene);
    
    road.position = new Vector3(i, 0.1, 0);
    road.rotation.x = Math.PI / 2;
    road.material = roadMaterial;
    road.parent = roadContainer;
  }
  
  cityMeshes.push(roadContainer);
} 