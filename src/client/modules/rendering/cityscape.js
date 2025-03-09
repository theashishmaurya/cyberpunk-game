import * as THREE from 'three';
import { LOD } from 'three';
import { createBillboard } from './billboard.js';

// Cache for materials
const materialCache = {};

// City constants
const CITY_SIZE = 1000;
const CHUNK_SIZE = 500; // Size of each city chunk
const VIEW_DISTANCE = 2000; // Increased from 1500 to see more chunks
const BLOCK_SIZE = 200; // Increased from 150 to allow more space
const MAX_BUILDING_HEIGHT = 250;
const MIN_BUILDING_HEIGHT = 50;
const NUM_BUILDINGS_PER_BLOCK = 2;
const ROAD_WIDTH = 50; // Wider roads
const SIDEWALK_WIDTH = 10; // Add sidewalks

// Chunk tracking
const loadedChunks = {};
let playerChunkX = 0;
let playerChunkZ = 0;

// Building collision data for the game physics
export const buildingCollisions = [];

// Object pooling and caching
const geometryCache = {}; // Cache for shared geometries
const objectPool = {
  buildings: [],
  windows: [],
  roads: [],
  billboards: []
};

/**
 * Generate the cyberpunk cityscape
 * @param {THREE.Scene} scene - The Three.js scene
 */
export async function generateCityscape(scene) {
  // Create ground plane
  createGround(scene);
  
  // Initial city grid is now handled by the chunk system
  // We'll load the chunks around the origin initially
  updateChunks(scene, { x: 0, y: 0, z: 0 });
  
  // Create skybox
  createSkybox(scene);
  
  // Create city lights
  createCityLights(scene);

  // Return the updateChunks function so it can be called when player moves
  return {
    updateChunks: (position) => updateChunks(scene, position)
  };
}

/**
 * Update city chunks based on player position
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {Object} playerPosition - Player's current position
 */
function updateChunks(scene, playerPosition) {
  // Calculate which chunk the player is in
  const newChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
  const newChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
  
  // If player hasn't moved to a new chunk, no need to update
  if (newChunkX === playerChunkX && newChunkZ === playerChunkZ) {
    return;
  }
  
  // Update player chunk position
  playerChunkX = newChunkX;
  playerChunkZ = newChunkZ;
  
  console.log(`Player moved to chunk [${playerChunkX}, ${playerChunkZ}]`);
  
  // Calculate render distance in chunks
  const renderDistance = Math.ceil(VIEW_DISTANCE / CHUNK_SIZE);
  
  // Track which chunks should be loaded
  const chunksToKeep = {};
  
  // Create a priority queue for loading chunks (closest first)
  const chunkLoadQueue = [];
  
  // Generate chunks in view distance (in a square pattern around player)
  for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
    for (let z = playerChunkZ - renderDistance; z <= playerChunkZ + renderDistance; z++) {
      // Calculate distance to player's chunk
      const distX = x - playerChunkX;
      const distZ = z - playerChunkZ;
      const chunkDistSq = distX * distX + distZ * distZ;
                         
      // Only create chunks within the circular view distance
      if (chunkDistSq <= renderDistance * renderDistance) {
        const chunkKey = `${x},${z}`;
        chunksToKeep[chunkKey] = true;
        
        // If chunk not loaded, add to loading queue with priority based on distance
        if (!loadedChunks[chunkKey]) {
          chunkLoadQueue.push({
            x,
            z,
            priority: chunkDistSq // Lower value = higher priority
          });
        }
      }
    }
  }
  
  // Sort load queue by priority (closest chunks first)
  chunkLoadQueue.sort((a, b) => a.priority - b.priority);
  
  // Throttle chunk loading to avoid frame drops
  // Only load a few chunks per frame
  const maxChunksToLoadNow = 1;
  const chunksToLoadNow = chunkLoadQueue.slice(0, maxChunksToLoadNow);
  
  // Load immediate chunks now
  chunksToLoadNow.forEach(chunk => {
    const chunkKey = `${chunk.x},${chunk.z}`;
    loadedChunks[chunkKey] = createChunk(scene, chunk.x, chunk.z);
  });
  
  // Schedule remaining chunks to load over time
  if (chunkLoadQueue.length > maxChunksToLoadNow) {
    // Cancel any existing load timer
    if (window.chunkLoadTimer) {
      clearTimeout(window.chunkLoadTimer);
    }
    
    // Set up delayed loading for remaining chunks
    window.chunkLoadTimer = setTimeout(() => {
      const remainingChunks = chunkLoadQueue.slice(maxChunksToLoadNow);
      remainingChunks.forEach(chunk => {
        const chunkKey = `${chunk.x},${chunk.z}`;
        if (!loadedChunks[chunkKey] && chunksToKeep[chunkKey]) {
          loadedChunks[chunkKey] = createChunk(scene, chunk.x, chunk.z);
        }
      });
    }, 100); // Delay loading other chunks
  }
  
  // Remove chunks that are too far away
  Object.keys(loadedChunks).forEach(chunkKey => {
    if (!chunksToKeep[chunkKey]) {
      // Remove chunk objects from scene
      loadedChunks[chunkKey].forEach(object => {
        scene.remove(object);
        
        // Dispose of geometries and materials to free memory
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      // Remove chunk from tracking
      delete loadedChunks[chunkKey];
      
      // Remove collision data for buildings in this chunk
      const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
      const chunkMinX = chunkX * CHUNK_SIZE - CHUNK_SIZE/2;
      const chunkMaxX = chunkX * CHUNK_SIZE + CHUNK_SIZE/2;
      const chunkMinZ = chunkZ * CHUNK_SIZE - CHUNK_SIZE/2;
      const chunkMaxZ = chunkZ * CHUNK_SIZE + CHUNK_SIZE/2;
      
      // Filter out buildings from this chunk
      const buildingsToKeep = buildingCollisions.filter(building => {
        const { x, z } = building.position;
        return !(x >= chunkMinX && x <= chunkMaxX && z >= chunkMinZ && z <= chunkMaxZ);
      });

      // Clear the array without reassigning it
      buildingCollisions.length = 0;

      // Add the filtered buildings back
      buildingsToKeep.forEach(building => buildingCollisions.push(building));
    }
  });
}

/**
 * Create a chunk of the city
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} chunkX - Chunk X coordinate
 * @param {number} chunkZ - Chunk Z coordinate
 * @returns {Array} - Array of objects in this chunk
 */
function createChunk(scene, chunkX, chunkZ) {
  const chunkObjects = [];
  
  // Calculate world position of chunk center (not corner)
  const worldX = chunkX * CHUNK_SIZE;
  const worldZ = chunkZ * CHUNK_SIZE;
  
  // Create a chunk seed based on position for consistent generation
  const chunkSeed = hashCode(`${chunkX},${chunkZ}`);
  
  // Calculate how many blocks fit in a chunk (adjust for centering)
  const blocksPerSide = Math.floor(CHUNK_SIZE / BLOCK_SIZE);
  const startOffset = -Math.floor(blocksPerSide / 2);
  
  // Use shared geometries instead of creating new ones every time
  if (!geometryCache.buildings) {
    geometryCache.buildings = [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      new THREE.CylinderGeometry(0.5, 0.7, 1, 6)
    ];
  }
  
  // Get building geometries from cache
  const buildingGeometries = geometryCache.buildings;
  
  // Generate city blocks and roads for this chunk
  for (let xOffset = startOffset; xOffset < blocksPerSide + startOffset; xOffset++) {
    for (let zOffset = startOffset; zOffset < blocksPerSide + startOffset; zOffset++) {
      const blockX = worldX + xOffset * BLOCK_SIZE;
      const blockZ = worldZ + zOffset * BLOCK_SIZE;
      
      // Create roads for this block
      const roadObjects = createRoads(scene, blockX, blockZ);
      chunkObjects.push(...roadObjects);
      
      // Create buildings in this block
      const blockObjects = createCityBlock(
        scene,
        blockX,
        blockZ,
        buildingGeometries,
        chunkSeed + xOffset * 100 + zOffset
      );
      
      // Add to chunk objects
      chunkObjects.push(...blockObjects);
    }
  }
  
  // Add some independent billboards in this chunk - but fewer
  if (chunkX % 2 === 0 && chunkZ % 2 === 0) {  // Only add billboards in every 4th chunk
    const billboardObjects = createIndependentBillboards(scene, worldX, worldZ, chunkSeed);
    chunkObjects.push(...billboardObjects);
  }
  
  return chunkObjects;
}

/**
 * Create roads for a city block
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} blockX - Block X position
 * @param {number} blockZ - Block Z position
 * @returns {Array} - Road objects created
 */
function createRoads(scene, blockX, blockZ) {
  const roadObjects = [];
  
  // Create cyberpunk road material using shaders
  const roadMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      roadColor: { value: new THREE.Color(0x111111) }, // Dark asphalt
      lineColor: { value: new THREE.Color(0x00ffff) },  // Cyan for main lines
      secondaryLineColor: { value: new THREE.Color(0xff00ff) }, // Magenta for secondary lines
      gridColor: { value: new THREE.Color(0x222222) }, // Subtle grid pattern
      glowStrength: { value: 0.7 },
      pulseSpeed: { value: 0.5 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 roadColor;
      uniform vec3 lineColor;
      uniform vec3 secondaryLineColor;
      uniform vec3 gridColor;
      uniform float glowStrength;
      uniform float pulseSpeed;
      
      varying vec2 vUv;
      varying vec3 vPosition;
      
      // Random function for noise
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // Function to create lines
      float line(float position, float width) {
        return step(position - width/2.0, 0.5) - step(position + width/2.0, 0.5);
      }
      
      void main() {
        vec3 color = roadColor;
        
        // Add some noise/texture to the road
        float noise = random(vUv * 100.0) * 0.05;
        color = roadColor * (0.95 + noise);
        
        // Subtle grid pattern over the entire road
        vec2 gridUv = mod(vUv * 20.0, 1.0);
        float gridLine = max(
          step(0.97, gridUv.x) + step(0.97, gridUv.y),
          0.0
        );
        color = mix(color, gridColor, gridLine * 0.3);
        
        // Center line for north-south roads (x-aligned roads)
        if (abs(vUv.y - 0.5) < 0.01) {
          float centerPulse = 0.7 + 0.3 * sin(time * pulseSpeed + vPosition.x * 0.1);
          color = mix(color, lineColor * centerPulse, glowStrength);
        }
        
        // Center line for east-west roads (z-aligned roads)
        if (abs(vUv.x - 0.5) < 0.01) {
          float centerPulse = 0.7 + 0.3 * sin(time * pulseSpeed + vPosition.z * 0.1);
          color = mix(color, lineColor * centerPulse, glowStrength);
        }
        
        // Dashed lines for lane markers on north-south roads
        float dashPattern = step(0.5, fract((vUv.x * 30.0) - time * 0.2));
        if (abs(vUv.y - 0.25) < 0.005 || abs(vUv.y - 0.75) < 0.005) {
          color = mix(color, secondaryLineColor, 0.8 * dashPattern);
        }
        
        // Dashed lines for lane markers on east-west roads
        dashPattern = step(0.5, fract((vUv.y * 30.0) - time * 0.2));
        if (abs(vUv.x - 0.25) < 0.005 || abs(vUv.x - 0.75) < 0.005) {
          color = mix(color, secondaryLineColor, 0.8 * dashPattern);
        }
        
        // Edge highlight
        float edgeGlow = 0.0;
        if (vUv.x < 0.03 || vUv.x > 0.97 || vUv.y < 0.03 || vUv.y > 0.97) {
          edgeGlow = 0.5 + 0.5 * sin(time * 2.0);
          color = mix(color, lineColor, edgeGlow * 0.3);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
  
  // Add animation to road shader
  const clock = new THREE.Clock();
  roadMaterial.onBeforeRender = function(renderer, scene, camera, geometry, object) {
    this.uniforms.time.value = clock.getElapsedTime();
  };
  
  // Create sidewalk material with shader
  const sidewalkMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseColor: { value: new THREE.Color(0x333333) },
      lineColor: { value: new THREE.Color(0x444444) },
      glowColor: { value: new THREE.Color(0x00ffff) }
    },
    vertexShader: `
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      uniform vec3 lineColor;
      uniform vec3 glowColor;
      
      varying vec2 vUv;
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      void main() {
        // Base concrete color with noise
        float noise = random(vUv * 200.0) * 0.1;
        vec3 color = baseColor * (0.9 + noise);
        
        // Grid pattern
        vec2 grid = mod(vUv * 10.0, 1.0);
        float gridLine = step(0.9, grid.x) + step(0.9, grid.y);
        color = mix(color, lineColor, gridLine * 0.5);
        
        // Occasional tech lines that glow
        float techLine = step(0.98, random(floor(vUv * 5.0)));
        float glow = 0.5 + 0.5 * sin(time + vUv.x * 10.0);
        if (techLine > 0.0) {
          color = mix(color, glowColor, glow * 0.3);
        }
        
        // Edge glow near road
        float edgeGlow = 0.0;
        if (vUv.x < 0.05 || vUv.x > 0.95 || vUv.y < 0.05 || vUv.y > 0.95) {
          edgeGlow = 0.3 + 0.2 * sin(time * 1.5 + vUv.x * 5.0 + vUv.y * 5.0);
          color = mix(color, glowColor, edgeGlow * 0.5);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  
  // Add animation to sidewalk shader
  sidewalkMaterial.onBeforeRender = function(renderer, scene, camera, geometry, object) {
    this.uniforms.time.value = clock.getElapsedTime();
  };
  
  // Create roads along X axis (North-South)
  const roadXGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, BLOCK_SIZE);
  const roadX = new THREE.Mesh(roadXGeometry, roadMaterial);
  roadX.rotation.x = -Math.PI / 2;
  roadX.position.set(blockX - BLOCK_SIZE/2, 0.1, blockZ);
  roadX.receiveShadow = true;
  scene.add(roadX);
  roadObjects.push(roadX);
  
  // Create roads along Z axis (East-West)
  const roadZGeometry = new THREE.PlaneGeometry(BLOCK_SIZE, ROAD_WIDTH);
  const roadZ = new THREE.Mesh(roadZGeometry, roadMaterial);
  roadZ.rotation.x = -Math.PI / 2;
  roadZ.position.set(blockX, 0.1, blockZ - BLOCK_SIZE/2);
  roadZ.receiveShadow = true;
  scene.add(roadZ);
  roadObjects.push(roadZ);
  
  // Create sidewalks
  // North sidewalk
  const sidewalkNGeometry = new THREE.PlaneGeometry(BLOCK_SIZE - ROAD_WIDTH, SIDEWALK_WIDTH);
  const sidewalkN = new THREE.Mesh(sidewalkNGeometry, sidewalkMaterial);
  sidewalkN.rotation.x = -Math.PI / 2;
  sidewalkN.position.set(blockX + ROAD_WIDTH/2, 0.2, blockZ - BLOCK_SIZE/2 + ROAD_WIDTH/2 + SIDEWALK_WIDTH/2);
  sidewalkN.receiveShadow = true;
  scene.add(sidewalkN);
  roadObjects.push(sidewalkN);
  
  // South sidewalk
  const sidewalkS = new THREE.Mesh(sidewalkNGeometry, sidewalkMaterial);
  sidewalkS.rotation.x = -Math.PI / 2;
  sidewalkS.position.set(blockX + ROAD_WIDTH/2, 0.2, blockZ + BLOCK_SIZE/2 - ROAD_WIDTH/2 - SIDEWALK_WIDTH/2);
  sidewalkS.receiveShadow = true;
  scene.add(sidewalkS);
  roadObjects.push(sidewalkS);
  
  // West sidewalk
  const sidewalkWGeometry = new THREE.PlaneGeometry(SIDEWALK_WIDTH, BLOCK_SIZE - ROAD_WIDTH);
  const sidewalkW = new THREE.Mesh(sidewalkWGeometry, sidewalkMaterial);
  sidewalkW.rotation.x = -Math.PI / 2;
  sidewalkW.position.set(blockX - BLOCK_SIZE/2 + ROAD_WIDTH/2 + SIDEWALK_WIDTH/2, 0.2, blockZ + ROAD_WIDTH/2);
  sidewalkW.receiveShadow = true;
  scene.add(sidewalkW);
  roadObjects.push(sidewalkW);
  
  // East sidewalk
  const sidewalkE = new THREE.Mesh(sidewalkWGeometry, sidewalkMaterial);
  sidewalkE.rotation.x = -Math.PI / 2;
  sidewalkE.position.set(blockX + BLOCK_SIZE/2 - ROAD_WIDTH/2 - SIDEWALK_WIDTH/2, 0.2, blockZ + ROAD_WIDTH/2);
  sidewalkE.receiveShadow = true;
  scene.add(sidewalkE);
  roadObjects.push(sidewalkE);
  
  return roadObjects;
}

/**
 * Create the ground plane
 * @param {THREE.Scene} scene - The Three.js scene
 */
function createGround(scene) {
  // Create a much larger ground plane
  const groundSize = CITY_SIZE * 20; // Much larger ground
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
  
  // Create cyberpunk ground shader
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      groundColor: { value: new THREE.Color(0x000a14) }, // Very dark blue-teal
      gridColor1: { value: new THREE.Color(0x00ffff) },  // Cyan grid
      gridColor2: { value: new THREE.Color(0xff00ff) },  // Magenta grid
      fadeDistance: { value: 10000.0 },
      gridScale: { value: 500.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 groundColor;
      uniform vec3 gridColor1;
      uniform vec3 gridColor2;
      uniform float fadeDistance;
      uniform float gridScale;
      
      varying vec2 vUv;
      varying vec3 vPosition;
      
      // Random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // Create a grid pattern
      float grid(vec2 pos, float width) {
        vec2 grid = abs(fract(pos - 0.5) - 0.5) / width;
        float line = min(grid.x, grid.y);
        return 1.0 - min(line, 1.0);
      }
      
      // Distance-based fade
      float fade(float dist, float maxDist) {
        return 1.0 - smoothstep(0.0, maxDist, dist);
      }
      
      // Glow effect
      float glow(float dist, float radius, float intensity) {
        return pow(radius/dist, intensity);
      }
      
      void main() {
        // World position for grid
        vec2 worldPos = vPosition.xz;
        
        // Distance-based opacity - fade out in the distance
        float dist = length(worldPos);
        float fadeOut = fade(dist, fadeDistance);
        
        // Main grid (large scale)
        float mainGrid = grid(worldPos / gridScale, 0.03);
        
        // Secondary grid (medium scale)
        float secondaryGrid = grid(worldPos / (gridScale * 0.2), 0.02);
        
        // Tertiary grid (small scale) - more fine lines
        float tertiaryGrid = grid(worldPos / (gridScale * 0.05), 0.01);
        
        // Calculate the final color
        vec3 color = groundColor;
        
        // Add glow effect around the center
        float centerDist = max(length(worldPos) * 0.0004, 0.001);
        float centerGlow = glow(centerDist, 0.5, 1.2) * 0.3;
        color += gridColor1 * centerGlow;
        
        // Add the primary grid with pulse effect for larger grid lines
        float pulse1 = 0.7 + 0.3 * sin(time * 0.5 + worldPos.x * 0.01 + worldPos.y * 0.01);
        color = mix(color, gridColor1 * pulse1, mainGrid * fadeOut * 0.95);
        
        // Add the secondary grid with different pulse effect
        float pulse2 = 0.7 + 0.3 * cos(time * 0.3 - worldPos.x * 0.005);
        color = mix(color, gridColor2 * pulse2, secondaryGrid * fadeOut * 0.8);
        
        // Add the tertiary grid (subtle details)
        color = mix(color, gridColor1 * 0.6, tertiaryGrid * fadeOut * 0.4);
        
        // Add subtle noise
        float noise = random(vUv * 1000.0) * 0.05;
        color += noise * fadeOut * 0.1;
        
        // Add glow effect on intersections - stronger
        float intersectionGlow = mainGrid * secondaryGrid * 3.0;
        float glowPulse = 0.8 + 0.2 * sin(time * 2.0);
        color += (gridColor1 + gridColor2) * 0.5 * intersectionGlow * glowPulse * fadeOut;
        
        // Add overall blue ambient glow to match screenshot
        color += vec3(0.0, 0.1, 0.15) * pow(fadeOut, 0.5) * 0.4;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
  
  // Set up animation loop for the ground
  const clock = new THREE.Clock();
  groundMaterial.onBeforeRender = function(renderer, scene, camera, geometry, object) {
    this.uniforms.time.value = clock.getElapsedTime();
  };
  
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Add an ambient light with blue/cyan tint to enhance the ground glow
  const ambientGlow = new THREE.AmbientLight(0x00aaff, 0.2);
  scene.add(ambientGlow);
}

/**
 * Create a city block with buildings
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} x - The x position of the block
 * @param {number} z - The z position of the block
 * @param {Array} buildingGeometries - Array of building geometries
 * @param {number} seed - Random seed
 * @returns {Array} - Array of objects created in this block
 */
function createCityBlock(scene, x, z, buildingGeometries, seed) {
  const blockObjects = [];
  
  // Use seeded random function
  const random = createRandomGenerator(seed);
  
  // Calculate block dimensions accounting for roads
  const blockSizeX = BLOCK_SIZE - ROAD_WIDTH * 2;
  const blockSizeZ = BLOCK_SIZE - ROAD_WIDTH * 2;
  
  // Calculate distance from player's current chunk
  const distanceFromPlayer = Math.sqrt(
    Math.pow((x - playerChunkX * CHUNK_SIZE), 2) + 
    Math.pow((z - playerChunkZ * CHUNK_SIZE), 2)
  );
  
  // Determine if this is a distant block
  const isDistantBlock = distanceFromPlayer > CHUNK_SIZE * 1.5;
  
  // For distant blocks, use fewer, simpler buildings
  const numBuildings = isDistantBlock ? 
    Math.max(1, Math.floor(NUM_BUILDINGS_PER_BLOCK / 2)) : 
    NUM_BUILDINGS_PER_BLOCK;
  
  // Generate buildings in this block
  for (let i = 0; i < numBuildings; i++) {
    // Determine building position within block - more spread out
    const buildingX = x + (random() - 0.5) * blockSizeX * 0.6;
    const buildingZ = z + (random() - 0.5) * blockSizeZ * 0.6;
    
    // Determine building height
    const height = MIN_BUILDING_HEIGHT + random() * (MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT);
    
    // Determine building width and depth
    const width = 10 + random() * 30;
    const depth = 10 + random() * 30;
    
    // Choose a random building geometry index
    const geometryIndex = Math.floor(random() * buildingGeometries.length);
    
    if (isDistantBlock) {
      // For distant buildings, use simplified representation
      const building = createSimplifiedBuilding(
        scene, buildingX, buildingZ, width, height, depth, random
      );
      blockObjects.push(building);
    } else {
      // Create detailed building with LOD for closer blocks
      const building = createLODBuilding(
        scene, buildingX, buildingZ, width, height, depth, 
        buildingGeometries[geometryIndex], random
      );
      
      blockObjects.push(building);
      
      // Add to collision data for physics
      buildingCollisions.push({
        position: {
          x: buildingX,
          y: height / 2,
          z: buildingZ
        },
        size: {
          x: width,
          y: height,
          z: depth
        }
      });
      
      // Add billboard to some tall buildings (only for non-distant blocks)
      if (height > MAX_BUILDING_HEIGHT * 0.7 && random() > 0.6) {
        const billboard = addBillboardToBuilding(scene, building);
        blockObjects.push(billboard);
      }
    }
  }
  
  return blockObjects;
}

/**
 * Create a simplified building for distant viewing
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} x - X position
 * @param {number} z - Z position
 * @param {number} width - Building width
 * @param {number} height - Building height
 * @param {number} depth - Building depth
 * @param {Function} random - Random function
 * @returns {THREE.Mesh} - The building mesh
 */
function createSimplifiedBuilding(scene, x, z, width, height, depth, random) {
  // Use a simple box geometry with no details
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  
  // Create a single color material with no textures
  const hue = random() * 0.1 + 0.6; // Blue to purple hues
  const saturation = 0.3 + random() * 0.3;
  const lightness = 0.2 + random() * 0.1;
  
  const color = new THREE.Color().setHSL(hue, saturation, lightness);
  
  const material = new THREE.MeshBasicMaterial({
    color: color,
    emissive: color.clone().multiplyScalar(0.2)
  });
  
  // Create the building mesh
  const building = new THREE.Mesh(geometry, material);
  
  // Scale the building
  building.scale.set(width, height, depth);
  
  // Position the building
  building.position.set(x, height / 2, z);
  
  // Add to scene
  scene.add(building);
  
  return building;
}

/**
 * Create a building with Level of Detail (LOD) for closer viewing
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} x - X position
 * @param {number} z - Z position
 * @param {number} width - Building width
 * @param {number} height - Building height
 * @param {number} depth - Building depth
 * @param {THREE.BufferGeometry} geometry - Building geometry
 * @param {Function} random - Random function
 * @returns {THREE.LOD} - The LOD object containing the building
 */
function createLODBuilding(scene, x, z, width, height, depth, geometry, random) {
  // Create LOD object
  const lod = new THREE.LOD();
  lod.position.set(x, height / 2, z);
  
  // Get building material
  const material = getTexturedBuildingMaterial(random);
  
  // Level 0 (high detail, close distance)
  const highDetailBuilding = new THREE.Mesh(geometry, material);
  highDetailBuilding.scale.set(width, height, depth);
  highDetailBuilding.castShadow = true;
  highDetailBuilding.receiveShadow = true;
  lod.addLevel(highDetailBuilding, 0);    // Visible from 0-300 units
  
  // Level 1 (medium detail, medium distance)
  const mediumDetailGeometry = new THREE.BoxGeometry(1, 1, 1);
  const mediumDetailBuilding = new THREE.Mesh(mediumDetailGeometry, material);
  mediumDetailBuilding.scale.set(width, height, depth);
  mediumDetailBuilding.castShadow = true;
  lod.addLevel(mediumDetailBuilding, 300); // Visible from 300-800 units
  
  // Level 2 (low detail, long distance)
  const lowDetailGeometry = new THREE.BoxGeometry(1, 1, 1);
  const lowDetailMaterial = new THREE.MeshBasicMaterial({
    color: material.color,
    emissive: material.emissive
  });
  const lowDetailBuilding = new THREE.Mesh(lowDetailGeometry, lowDetailMaterial);
  lowDetailBuilding.scale.set(width, height, depth);
  lod.addLevel(lowDetailBuilding, 800);   // Visible from 800+ units
  
  // Add LOD to scene
  scene.add(lod);
  
  // Add window details only to the high detail level
  if (random() > 0.4) {
    addBuildingWindows(scene, highDetailBuilding, random);
  }
  
  return lod;
}

/**
 * Get a building material using procedural shaders instead of textures
 * @param {Function} random - Random function
 * @returns {THREE.Material} - Building material with shader
 */
function getTexturedBuildingMaterial(random) {
  // Create a color based on random value - cyberpunk palette
  // Using darker base colors with blue/teal tint
  const hue = 0.55 + random() * 0.1; // Blue to teal range
  const saturation = 0.2 + random() * 0.2; // Lower saturation for darker buildings
  const lightness = 0.1 + random() * 0.05; // Darker overall
  
  const baseColor = new THREE.Color().setHSL(hue, saturation, lightness);
  const glowColor = new THREE.Color(0x00ffff); // Cyan for the glow/outline
  const accentColor = new THREE.Color(random() > 0.5 ? 0xff00ff : 0x00ffff); // Magenta or cyan
  const windowColor = new THREE.Color(0xeeeeff); // Slightly blue-tinted windows
  
  // Use cached materials if possible
  const materialKey = `${Math.floor(hue * 100)}_${Math.floor(saturation * 100)}_${Math.floor(lightness * 100)}`;
  
  if (materialCache[materialKey]) {
    return materialCache[materialKey];
  }
  
  // Create new shader material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      baseColor: { value: baseColor },
      glowColor: { value: glowColor },
      accentColor: { value: accentColor },
      windowColor: { value: windowColor },
      windowSize: { value: 0.025 + random() * 0.015 },
      windowSpacing: { value: 0.06 + random() * 0.04 },
      glowIntensity: { value: 0.7 + random() * 0.3 }, // Stronger glow
      outlineWidth: { value: 0.03 + random() * 0.02 }, // Edge highlight width
      noiseScale: { value: 100.0 },
      hasPattern: { value: random() > 0.3 ? 1.0 : 0.0 } // Some buildings have patterns
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 baseColor;
      uniform vec3 glowColor;
      uniform vec3 accentColor;
      uniform vec3 windowColor;
      uniform float windowSize;
      uniform float windowSpacing;
      uniform float glowIntensity;
      uniform float outlineWidth;
      uniform float noiseScale;
      uniform float hasPattern;
      
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      // Random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      // Create a window grid pattern
      float windowGrid(vec2 uv, float size, float spacing) {
        vec2 grid = mod(uv, vec2(spacing));
        return step(grid.x, size) * step(grid.y, size);
      }
      
      // Line pattern for some variety
      float linePattern(vec2 uv, float scale, float thickness) {
        float line = step(mod(uv.y * scale, 1.0), thickness);
        return line;
      }
      
      void main() {
        // Base color that varies with height (darker at bottom, lighter at top)
        vec3 color = baseColor * (0.7 + 0.5 * vUv.y);
        
        // Calculate edges for glow effect
        float edgeFactor = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
        
        // Apply stronger edge glow to create the outlined look
        float edgeGlow = smoothstep(1.0 - outlineWidth * 2.0, 1.0, edgeFactor);
        color = mix(color, glowColor, edgeGlow * glowIntensity);
        
        // Add horizontal accent lines on some buildings
        float lineEffect = linePattern(vUv, 20.0, 0.05) * hasPattern;
        color = mix(color, accentColor, lineEffect * 0.5);
        
        // Create scaled UVs for window grid
        vec2 scaledUv = vUv * 20.0;
        
        // Window pattern based on world position for better alignment
        float xzWindow = windowGrid(vec2(vWorldPosition.x * 0.05, vWorldPosition.y * 0.05), windowSize, windowSpacing);
        float xyWindow = windowGrid(vec2(vWorldPosition.x * 0.05, vWorldPosition.z * 0.05), windowSize, windowSpacing);
        float zyWindow = windowGrid(vec2(vWorldPosition.z * 0.05, vWorldPosition.y * 0.05), windowSize, windowSpacing);
        
        // Combine window patterns based on normal direction
        float windowMask = 0.0;
        windowMask += xzWindow * abs(vNormal.y) * 0.5;
        windowMask += xyWindow * abs(vNormal.z) * 0.8;
        windowMask += zyWindow * abs(vNormal.x) * 0.8;
        
        // Window flicker effect - more random and varied
        float flickerSpeed = 0.3 + random(vec2(floor(vWorldPosition.x), floor(vWorldPosition.z))) * 0.5;
        float flickerPhase = random(vec2(floor(vWorldPosition.y * 0.2), floor(vWorldPosition.x * 0.2))) * 10.0;
        float flicker = 0.7 + 0.3 * sin(time * flickerSpeed + flickerPhase);
        
        // Some windows stay consistently bright
        float brightWindow = step(0.93, random(floor(scaledUv / windowSpacing)));
        float windowBrightness = mix(flicker, 1.0, brightWindow);
        
        // Apply window glow with flicker
        float glow = windowMask * windowBrightness;
        
        // Add some noise texture
        float noise = random(vUv * noiseScale) * 0.03;
        
        // Apply glow from windows - brighter and more vibrant
        color = mix(color * (0.97 + noise), windowColor, glow * glowIntensity * 1.2);
        
        // Final edge highlight for that neon outline look
        color = mix(color, glowColor, edgeGlow * 0.6 * (0.8 + 0.2 * sin(time * 0.5)));
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
  
  // Set up animation in the render loop
  const clock = new THREE.Clock();
  material.onBeforeRender = function(renderer, scene, camera, geometry, object) {
    this.uniforms.time.value = clock.getElapsedTime();
  };
  
  // Cache the material
  materialCache[materialKey] = material;
  
  return material;
}

/**
 * Creates a random number generator with a seed
 * @param {number} seed - The seed for the random generator
 * @returns {Function} - Seeded random function
 */
function createRandomGenerator(seed) {
  let currentSeed = seed;
  return function() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

/**
 * Simple hash function to convert string to number
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Add windows to a building
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.Mesh} building - The building mesh
 * @param {Function} random - Seeded random function
 */
function addBuildingWindows(scene, building, random) {
  // Skip window creation more often for performance
  if (random() > 0.2) return; // Even more likely to skip windows
  
  // Calculate window size based on building size
  const windowSize = Math.max(1, building.scale.x * 0.05);
  const windowSpacing = windowSize * 4; // Increased spacing
  
  // Calculate number of windows - reduced by using higher spacing
  const windowsX = Math.floor(building.scale.x / windowSpacing);
  const windowsY = Math.floor(building.scale.y / windowSpacing);
  const windowsZ = Math.floor(building.scale.z / windowSpacing);
  
  // Maximum windows per side for performance
  const maxWindowsPerSide = 12;
  
  // Use instanced rendering for windows
  const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(random(), random(), random()).multiplyScalar(0.5).add(new THREE.Color(0.5, 0.5, 0.5)),
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 0.5 + random() * 0.5
  });

  // Window positions - only do two sides most of the time
  const numSides = random() > 0.7 ? 4 : 2;
  const positions = [
    { dir: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2 },  // +X
    { dir: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2 }, // -X
    { dir: new THREE.Vector3(0, 0, 1), rotY: 0 },            // +Z
    { dir: new THREE.Vector3(0, 0, -1), rotY: Math.PI }      // -Z
  ].slice(0, numSides);
  
  // Create a window texture instead of geometry for distant buildings
  if (building.position.distanceTo(new THREE.Vector3(playerChunkX * CHUNK_SIZE, 0, playerChunkZ * CHUNK_SIZE)) > CHUNK_SIZE) {
    // For distant buildings, use a texture with window pattern instead of geometry
    const windowPattern = createWindowPatternTexture(random);
    
    // Apply the window pattern to the building's emissive map
    building.material.emissiveMap = windowPattern;
    building.material.emissive = new THREE.Color(1, 1, 1);
    building.material.emissiveIntensity = 0.2;
    building.material.needsUpdate = true;
    return;
  }
  
  // Create windows on each side of the building - reduced the number of windows
  positions.forEach(({ dir, rotY }) => {
    const maxX = building.scale.x / 2 - windowSize;
    const maxZ = building.scale.z / 2 - windowSize;
    
    // Limit windows for performance
    const numWindowsY = Math.min(windowsY, maxWindowsPerSide);
    const windowsPerFloor = Math.min(2, Math.floor(random() * 3)); // Max 2 windows per floor
    
    // Create windows for each floor
    for (let y = 0; y < numWindowsY; y += 2) { // Skip every other floor for performance
      for (let i = 0; i < windowsPerFloor; i++) {
        const x = (random() * 2 - 1) * maxX;
        const z = (random() * 2 - 1) * maxZ;
        const yPos = -building.scale.y / 2 + windowSpacing / 2 + y * windowSpacing;
        
        // Create window
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.rotation.y = rotY;
        
        // Position window on building face
        if (dir.x !== 0) {
          window.position.set(
            dir.x * (building.scale.x / 2 + 0.1),
            yPos,
            z
          );
        } else {
          window.position.set(
            x,
            yPos,
            dir.z * (building.scale.z / 2 + 0.1)
          );
        }
        
        // Add to building
        building.add(window);
      }
    }
  });
}

/**
 * Create a window pattern texture for distant buildings
 * @param {Function} random - Seeded random function
 * @returns {THREE.Texture} - Window pattern texture
 */
function createWindowPatternTexture(random) {
  // Create a canvas for the window pattern
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Fill with building color
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add window pattern
  ctx.fillStyle = `rgba(255, 255, ${Math.floor(random() * 100 + 155)}, 0.8)`;
  
  const gridSize = 8;
  const windowSize = 3;
  const randomize = () => random() > 0.3; // 70% chance to have a window
  
  for (let x = 0; x < canvas.width; x += gridSize) {
    for (let y = 0; y < canvas.height; y += gridSize) {
      if (randomize()) {
        ctx.fillRect(x + 2, y + 2, windowSize, windowSize);
      }
    }
  }
  
  // Convert canvas to texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.ceil(random() * 5) + 1, Math.ceil(random() * 10) + 1);
  
  return texture;
}

/**
 * Add a billboard to a building
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.Mesh} building - The building mesh
 * @returns {THREE.Group} - The billboard object
 */
function addBillboardToBuilding(scene, building) {
  // Determine billboard size based on building size
  const width = building.scale.x * 0.8;
  const height = building.scale.y * 0.3;
  
  // Create billboard
  const billboard = createBillboard(width, height);
  
  // Position billboard on top of building
  billboard.position.y = building.position.y + building.scale.y / 2 + height / 2;
  billboard.position.x = building.position.x;
  billboard.position.z = building.position.z;
  
  // Add to scene
  scene.add(billboard);
  
  return billboard;
}

/**
 * Create a skybox for the cyberpunk city
 * @param {THREE.Scene} scene - The Three.js scene
 */
function createSkybox(scene) {
  // Create a large sphere for the sky
  const skyGeometry = new THREE.SphereGeometry(CITY_SIZE * 2, 64, 64);
  
  // Create enhanced cyberpunk sky shader
  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 middleColor;
    uniform vec3 bottomColor;
    uniform vec3 gridColor;
    uniform float offset;
    uniform float exponent;
    uniform float time;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    // Random function
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    
    // Grid pattern for digital horizon effect
    float grid(vec2 st, float size) {
      vec2 p = st;
      p *= 100.0; // Grid scale
      
      vec2 ipos = floor(p);  // Get the integer coords
      
      // Uncomment for fluctuating grid
      if (random(ipos * 0.01 + time * 0.001) > 0.996) {
        return 1.0;
      }
      
      vec2 fpos = fract(p);  // Get the fractional coords
      
      float line = step(size, fpos.x) * step(size, fpos.y);
      return 1.0 - line;
    }
    
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      
      // Three-color gradient
      vec3 gradientColor;
      if (h < 0.0) {
        // Bottom half - blend from bottom to middle
        float t = h + 0.5;
        gradientColor = mix(bottomColor, middleColor, pow(t * 2.0, exponent));
      } else {
        // Top half - blend from middle to top
        gradientColor = mix(middleColor, topColor, pow(h * 2.0, exponent));
      }
      
      // Add horizon grid effect (visible only near horizon)
      float horizon = pow(1.0 - abs(h * 2.0), 20.0); // Band around horizon
      
      // Sample grid based on world position
      vec2 gridUv = vec2(
        atan(vWorldPosition.x, vWorldPosition.z) / (3.14159 * 2.0) + 0.5, 
        0.5 + vWorldPosition.y * 0.001
      );
      
      float gridPattern = grid(gridUv, 0.9) * horizon * 0.7;
      
      // Add stars/lights in the lower part only
      float stars = 0.0;
      if (h < 0.0) {
        vec2 starPos = vUv * 100.0 + time * 0.01;
        stars = step(0.995, random(floor(starPos)));
        stars *= smoothstep(-0.3, -0.1, h); // Only in lower part
      }
      
      // Add grid lines with time animation at the horizon
      gridPattern += grid(gridUv + vec2(time * 0.01, 0.0), 0.8) * horizon * 0.3;
      
      // Mix grid into gradient color
      vec3 finalColor = mix(gradientColor, gridColor, gridPattern);
      
      // Add stars
      finalColor += stars * gridColor * 2.0;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;
  
  const uniforms = {
    topColor: { value: new THREE.Color(0x000000) }, // Black at top
    middleColor: { value: new THREE.Color(0x001020) }, // Dark blue in middle
    bottomColor: { value: new THREE.Color(0x0a0060) }, // Deep purple at bottom
    gridColor: { value: new THREE.Color(0x00ffff) }, // Cyan grid
    offset: { value: 500 },
    exponent: { value: 0.8 },
    time: { value: 0 }
  };
  
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide
  });
  
  // Set up animation loop for the sky
  const clock = new THREE.Clock();
  skyMaterial.onBeforeRender = function(renderer, scene, camera, geometry, object) {
    this.uniforms.time.value = clock.getElapsedTime();
  };
  
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky);
  
  // Digital rain/stars effect is now part of the sky shader
}

/**
 * Create additional city lights
 * @param {THREE.Scene} scene - The THREE.js scene
 */
function createCityLights(scene) {
  // Distant city glow (large area lights)
  const cityGlowColors = [0x00ffff, 0xff00ff, 0x3333ff, 0x00ff88];
  
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const distance = CITY_SIZE * 0.7;
    const height = 100 + Math.random() * 200;
    
    const color = cityGlowColors[Math.floor(Math.random() * cityGlowColors.length)];
    const intensity = 1.5 + Math.random() * 2.0;
    const light = new THREE.PointLight(color, intensity, 2000, 2);
    
    light.position.set(
      Math.sin(angle) * distance,
      height,
      Math.cos(angle) * distance
    );
    
    scene.add(light);
  }
  
  // Add a spotlight to simulate moon/main light source
  const moonLight = new THREE.SpotLight(0x8888ff, 0.8, 4000, Math.PI / 5, 0.3);
  moonLight.position.set(500, 1000, 500);
  moonLight.castShadow = true;
  scene.add(moonLight);
  
  // Add fog with cyan tint to create depth and atmosphere
  scene.fog = new THREE.FogExp2(0x001020, 0.0007);
}

/**
 * Create independent billboards not attached to buildings
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {number} centerX - Center X position of chunk
 * @param {number} centerZ - Center Z position of chunk
 * @param {number} seed - Random seed
 * @returns {Array} - Array of billboard objects
 */
function createIndependentBillboards(scene, centerX, centerZ, seed) {
  const billboardObjects = [];
  const random = createRandomGenerator(seed + 12345); // Different seed than buildings
  
  // Number of independent billboards to create in this chunk
  const numBillboards = Math.floor(random() * 3) + 1; // 1-3 billboards per chunk
  
  for (let i = 0; i < numBillboards; i++) {
    // Determine size and position
    const width = 20 + random() * 40; // Wider than building billboards
    const height = 10 + random() * 20; 
    
    // Position within chunk (spread out from center)
    const offsetX = (random() - 0.5) * CHUNK_SIZE * 0.8;
    const offsetZ = (random() - 0.5) * CHUNK_SIZE * 0.8;
    const billboardX = centerX + offsetX;
    const billboardZ = centerZ + offsetZ;
    
    // Height - either high up or at street level
    const billboardHeight = random() > 0.7 ? 
      100 + random() * 100 : // High billboard
      20 + random() * 10;    // Street level
    
    // Create the billboard
    const billboard = createBillboard(width, height);
    
    // Position the billboard
    billboard.position.set(billboardX, billboardHeight, billboardZ);
    
    // Random rotation (face random direction)
    billboard.rotation.y = random() * Math.PI * 2;
    
    // Add supports/frame for the billboard
    addBillboardSupports(scene, billboard, billboardHeight, width, height);
    
    // Add to scene
    scene.add(billboard);
    billboardObjects.push(billboard);
    
    // Add collision data for the billboard
    buildingCollisions.push({
      position: {
        x: billboardX,
        y: billboardHeight,
        z: billboardZ
      },
      size: {
        x: width,
        y: height,
        z: 5
      }
    });
  }
  
  return billboardObjects;
}

/**
 * Add structural supports to independent billboards
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {THREE.Group} billboard - The billboard group
 * @param {number} height - Height of billboard from ground
 * @param {number} width - Width of billboard
 * @param {number} billboardHeight - Height of billboard panel
 */
function addBillboardSupports(scene, billboard, height, width, billboardHeight) {
  // Create support material
  const supportMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.7,
    metalness: 0.5
  });
  
  // Main support pole
  const poleGeometry = new THREE.CylinderGeometry(1, 1, height * 2, 8);
  const pole = new THREE.Mesh(poleGeometry, supportMaterial);
  pole.position.set(0, -height, 0);
  billboard.add(pole);
  
  // Add cross supports for wider billboards
  if (width > 30) {
    // Horizontal support
    const crossBeamGeometry = new THREE.BoxGeometry(width * 0.9, 2, 2);
    const crossBeam = new THREE.Mesh(crossBeamGeometry, supportMaterial);
    crossBeam.position.set(0, -billboardHeight/2 - 2, -2);
    billboard.add(crossBeam);
    
    // Additional support legs
    const legGeometry = new THREE.CylinderGeometry(0.8, 0.8, height * 0.8, 6);
    
    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, supportMaterial);
    leftLeg.position.set(-width * 0.4, -height * 0.6, 0);
    leftLeg.rotation.z = Math.PI * 0.05; // slight angle
    billboard.add(leftLeg);
    
    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, supportMaterial);
    rightLeg.position.set(width * 0.4, -height * 0.6, 0);
    rightLeg.rotation.z = -Math.PI * 0.05; // slight angle
    billboard.add(rightLeg);
  }
} 