# Cyberpunk MMO Game Controls

This document provides a comprehensive guide to the control system for the Cyberpunk MMO Game. The game supports both desktop (keyboard/mouse) and mobile controls with full 3D movement capabilities.

## Desktop Controls

### Basic Movement

| Key | Action |
|-----|--------|
| W / Up Arrow | Move forward in the direction you're facing |
| S / Down Arrow | Move backward |
| A | Strafe left |
| D | Strafe right |
| R | Move upward (Y+) |
| F | Move downward (Y-) |
| Left Arrow | Turn left (yaw) |
| Right Arrow | Turn right (yaw) |
| Space | Fire laser |
| Shift | Boost speed |

### Mouse Controls

| Mouse Action | Game Action |
|--------------|-------------|
| Mouse Movement Up/Down | Pitch (look up/down) |
| Mouse Movement Left/Right | Yaw (turn left/right) |
| Mouse Wheel | Roll left/right |
| Left Click | Fire laser |
| Right Click | Not currently used |

### Advanced Movement

The vehicle will always move in the direction it's facing. This means:

- When pitched up and moving forward, the vehicle will climb upward
- When pitched down and moving forward, the vehicle will dive downward
- When rolled and moving forward, the vehicle will bank in that direction

This provides full 6-degrees-of-freedom (6DOF) control similar to space flight simulators.

## Mobile Controls

### Touch Controls

| Control | Action |
|---------|--------|
| Left Joystick Up/Down | Move forward/backward |
| Left Joystick Left/Right | Strafe left/right |
| Right Joystick Up/Down | Pitch (look up/down) |
| Right Joystick Left/Right | Yaw (turn left/right) |
| Boost Button | Increase speed |
| Shoot Button | Fire laser |

### Mobile-Specific Features

- The mobile interface automatically adapts to screen size and orientation
- Touch controls are positioned for comfortable thumb access
- Auto-adjusts quality settings based on device performance
- Supports both portrait and landscape orientations

## Control Settings and Customization

### Performance Options

The game includes a quality toggle button that allows you to switch between:

- **HIGH quality**: Full visual effects, shadows, and maximum draw distance
- **LOW quality**: Reduced effects, no shadows, and shorter draw distance

This is especially useful for older devices or when experiencing performance issues.

### Debug Mode

A debug mode can be toggled which:

- Enables free camera movement independent of the vehicle
- Shows collision boundaries and performance statistics
- Displays additional debugging information

## Advanced Tips

1. **Smooth Flying**: Combine pitch/yaw with forward movement for smooth arcs
2. **Quick Turns**: Use a combination of roll and yaw for fighter-jet style banking turns
3. **Precision Landing**: Use the direct vertical controls (R/F) for final adjustments
4. **Boost Timing**: Use boost strategically for quick escapes or to catch up to opponents
5. **Camera Positioning**: The third-person camera automatically positions itself behind your vehicle, helping you maintain orientation

## Building Collisions and Navigation

The game includes an intelligent collision system that allows you to navigate the cityscape effectively:

### Collision Mechanics

- **Building Height Awareness**: The vehicle can fly over buildings without triggering collisions as long as you maintain enough altitude
- **Landing on Buildings**: You can land on top of buildings by descending gently
- **Wall Sliding**: When colliding with building walls at shallow angles, the vehicle will slide along the surface instead of stopping completely
- **Collision Recovery**: The collision system will automatically help you recover from collisions to prevent getting stuck

### Navigation Tips

1. **Flying Higher**: To avoid collisions with buildings entirely, maintain a high altitude (above the tallest buildings)
2. **Threading the Needle**: When navigating between tall buildings, keep a steady course and avoid sudden turns
3. **Collision Recovery**: If you get stuck, try moving backward and upward simultaneously (S + R keys)
4. **Rooftop Hopping**: You can chain together movement across rooftops by flying low and using the buildings as landing platforms
5. **Canyon Running**: For advanced players, flying between buildings at high speed provides the ultimate challenge

## Control Mechanics

The control system is physics-based with the following characteristics:

- **Momentum**: Your vehicle maintains momentum and requires time to change direction
- **Damping**: Natural deceleration occurs when no input is given
- **Speed Limits**: Maximum velocity is capped, with a higher cap when boosting
- **Collision Response**: Collisions affect your vehicle's momentum and may cause damage

## Troubleshooting

If controls become unresponsive:

1. **Regaining Control**: If movement locks up after playing for a while:
   - Press the `Enter` key to regain pointer lock
   - Click in the game window to re-engage controls
   - If keyboard controls are stuck, press `Escape` and then click in the game window again

2. **Browser Issues**: 
   - Ensure pointer lock is active (click the game window)
   - Check that no browser dialogs or notifications are open
   - Some browsers may interrupt pointer lock after a period of inactivity

3. **Performance Issues**:
   - Verify that the game window is in focus
   - Try toggling the quality setting to improve performance
   - Close other resource-intensive applications or browser tabs

4. **Auto-Recovery Features**:
   - The game includes automatic recovery mechanisms that will attempt to restore controls
   - If controls freeze for more than 60 seconds, they will automatically reset
   - The pointer lock is automatically restored when the game regains focus

5. **Manual Reset**:
   - If all else fails, refresh the browser page to restart the game
   - Use the debug mode toggle to switch between flight and orbit camera modes 