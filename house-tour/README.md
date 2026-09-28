# Type 2A House Tour

Interactive 3D walkthrough of the 22 × 70 ft (6706 × 21336 mm) Type 2A single-storey terrace unit.

Open `index.html` in any modern browser. It is a single self-contained file: three.js, every texture
(painted procedurally at load) and all music and sound effects (synthesised live with Web Audio) are
inside it, so it works offline and from any static host.

## What's inside

- **Guided tour**: a 13-stop cinematic route from the street, through the gate, porch and every room,
  ending in a roof-off dollhouse view. Captions, optional spoken narration, auto-opening doors.
- **Walk mode**: WASD / arrows + mouse (click to lock the pointer), Shift to run, collision with walls
  and furniture; on touch screens a joystick plus drag-to-look. Click the minimap to jump to a room.
- **Dollhouse / floor plan**: orbit the roofless house, click a room label to walk into it.
- **Day, golden hour and night** lighting with sun shadows, sky reflections, window light, sun beams,
  dust motes, ambient occlusion, bloom and a film grade.
- **Audio**: generative ambient piano and pad score, birds by day and crickets at night, footsteps that
  change with the floor, door creaks, arrival chimes.

Keys: `1` tour, `2` walk, `3` dollhouse, `T` time of day, `M` mute, `F` fullscreen, `Space` pause,
`←` / `→` previous / next stop.

## Editing

Source lives in `src/` (`house.js` geometry and furniture, `main.js` runtime, `tour.js` stops,
`audio.js` sound, `textures.js` procedural materials, `template.html` UI).

```sh
cd house-tour
npm install
npm run build   # writes index.html
```
