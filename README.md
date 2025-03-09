# Cyberpunk Flying Car Game

A web-based, multiplayer, open-world game set in a futuristic cyberpunk city. Players control flying cars, engage in laser combat, and explore a dynamic cityscape featuring billboard advertisements.

## Features

- Procedurally generated cyberpunk city with dynamic billboards
- Flying cars with laser combat capabilities
- Real-time multiplayer via WebSockets
- Optimized for performance across devices
- Modular codebase architecture

## Tech Stack

- **Frontend**: Three.js for 3D rendering, HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express, Socket.io for WebSockets
- **Build Tools**: Parcel for bundling

## Getting Started

### Prerequisites

- Node.js (v14.x or higher)
- npm (v6.x or higher)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/cyberpunk-flying-car-game.git
   cd cyberpunk-flying-car-game
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev:all
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Development

- `npm run dev` - Start the server with auto-reload
- `npm run watch` - Watch client files and rebuild on changes
- `npm run dev:all` - Run both server and client in development mode
- `npm run build` - Build client for production

## Game Controls

### Desktop
- WASD: Movement
- Arrow keys: Direction
- Space: Shoot laser
- Shift: Boost

### Mobile
- Left joystick: Movement
- Right joystick: Direction
- Attack button: Shoot laser
- Boost button: Speed up

For detailed control instructions, see [Controls Documentation](./.docs/controls.md)

## Project Structure

```
/
├── src/
│   ├── client/           # Frontend code
│   │   ├── assets/       # 3D models, textures, sounds
│   │   ├── modules/      # Game modules
│   │   │   ├── game/     # Game logic
│   │   │   ├── rendering/# Three.js rendering
│   │   │   ├── network/  # WebSocket client
│   │   │   └── ads/      # Billboard ad engine
│   │   └── index.html    # Main HTML file
│   └── server/           # Backend code
│       ├── modules/      # Server modules
│       │   ├── game/     # Game state management
│       │   ├── network/  # WebSocket server
│       │   └── ads/      # Ad rotation logic
│       └── index.js      # Server entry point
├── .docs/                # Documentation
└── dist/                 # Compiled client files
```

## License

MIT 