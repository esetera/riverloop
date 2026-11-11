# Riverloop

I made Riverloop for a cheap secondhand exercise bike I bought for $40. I’m adding a Bluetooth cadence sensor so my pedaling controls the pace. Riverloop also shows live heart rate from a Samsung Galaxy Watch4 or Watch5 with [Heart for Bluetooth](https://play.google.com/store/apps/details?id=lukas.the.coder.heartforbluetooth).

Choose a loop before you ride. Willowmere Valley crosses timber bridges and passes a village and windmill. Saltwind Coast follows the beach and returns through the dunes. Neon District winds between towers and through lit gateways after dark. Echo Basin circles a misty lake past a trail of quotes and lanterns that light up as you approach. Machine City follows an android patrol route lined with live AI dispatches. Airwave Coast is a sunset loop for listening to YouTube. Folio Quarter carries book and publishing news past bookstalls and a printing press. Aurora Divide climbs through snow under moving northern lights. Idea Circuit teaches a topic around a moonlit observatory. Gacka Valley visits the spring mills of Sinac in Croatia, and Ponsonby Ridge follows an Auckland streetscape from its shop verandas to Three Lamps and Western Park. Thought Circuit takes a decision through a desert sculpture garden. Set your stationary bike’s resistance by hand as the game prompts you. Ride at a fixed simulated speed or pair a Bluetooth cadence sensor to control the pace with your pedals.

## Start a ride

Use a current desktop browser with WebGL 2. From the project folder, run these commands with Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev -- --open
```

Open the local address printed by Vite if your browser stays closed. The rides work offline. Live dispatches and YouTube playback need an internet connection.

To preview the production build, run `npm run build` followed by `npm run preview -- --open`.

Pick a **Ride scenario** and a ride length, then select **Start ride**. The default is 10 minutes. Presets run from 5 to 30 minutes, and Custom accepts 1–120 whole minutes. In **Settings**, you can describe how your bike’s dial feels at Easy, Steady, and Gentle hill. Use these cues at a resistance that feels comfortable.

**Rotating daily ride** starts the named featured route in one click. The route rotates with your local date. To ride the route shown in the picker, use **Start ride**. Ride past the landmark to discover it. Any finished ride counts its active time toward your weekly minutes, including rides you finish early. Your week starts on Monday, and you can change the 60-minute default goal in **Settings → Ride goals**.

**Start mission** takes you to the selected route’s landmark. The mission finishes when you reach the landmark. The clock counts up and you can keep riding or finish whenever you like.

Choose **Scenic** for an easy spin, **Steady** for a cadence target you set, or **Rolling Hills** for effort cues based on the road. Steady’s live coaching uses a paired cadence sensor and starts after warm-up. Time, RPM, and BPM sit in a translucent panel at the lower left. The route and effort panels brighten for upcoming bends and effort changes. Tap **Details** to keep them bright.

The ride summary marks a new longest ride and a return after at least seven calendar days for rides of a minute or more. With a cadence sensor, Riverloop also compares the steadiness of your cadence on the same climb.

Enable **Ride with my last-lap ghost** in the same settings. Once you’ve completed a lap, your next ride on that route can replay your latest lap as a translucent cyclist and show your pace compared with it. Cadence and simulated rides save separate ghosts.

The elevation profile shows one lap, your position, and the current gradient. During the main ride, the effort cues follow the terrain. At five seconds, a banner and an optional spoken cue signal the upcoming change. **Make easier** switches to Easy for the rest of the current ride. The finish screen records elapsed riding time and full laps.

Use **Fullscreen** in **Ride menu** to fill your display. Select **Exit fullscreen** to return to the browser window. During fullscreen, Escape is reserved for leaving fullscreen.

### Ride with a cadence sensor

In desktop Chrome, spin the pedals to wake the sensor, then choose **Pair cadence sensor** on the setup screen and select it from the browser’s device picker. Riverloop uses the standard Bluetooth Cycling Speed and Cadence service with crank data, which COOSPO lists for the BK9C. Pair inside Riverloop each time you open the game. Select **Disconnect sensor** on setup to use simulated speed.

The dashboard shows pedal RPM. The bike accelerates as you pedal and coasts to a stop when readings go quiet. The ride timer keeps running as you coast. If the sensor disconnects, the game pauses and offers to reconnect. Effort cues in a cadence ride follow your position on the route.

### Show live heart rate

On a Galaxy Watch4 or Watch5, install [Heart for Bluetooth](https://play.google.com/store/apps/details?id=lukas.the.coder.heartforbluetooth) on the watch and start broadcasting. In desktop Chrome, click **Pair heart-rate monitor** on the setup screen or under **Settings → Heart rate** and select the watch. Other monitors that broadcast the standard Bluetooth Heart Rate service can use the same button. Live BPM is displayed during the ride. The reading clears when the signal goes stale, and Riverloop keeps no heart-rate history.

| Key | Action |
| --- | --- |
| Space or Escape | Pause or resume |
| E | Stay at Easy for this ride |
| F | Save the ride and return to setup |
| M | Mute or restore sound |
| S | Open Settings |

When you open Settings during a ride, the clock and camera pause. Riverloop requests a screen wake lock while visible, including on battery. Settings shows whether the browser granted it. If you leave the tab or the computer sleeps, use **Resume ride** when you return.

Open **Ride Radio → Electronic music** to choose and play a synthesized soundtrack. **Random** picks a style for each ride. **Fog Bloom** layers slowly changing pads and chimes. The **Tech house** group includes three original tracks: Afterhours, Harbor Signal, and Night Shift. **Music volume** starts at 50% and changes the soundtrack level independently of the other sounds. Ambient sound, spoken cues, and cycling sounds have separate switches. Cycling sounds add simulated drivetrain and breathing and start off by default. **Visual only** switches every sound off.

## Learn as you ride

**Idea Circuit** and **Thought Circuit** ask a signed-in agent to research and write each ride. Start Riverloop with `npm run dev` or `npm run preview`. The server uses Codex CLI by default. To use Claude Code instead, start it with `RIVERLOOP_AGENT=claude npm run dev`. Both CLIs need to be available on your PATH and signed in. A static build can run the scenic rides. Agent research needs the local server.

In **Idea Circuit**, enter a topic and select **Load topic**. The agent looks up relevant sources and writes four laps, with each board introducing a distinct point. Click a **?** board to see three shorter steps written by the agent. The next lap advances the lesson, and the ride switches to review after the fourth lap. Click a board marked **↗** to save its source.

In **Thought Circuit**, enter a question and select **Plan thinking ride**. The agent researches it and writes four perspectives that take you from framing the decision to choosing a next step. If the question matches a topic in `~/.riverloop/thought-context.json`, the matching notes are sent with the question to the configured agent. The context file stays outside the site. Both forms show the agent’s name during research, which can take a minute or two.

In **Art History**, eight works from the Art Institute of Chicago float above a dusk garden route. Each work stays in view until the next section of the course. Select **Hold artwork** to keep it on screen while you ride, and **Save for later** to save its museum page.

The Croatia and Auckland rides are compressed scenic interpretations. See the [place references](ASSETS.md) for the real locations.

## Ride Radio and roadside reading

Open **Ride Radio → YouTube** from **Ride menu** on any route. Load a suggested AI talk, follow the latest news and publishing searches, or paste a YouTube video or playlist link. You can swap with **Next video** or choose a saved link. The player stays in place when you start or pause a ride. Closing the panel stops the video. Riverloop remembers your links and the last selection locally, and waits for you to load it again when you reopen the game. The game’s soundtrack and ambient audio give way to the player while it’s loaded. Videos that block embedding can still open on YouTube.

Click a board marked **↗** to save the source to **Ride menu → Read later**. The ride keeps running and nothing opens until you choose a saved link. The list stays in this browser. Use × to remove an entry.

Echo Basin puts six different quotes on its signs each time you start. It works through all 24 before shuffling, with no overlap between consecutive rides. The set stays in place for the whole ride.

Machine City and Folio Quarter refresh their billboards when you visit and every 10 minutes while the page is visible. Machine City’s AI wire covers the last 72 hours of submissions. The model, benchmark, research, and publishing channels cover the last seven days. The signs show the source and date, and a recent cached headline is marked as such. Expired stories drop off even offline. Machine City uses [Hacker News search](https://hn.algolia.com/api) and [Hugging Face](https://huggingface.co/papers). Folio Quarter uses the Hacker News feed for recent stories about book publishing, ebooks, and AI in publishing.

## Rendering and sound

Balanced is the default. Light renders fewer plants and uses simpler shadows and a lower resolution. High increases resolution on high-density displays. The scenery and path are the same on all settings.

Speech uses an installed English voice when the browser exposes one. Visual cues work with sound off or when a voice is unavailable. The environment and music are synthesized in your browser. A first-person camera is included in this release.

## Local data

**Ride menu → Settings → Ride history** lists recent rides and lets you delete a test ride and its minutes. **Ride goals** lets you reset this week’s minutes while keeping the individual rides, or restore the default 60-minute goal.

The selected scenario, duration, ride mode, cadence target, resistance descriptions, sound and rendering preferences, and the latest 40 completed ride summaries are saved in versioned browser storage. Weekly time, landmark discoveries, missions, personal bests, and ghost laps are also stored locally. Each browser profile and local server address has its own history. The game can run with storage disabled.

## Developer mode

Add `?dev=1` to the local address. The developer panel shows frame rate and draw calls, offers 4×, 12×, and 24× time, and lets you jump to a five-second warning or near the next lap line. Settings has a **Reset saved preferences** button. Rides with accelerated time or jumps are omitted from history.

Run `npm run check` for TypeScript and `npm test` for the session, route, and persistence checks. `npm run build` produces the static `dist/` folder. The game can be served by any static HTTP server at the root of a local address.

## How the pieces fit

- `src/input.ts` turns simulated or measured cadence into virtual speed. `src/cadence.ts` handles Bluetooth pairing and crank readings.
- `src/route.ts` builds the closed, distance-indexed route and the river valley’s heights.
- `src/scenarios.ts` defines the scenario names, loops, and starting points.
- `src/session.ts` tracks active time, laps, and effort cues based on the route gradient.
- `src/landscape.ts`, `src/scenery.ts`, and `src/world.ts` render the world and position the first-person camera.
- `src/alternate-worlds.ts` builds the coast and city scenery from geometry and shaders.
- `src/audio.ts`, `src/main.ts`, and `src/storage.ts` handle local sound, controls, and saved data.

## License

Riverloop’s original code and artwork are released under the [MIT License](LICENSE). See [asset credits and licenses](ASSETS.md) for fonts, dependencies, quotations, and embedded videos.
