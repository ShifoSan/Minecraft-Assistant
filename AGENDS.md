# AGENTS.md - Project State & Roadmap

## Project Overview
We are building a highly advanced, script-driven Minecraft Bedrock AI Assistant named "Steven". The add-on requires both a Resource Pack (currently set up) and a Behavior Pack utilizing the `@minecraft/server` Scripting API to handle complex tasks, custom chat commands, and inventory management.

## Current State (Pre-Phase 1)
- The repository currently contains the `ResourcePack` folder and a `README.md` file.
- Inside the Resource Pack, `models/entity/Steven.json`, `textures/entity/Steven_skin.png`, and `textures/items/Steven_icon.png` are present.
- **Missing:** `manifest.json` files for both packs, the entire `BehaviorPack` directory, and the `scripts` folder.

## The Phased Roadmap
To ensure high-quality code and prevent bugs, we are building Steven in strict phases. **Do not jump ahead to future phases.**

* **Phase 1: Foundation & Spawning (PENDING)** - Get Steven physically into the game without crashing. Create the BehaviorPack folder, write the manifest.json files for both packs (generating fresh UUIDs), link them, and write the basic Steven.json behavior file so he spawns, walks, and has physics.
* **Phase 2: The Brain & Passives (PENDING)** - Hook up the JavaScript API and implement the passive background tasks. Set up the scripts/main.js architecture, implement the minecraft:interact JSON component, and code the background array-scanning loops for Auto-Equip, Auto-Unequip, and Auto-Healing.
* **Phase 3: Core Movement (PENDING)** - Teach Steven to listen to you and move on command. Build the chat-listening function to intercept messages starting with @. Code the simple logic commands: @come, @stay, @follow, @sethome, @silence, @report, @rename, and the @forget panic button.
* **Phase 4: Combat (PENDING)** - Turn Steven into a capable bodyguard. Implement dynamic property tracking for coordinates and code the combat overrides for @guard, @protect, @distract, and @clean.
* **Phase 5: Automation (PENDING)** - The heavy lifting—managing blocks and complex inventory math. Code the block-scanning logic for @harvest, @replant, and @wood, build the container-transfer API for @dump and @loot, and implement the mathematical sorting beast that is @organize.

## Phase Completion Log
- [ ] Phase 1 Completed: N/A
- [ ] 
