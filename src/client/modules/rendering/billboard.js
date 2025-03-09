import * as THREE from 'three';

// Array of billboard textures
const billboardTextures = [];

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

// Loading manager
const loadManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadManager);

/**
 * Create a billboard for a building
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @returns {THREE.Group} - The billboard group object
 */
export function createBillboard(width, height) {
  // Create group to hold billboard elements
  const billboardGroup = new THREE.Group();
  
  // Create the billboard frame
  const frameGeometry = new THREE.BoxGeometry(width + 2, height + 2, 1);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x222222
  });
  
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.z = -0.5;
  billboardGroup.add(frame);
  
  // Create the billboard screen
  const screenGeometry = new THREE.PlaneGeometry(width, height);
  
  // Create screen material with texture or procedural content
  const material = getBillboardMaterial(width, height);
  
  const screen = new THREE.Mesh(screenGeometry, material);
  screen.position.z = 0.1;
  billboardGroup.add(screen);
  
  // Add neon light around the frame
  addNeonBorder(billboardGroup, width, height);
  
  // Set up rotation for update
  billboardGroup.userData = {
    rotationSpeed: (Math.random() - 0.5) * 0.001,
    adChangeInterval: 5000 + Math.random() * 15000,
    lastAdChange: Date.now(),
    width,
    height,
    screen: screen
  };
  
  // Randomly rotate the billboard slightly
  billboardGroup.rotation.y = (Math.random() - 0.5) * 0.2;
  
  return billboardGroup;
}

/**
 * Add neon border to the billboard
 * @param {THREE.Group} group - The billboard group
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 */
function addNeonBorder(group, width, height) {
  // Create neon border as a wireframe
  const borderGeometry = new THREE.BoxGeometry(width + 2.5, height + 2.5, 1.5);
  const edges = new THREE.EdgesGeometry(borderGeometry);
  
  // Random neon color
  const neonColors = [0xff00ff, 0x00ffff, 0xffff00, 0xff3300, 0x33ff00];
  const color = neonColors[Math.floor(Math.random() * neonColors.length)];
  
  const neonMaterial = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
    emissive: color,
    emissiveIntensity: 2
  });
  
  const border = new THREE.LineSegments(edges, neonMaterial);
  border.position.z = 0;
  group.add(border);
  
  // Add a glow effect
  const glowGeometry = new THREE.PlaneGeometry(width + 6, height + 6);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec2 vUv;
      void main() {
        float intensity = 0.4 - distance(vUv, vec2(0.5, 0.5));
        gl_FragColor = vec4(glowColor, max(0.0, intensity * 0.5));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.z = -1;
  group.add(glow);
}

/**
 * Get a billboard material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @returns {THREE.Material} - The billboard material
 */
function getBillboardMaterial(width, height) {
  // Use a cached texture sometimes, or create a new one
  if (billboardTextures.length > 0 && Math.random() > 0.7) {
    return billboardTextures[Math.floor(Math.random() * billboardTextures.length)].clone();
  }
  
  // Decide between video, image, or procedural texture
  const textureType = Math.random();
  
  if (textureType > 0.7) {
    // Create procedural texture
    return createProceduralAdMaterial(width, height);
  } else if (textureType > 0.3) {
    // Create text-based ad
    return createTextAdMaterial(width, height);
  } else {
    // Create animated ad (shader)
    return createAnimatedAdMaterial(width, height);
  }
}

/**
 * Create a procedural ad material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @returns {THREE.Material} - The billboard material
 */
function createProceduralAdMaterial(width, height) {
  // Create a canvas to draw the ad
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512 * (height / width);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'));
  gradient.addColorStop(1, '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add some shapes
  const numShapes = 5 + Math.floor(Math.random() * 10);
  for (let i = 0; i < numShapes; i++) {
    ctx.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    
    const shapeType = Math.random();
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create material with texture
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.5
  });
  
  // Cache the material for future use
  if (billboardTextures.length < 10) {
    billboardTextures.push(material);
  }
  
  return material;
}

/**
 * Create a text-based ad material
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @returns {THREE.Material} - The billboard material
 */
function createTextAdMaterial(width, height) {
  // Create a canvas to draw the ad
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512 * (height / width);
  const ctx = canvas.getContext('2d');
  
  // Fill background with dark color
  ctx.fillStyle = '#' + Math.floor(Math.random() * 0x333333).toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add neon text effect
  const text = DEFAULT_BILLBOARD_TEXT[Math.floor(Math.random() * DEFAULT_BILLBOARD_TEXT.length)];
  const fontSize = Math.min(canvas.width / text.length * 1.5, canvas.height / 2);
  
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text glow
  const neonColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  
  // Draw text
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create material with texture
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.5
  });
  
  // Cache the material for future use
  if (billboardTextures.length < 10) {
    billboardTextures.push(material);
  }
  
  return material;
}

/**
 * Create an animated ad material using shaders
 * @param {number} width - The width of the billboard
 * @param {number} height - The height of the billboard
 * @returns {THREE.Material} - The billboard material
 */
function createAnimatedAdMaterial(width, height) {
  // Choose a random type of animated effect
  const effectType = Math.floor(Math.random() * 3);
  
  // Common vertex shader
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  let fragmentShader;
  let uniforms;
  
  if (effectType === 0) {
    // Wave effect
    fragmentShader = `
      uniform float time;
      uniform vec3 color1;
      uniform vec3 color2;
      varying vec2 vUv;
      
      void main() {
        float wave = sin(vUv.x * 10.0 + time) * 0.5 + 0.5;
        vec3 color = mix(color1, color2, wave);
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    uniforms = {
      time: { value: 0 },
      color1: { value: new THREE.Color(Math.random(), Math.random(), Math.random()) },
      color2: { value: new THREE.Color(Math.random(), Math.random(), Math.random()) }
    };
  } else if (effectType === 1) {
    // Noise effect
    fragmentShader = `
      uniform float time;
      uniform vec3 baseColor;
      varying vec2 vUv;
      
      // Simple pseudo-random function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      void main() {
        vec2 pos = vUv * 5.0;
        pos.x += time * 0.5;
        
        float r = random(floor(pos));
        vec3 color = baseColor * (0.5 + r * 0.5);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    uniforms = {
      time: { value: 0 },
      baseColor: { value: new THREE.Color(Math.random(), Math.random(), Math.random()) }
    };
  } else {
    // Circle pulse effect
    fragmentShader = `
      uniform float time;
      uniform vec3 color1;
      uniform vec3 color2;
      varying vec2 vUv;
      
      void main() {
        float dist = distance(vUv, vec2(0.5));
        float pulse = sin(dist * 15.0 - time * 2.0) * 0.5 + 0.5;
        vec3 color = mix(color1, color2, pulse);
        gl_FragColor = vec4(color, 1.0);
      }
    `;
    
    uniforms = {
      time: { value: 0 },
      color1: { value: new THREE.Color(Math.random(), Math.random(), Math.random()) },
      color2: { value: new THREE.Color(Math.random(), Math.random(), Math.random()) }
    };
  }
  
  // Create shader material
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader
  });
  
  // Set update function to animate over time
  material.userData = {
    update: function(delta) {
      if (material.uniforms.time) {
        material.uniforms.time.value += delta;
      }
    }
  };
  
  return material;
}

/**
 * Update a billboard
 * @param {THREE.Group} billboard - The billboard to update
 * @param {number} deltaTime - Time since last update in seconds
 */
export function updateBillboard(billboard, deltaTime) {
  // Rotate the billboard slightly for subtle movement
  if (billboard.userData.rotationSpeed) {
    billboard.rotation.y += billboard.userData.rotationSpeed * deltaTime;
  }
  
  // Check if material has an update function (animated shader)
  if (billboard.userData.screen && 
      billboard.userData.screen.material.userData && 
      billboard.userData.screen.material.userData.update) {
    billboard.userData.screen.material.userData.update(deltaTime);
  }
  
  // Change billboard ad occasionally
  if (Date.now() - billboard.userData.lastAdChange > billboard.userData.adChangeInterval) {
    billboard.userData.lastAdChange = Date.now();
    
    // Change the ad
    if (billboard.userData.screen) {
      const width = billboard.userData.width;
      const height = billboard.userData.height;
      billboard.userData.screen.material = getBillboardMaterial(width, height);
    }
  }
} 