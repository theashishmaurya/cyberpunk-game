# MMO Game

This project is a Massively Multiplayer Online (MMO) game with a separate client and server architecture.

## Project Structure

- `client/`: Frontend game client built with TypeScript and Webpack
- `server/`: Backend game server built with Node.js, Express, and Socket.IO

## Setup and Installation

### Client
```bash
cd client
npm install
npm start  # Starts the development server
npm run build  # Builds for production
```

### Server
```bash
cd server
npm install
npm run dev  # Starts the development server with hot-reloading
npm run build  # Compiles TypeScript to JavaScript
npm start  # Runs the compiled JavaScript
```

## Development

- Client runs on: http://localhost:9000
- Server runs on: http://localhost:3000

## Technologies Used

### Client
- TypeScript
- Webpack
- HTML5 Canvas (for game rendering)

### Server
- Node.js
- Express
- Socket.IO
- TypeScript

## Features

- Multiplayer flying car game with real-time networking
- Cyberpunk-themed open world with procedurally generated cityscape
- Modern TypeScript codebase
- Babylon.js rendering engine with advanced lighting and effects
- Mobile and desktop support with adaptive controls

## Technology Stack

- **Frontend**: Babylon.js, TypeScript, HTML5
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Build Tools**: Parcel, TypeScript compiler

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run development server:
   ```
   npm run dev:all
   ```
   This will start both the backend server and frontend development with hot-reloading.

4. Open your browser at `http://localhost:5000`

## Build for Production

```
npm run build
```

This will compile both server and client TypeScript code and optimize the client for production.

## Project Structure

```
/src
  /client           # Client-side code
    /modules
      /rendering    # Babylon.js rendering code
      /game         # Game logic
      /network      # Networking code
      /audio        # Audio system
      /ads          # In-game billboard system
    /assets         # Game assets
    index.ts        # Main client entry point
    index.html      # HTML template
    types.ts        # TypeScript type definitions
  /server           # Server-side code
    /modules
      /game         # Game state management
      /network      # Socket handling
      /ads          # Server-side ad engine
    index.ts        # Server entry point
    types.ts        # Server-side type definitions
```

## Controls

### Desktop
- **WASD**: Movement
- **Mouse**: Look around
- **Space**: Boost
- **Left Click**: Shoot
- **E**: Toggle debug mode
- **M**: Toggle sound

### Mobile
- **Left Joystick**: Movement
- **Right Joystick**: Look
- **BOOST button**: Activate boost
- **FIRE button**: Shoot laser

## License

MIT

## Acknowledgements

This game was originally built with Three.js and JavaScript, and has been refactored to use Babylon.js and TypeScript.

## Screenshots

(Add screenshots here) 