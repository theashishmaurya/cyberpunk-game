
# Product Requirements Document (PRD)

## Cyberpunk Flying Car Game

### 1. Overview

This is a web-based, multiplayer, open-world game set in a futuristic cyberpunk city. Players control flying cars, engage in laser combat, and explore a dynamic cityscape featuring billboard advertisements. The game leverages **Three.js** for 3D rendering and **WebSockets** for real-time multiplayer interactions. It’s designed to be performant, accessible across devices (desktops, tablets, and mobile phones), and built with a modular codebase.

---

### 2. Key Features

#### Cyberpunk City with Dynamic Billboards

- A procedurally generated city featuring tall buildings, neon lights, and a cyberpunk aesthetic.
- Billboards on buildings display rotating ads (textures or videos) managed by a simple ad engine.
- Ads update based on timers or player proximity to enhance immersion.

#### Flying Cars with Laser Combat

- Players pilot flying cars with airplane-like controls (pitch, yaw, roll, forward/backward movement).
- Cars can fire lasers, visualized as beams with particle effects on impact.
- Basic collision detection for interactions with buildings and other cars.

#### Real-Time Multiplayer via WebSockets

- Players join a shared game world and see each other’s movements and actions in real-time.
- Supports at least 10 concurrent players per instance with smooth synchronization.
- Persistent world with an initial small city area, expandable later.

#### Performance and Accessibility

- Optimized for low-latency gameplay across devices, including low-end mobile phones.
- Uses low-poly models and optimization techniques (e.g., level-of-detail systems, frustum culling).
- Prioritizes responsiveness over graphical fidelity.

#### Modular Codebase

- Organized into distinct modules: game logic, rendering, networking, and assets.
- Follows a simple structure (e.g., Model-View-Controller or similar) for maintainability.
- Uses ES6 modules or a bundler (e.g., Parcel) for clean code organization.

---

### 3. Technical Requirements

#### Frontend

- **Three.js**: Renders the 3D city, cars, lasers, and particle effects.
- **Low-Poly Assets**: Simple models for buildings, cars, and objects to keep performance light.
- **Procedural Generation**: Algorithmically creates the city layout (buildings, roads, etc.).
- **Optimization Techniques**:
  - **Level of Detail (LOD)**: Simplifies distant objects.
  - **Frustum Culling**: Excludes off-screen objects from rendering.
  - **Compressed Textures**: Reduces memory usage for billboards and visuals.

#### Backend

- **Node.js with Express**: Hosts the game server.
- **WebSockets (Socket.io)**: Enables real-time communication for multiplayer features.
  - Clients send inputs (movement, shooting) to the server.
  - Server updates and broadcasts the authoritative game state (player positions, actions).
- **Ad Engine**: Server-side logic to rotate and update billboard ads.

#### Networking (WebSockets Focus)

- **Client-Server Model**:
  - Clients send inputs to the server via WebSockets.
  - Server processes inputs, updates the game state, and pushes updates to all clients.
- **Optimized Data Transfer**:
  - Only send essential updates (e.g., position changes, laser shots).
  - Use interpolation on the client side to smooth out movements despite latency.
- **Scalability**: Supports at least 10 players with minimal lag; future-proof for more.

#### Performance Optimizations

- **Batch Rendering**: Groups static objects (e.g., buildings) for faster rendering.
- **Profiling**: Regular testing on low-end devices to ensure 30+ FPS.

#### Modular Code Structure

- **Game Logic Module**: Manages player inputs, car physics, and combat mechanics.
- **Rendering Module**: Handles Three.js scene setup, camera, and drawing.
- **Networking Module**: Manages WebSocket connections and game state synchronization.
- **Assets Module**: Loads and organizes 3D models, textures, and ad content.
- **Ad Engine Module**: Controls billboard ad updates.

---

### 4. User Interface (UI)

- **Controls**:
  - Desktop: Keyboard (WASD + arrow keys) and mouse.
  - Mobile: On-screen joysticks for movement, buttons for shooting.
- **HUD**:
  - Health bar for the player’s car.
  - Optional mini-map or radar showing nearby players.
- **Ad Integration**:
  - Non-intrusive notifications or visual cues tied to billboard ads (optional).

---

### 5. Game Mechanics

#### Flying Mechanics

- Free 3D movement with basic physics (acceleration, deceleration).
- Optional gravity for added realism (configurable).

#### Laser Combat

- Lasers fire with a 1-second cooldown, rendered as beams or lines.
- Hits trigger particle effects and reduce target health.

#### Health and Respawn

- Cars have a health bar; at zero health, they respawn after a 3-second delay.
- Respawn points are distributed across the city.

#### Collisions

- Basic detection for cars hitting buildings or other players.
- Collisions cause damage or a bounce effect (design choice).

---

### 6. Development Phases

#### Phase 1: Prototype 

- Build a small city with basic buildings and billboards.
- Implement flying car controls and laser shooting.
- Test on multiple devices for initial performance feedback.

#### Phase 2: Multiplayer via WebSockets 

- Set up a Node.js server with Socket.io for WebSocket integration.
- Enable real-time player syncing (positions, actions).
- Test with 5-10 players in the same instance.

#### Phase 3: Optimization and Expansion 

- Add LOD, culling, and networking optimizations.
- Expand the city and enhance the ad engine (e.g., proximity-based ads).

#### Phase 4: Polish and Launch Finalize UI (health bar, controls), add sound effects, and optimize further.

- Release a beta version for testing and feedback.

---

### 7. Challenges and Mitigation

#### Networking Lag

- **Solution**: Use client-side prediction and interpolation via WebSockets to mask latency.
- Start with basic syncing (positions) and scale up.

#### Performance on Weak Devices

- **Solution**: Prioritize optimization early; test on low-end hardware regularly.

#### Scope Creep

- **Solution**: Focus on core features (city, cars, multiplayer) before extras.

---

### 8. Success Criteria

- Runs at 30+ FPS on mid-range devices (e.g., a 3-year-old phone).
- Supports 10 players in one instance with minimal lag via WebSockets.
- Ad engine rotates billboards smoothly without performance hits.
- Codebase is modular and maintainable for future updates.
