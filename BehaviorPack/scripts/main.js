import { world, system, EquipmentSlot, ItemStack, ItemComponentTypes } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import * as serverAdmin from "@minecraft/server-admin";

// Basic initialization to ensure the script is running
console.warn("Steven AI Assistant BP initialized.");

// ---------------------------------------------------------------------------
// High-intensity state check to cancel native inventory interaction
// ---------------------------------------------------------------------------
world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const target = event.target;
    if (target.typeId === "shifolabs:steven") {
        if (target.hasTag("state:attacking") || target.hasTag("state:moving")) {
            event.cancel = true;
            event.player.sendMessage("§cSteven is currently busy and cannot be interacted with!");
        }
    }
});

// ---------------------------------------------------------------------------
// Auto-Equip Logic
// ---------------------------------------------------------------------------
const WEAPON_MATERIALS = ["wood", "stone", "gold", "iron", "diamond", "netherite"];
const ARMOR_MATERIALS = ["leather", "chainmail", "gold", "iron", "diamond", "netherite"];

function getWeaponTier(itemId) {
    if (!itemId.includes("sword")) return -1;
    for (let i = 0; i < WEAPON_MATERIALS.length; i++) {
        if (itemId.includes(WEAPON_MATERIALS[i])) return i;
    }
    return -1;
}

function getArmorTier(itemId) {
    for (let i = 0; i < ARMOR_MATERIALS.length; i++) {
        if (itemId.includes(ARMOR_MATERIALS[i])) return i;
    }
    return -1;
}

function autoEquip(entity) {
    const inventory = entity.getComponent("minecraft:inventory")?.container;
    const equipment = entity.getComponent("minecraft:equippable");
    if (!inventory || !equipment) return;

    // Check slots: Head, Chest, Legs, Feet, Mainhand
    const slots = [
        { eqSlot: EquipmentSlot.Head, type: "helmet" },
        { eqSlot: EquipmentSlot.Chest, type: "chestplate" },
        { eqSlot: EquipmentSlot.Legs, type: "leggings" },
        { eqSlot: EquipmentSlot.Feet, type: "boots" },
        { eqSlot: EquipmentSlot.Mainhand, type: "sword" }
    ];

    for (const slotInfo of slots) {
        const currentItem = equipment.getEquipment(slotInfo.eqSlot);
        let currentTier = -1;
        
        if (currentItem) {
            currentTier = slotInfo.type === "sword" ? getWeaponTier(currentItem.typeId) : getArmorTier(currentItem.typeId);
        }

        let bestItemIdx = -1;
        let bestTier = currentTier;

        // Scan inventory for better items
        for (let i = 0; i < inventory.size; i++) {
            const invItem = inventory.getItem(i);
            if (!invItem) continue;

            if (invItem.typeId.includes(slotInfo.type)) {
                const invTier = slotInfo.type === "sword" ? getWeaponTier(invItem.typeId) : getArmorTier(invItem.typeId);
                if (invTier > bestTier) {
                    bestTier = invTier;
                    bestItemIdx = i;
                }
            }
        }

        // Equip better item if found
        if (bestItemIdx !== -1) {
            const bestItem = inventory.getItem(bestItemIdx);
            
            // Swap: Put current equipment into inventory, equip new item
            equipment.setEquipment(slotInfo.eqSlot, bestItem);
            
            if (currentItem) {
                inventory.setItem(bestItemIdx, currentItem);
            } else {
                inventory.setItem(bestItemIdx, undefined);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Unequip Logic
// ---------------------------------------------------------------------------
export function unequipAll(entity) {
    const inventory = entity.getComponent("minecraft:inventory")?.container;
    const equipment = entity.getComponent("minecraft:equippable");
    
    if (!inventory || !equipment) return;

    const eqSlots = [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet,
        EquipmentSlot.Mainhand,
        EquipmentSlot.Offhand
    ];

    for (const slot of eqSlots) {
        const item = equipment.getEquipment(slot);
        if (item) {
            if (inventory.emptySlotsCount > 0) {
                inventory.addItem(item);
                equipment.setEquipment(slot, undefined);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Auto-Healing Logic
// ---------------------------------------------------------------------------
const FOOD_BLACKLIST = [
    "minecraft:chicken", // Raw chicken
    "minecraft:rotten_flesh",
    "minecraft:spider_eye",
    "minecraft:poisonous_potato",
    "minecraft:golden_apple",
    "minecraft:enchanted_golden_apple"
];

function autoHeal(entity) {
    const healthComp = entity.getComponent("minecraft:health");
    if (!healthComp) return;

    const maxHealth = healthComp.effectiveMax;
    const currentHealth = healthComp.currentValue;

    // Only heal if health < 50%
    if (currentHealth >= maxHealth / 2) return;

    const inventory = entity.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        if (FOOD_BLACKLIST.includes(item.typeId)) continue;

        const foodComp = item.getComponent(ItemComponentTypes.Food);
        if (foodComp) {
            const nutrition = foodComp.nutrition;
            
            // Apply healing
            const newHealth = Math.min(maxHealth, currentHealth + nutrition);
            healthComp.setCurrentValue(newHealth);

            // Consume one item
            if (item.amount > 1) {
                item.amount -= 1;
                inventory.setItem(i, item);
            } else {
                inventory.setItem(i, undefined);
            }

            // Only consume one food item per interval
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Chat Listener for Commands
// ---------------------------------------------------------------------------
world.beforeEvents.chatSend.subscribe((event) => {
    const message = event.message;
    if (!message.startsWith("@")) return;

    // Cancel the event so it doesn't show in public chat
    event.cancel = true;

    const player = event.sender;
    const args = message.substring(1).trim().split(" ");
    const command = args[0].toLowerCase();
    const arg = args.slice(1).join(" ");

    // Find the nearest Steven to the player
    const dimension = player.dimension;
    const stevens = dimension.getEntities({
        type: "shifolabs:steven",
        location: player.location,
        maxDistance: 20
    });

    if (stevens.length === 0) {
        player.sendMessage("§cNo Steven found nearby!");
        return;
    }

    // Just take the closest one
    const steven = stevens[0];

    system.run(() => {
        handleCommand(steven, player, command, arg);
    });
});

function sendStevenMessage(steven, player, text) {
    const isSilent = steven.getDynamicProperty("isSilent");
    if (!isSilent) {
        player.sendMessage(`§aSteven: §f${text}`);
    }
}

function handleCommand(steven, player, command, arg) {
    switch (command) {
        case "come": {
            steven.removeTag("state:guarding");
            steven.removeTag("state:protecting");
            steven.removeTag("state:distracting");
            steven.removeEffect("speed");

            // Safety check: ensure he doesn't spawn in blocks or over lava
            // If player is in air, teleport to safe solid ground nearby
            let targetLoc = player.location;
            const dimension = player.dimension;

            // Try to find a safe location around the player
            let safeLoc = null;
            // Scan downwards from player to find ground
            for (let y = Math.floor(targetLoc.y); y >= -64; y--) {
                const blockLoc = { x: Math.floor(targetLoc.x), y: y, z: Math.floor(targetLoc.z) };
                const block = dimension.getBlock(blockLoc);
                if (block && !block.isAir && !block.isLiquid) {
                    if (block.typeId !== "minecraft:lava" && block.typeId !== "minecraft:flowing_lava") {
                        // Found a solid block, place steven above it
                        safeLoc = { x: targetLoc.x, y: y + 1, z: targetLoc.z };
                        break;
                    }
                }
            }

            if (safeLoc) {
                steven.teleport(safeLoc, { dimension: dimension });
                sendStevenMessage(steven, player, "I'm right beside you.");
            } else {
                steven.teleport(targetLoc, { dimension: dimension });
                sendStevenMessage(steven, player, "Teleported to you.");
            }
            break;
        }
        case "stay":
            steven.triggerEvent("steven:cmd_stay");
            steven.addTag("state:staying");
            steven.removeTag("state:moving");
            steven.removeTag("state:guarding");
            steven.removeTag("state:protecting");
            steven.removeTag("state:distracting");
            steven.removeEffect("speed");
            sendStevenMessage(steven, player, "I will stay right here.");
            break;
        case "follow": {
            steven.triggerEvent("steven:cmd_follow");
            steven.addTag("state:moving");
            steven.removeTag("state:staying");
            steven.removeTag("state:guarding");
            steven.removeTag("state:protecting");
            steven.removeTag("state:distracting");
            steven.removeEffect("speed");

            // Ensure owner is set correctly to the player
            const tameable = steven.getComponent("minecraft:tameable");
            if (tameable && !steven.hasComponent("minecraft:is_tamed")) {
                tameable.tame(player);
            }

            const distance = parseInt(arg);
            if (!isNaN(distance) && distance > 0) {
                steven.setProperty("steven:follow_distance", Math.min(distance, 100));
            } else {
                steven.setProperty("steven:follow_distance", 3); // default 3 blocks
            }
            sendStevenMessage(steven, player, "I am following you now.");
            break;
        }
        case "sethome":
            steven.setDynamicProperty("home_x", steven.location.x);
            steven.setDynamicProperty("home_y", steven.location.y);
            steven.setDynamicProperty("home_z", steven.location.z);
            steven.setDynamicProperty("home_dimension", steven.dimension.id);
            sendStevenMessage(steven, player, "Home location set to these coordinates.");
            break;
        case "silence": {
            const currentSilence = steven.getDynamicProperty("isSilent") || false;
            steven.setDynamicProperty("isSilent", !currentSilence);
            if (!currentSilence) {
                // If it wasn't silent before, send the message, then it's silenced.
                player.sendMessage(`§aSteven: §fI will be quiet now.`);
            } else {
                // Now it's not silent, send confirmation
                sendStevenMessage(steven, player, "I can speak again.");
            }
            break;
        }
        case "report": {
            const healthComp = steven.getComponent("minecraft:health");
            const hp = healthComp ? `${Math.floor(healthComp.currentValue)}/${healthComp.effectiveMax}` : "Unknown";
            const loc = steven.location;

            let reportMsg = `§e--- Steven's Report ---\n`;
            reportMsg += `§bHP:§f ${hp}\n`;
            reportMsg += `§bLocation:§f ${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)} (${steven.dimension.id})\n`;

            const inventory = steven.getComponent("minecraft:inventory")?.container;
            if (inventory) {
                reportMsg += `§bInventory:§f\n`;
                const itemCounts = {};
                for (let i = 0; i < inventory.size; i++) {
                    const item = inventory.getItem(i);
                    if (item) {
                        const name = item.typeId.replace("minecraft:", "").replace(/_/g, " ");
                        if (itemCounts[name]) {
                            itemCounts[name] += item.amount;
                        } else {
                            itemCounts[name] = item.amount;
                        }
                    }
                }

                const items = Object.keys(itemCounts);
                if (items.length === 0) {
                    reportMsg += `  (Empty)\n`;
                } else {
                    for (const name of items) {
                        reportMsg += `  - ${name}: ${itemCounts[name]}\n`;
                    }
                }
            } else {
                reportMsg += `§bInventory:§f None\n`;
            }

            player.sendMessage(reportMsg);
            sendStevenMessage(steven, player, "Report sent.");
            break;
        }
        case "rename": {
            if (!arg) {
                sendStevenMessage(steven, player, "Please provide a name.");
                break;
            }
            let newName = arg;
            if (newName.length > 32) {
                newName = newName.substring(0, 32);
            }
            steven.nameTag = newName;
            sendStevenMessage(steven, player, `My name is now ${newName}.`);
            break;
        }
        case "forget": {
            // The "Panic Button"
            steven.triggerEvent("steven:cmd_stay");
            steven.removeTag("state:moving");
            steven.removeTag("state:staying");
            steven.removeTag("state:guarding");
            steven.removeTag("state:protecting");
            steven.removeTag("state:distracting");
            steven.removeTag("state:attacking");
            steven.removeTag("state:guarding_return");
            steven.setDynamicProperty("guard_x", undefined);
            steven.setDynamicProperty("guard_y", undefined);
            steven.setDynamicProperty("guard_z", undefined);
            steven.setDynamicProperty("guard_radius", undefined);
            steven.removeEffect("speed");
            sendStevenMessage(steven, player, "Forgot all tasks. Standing by.");
            break;
        }
        case "guard": {
            let radius = 30;
            if (arg) {
                const parsed = parseInt(arg);
                if (!isNaN(parsed) && parsed > 0) {
                    radius = parsed;
                }
            }
            steven.triggerEvent("steven:cmd_guard");
            steven.removeTag("state:moving");
            steven.removeTag("state:staying");
            steven.removeTag("state:protecting");
            steven.removeTag("state:distracting");
            steven.removeTag("state:guarding_return");
            steven.addTag("state:guarding");

            // Save coordinates
            steven.setDynamicProperty("guard_x", steven.location.x);
            steven.setDynamicProperty("guard_y", steven.location.y);
            steven.setDynamicProperty("guard_z", steven.location.z);
            steven.setDynamicProperty("guard_radius", radius);

            sendStevenMessage(steven, player, `I will guard this area within a ${radius} block radius.`);
            break;
        }
        case "protect": {
            steven.triggerEvent("steven:cmd_protect");
            steven.removeTag("state:moving");
            steven.removeTag("state:staying");
            steven.removeTag("state:guarding");
            steven.removeTag("state:distracting");
            steven.addTag("state:protecting");

            // Ensure owner is set
            const tameable = steven.getComponent("minecraft:tameable");
            if (tameable && !steven.hasComponent("minecraft:is_tamed")) {
                tameable.tame(player);
            }

            sendStevenMessage(steven, player, "I will protect you at all costs.");
            break;
        }
        case "distract": {
            steven.triggerEvent("steven:cmd_distract");
            steven.removeTag("state:moving");
            steven.removeTag("state:staying");
            steven.removeTag("state:guarding");
            steven.removeTag("state:protecting");
            steven.addTag("state:distracting");

            steven.addEffect("speed", 20000000, { amplifier: 1, showParticles: false });
            sendStevenMessage(steven, player, "I'll draw their attention!");
            break;
        }
        case "clean": {
            let radius = 10;
            if (arg) {
                const parsed = parseInt(arg);
                if (!isNaN(parsed) && parsed > 0) {
                    radius = parsed;
                }
            }

            const entities = steven.dimension.getEntities({
                location: steven.location,
                maxDistance: radius
            });

            let count = 0;
            for (const entity of entities) {
                if (entity.id === steven.id) continue; // Don't kill self
                if (entity.typeId === "minecraft:player" || entity.typeId === "minecraft:villager") continue;
                if (entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") continue;
                if (entity.hasComponent("minecraft:is_tamed") || entity.hasTag("is_tamed")) continue;

                const families = entity.getComponent("minecraft:type_family");
                if (families && families.hasTypeFamily("tamed")) continue;

                // Safe to kill
                entity.kill();
                count++;
            }

            sendStevenMessage(steven, player, `Cleared ${count} entities within ${radius} blocks.`);
            break;
        }
        default:
            player.sendMessage(`§cUnknown command: @${command}`);
            break;
    }
}


// ---------------------------------------------------------------------------
// System Loop
// ---------------------------------------------------------------------------
system.runInterval(() => {
    // Run every 5 seconds (100 ticks)

    // Create a Set to keep track of processed stevens so we don't process them multiple times
    // if there are multiple players in the same dimension.
    const processedStevens = new Set();

    for (const player of world.getAllPlayers()) {
        const dimension = player.dimension;
        const stevens = dimension.getEntities({ type: "shifolabs:steven" });

        for (const steven of stevens) {
            if (processedStevens.has(steven.id)) continue;
            processedStevens.add(steven.id);

            autoEquip(steven);
            autoHeal(steven);

            // Attacking tag check for interaction canceling
            if (steven.target) {
                if (!steven.hasTag("state:attacking")) steven.addTag("state:attacking");
            } else {
                if (steven.hasTag("state:attacking")) steven.removeTag("state:attacking");
            }

            // Failsafe for following
            if (steven.hasTag("state:moving")) {
                const tameable = steven.getComponent("minecraft:tameable");

                // For simplicity, we assume the command issuer is the nearest player or the one who tamed him
                // We find the nearest player in a 100 block radius to check distance
                const players = dimension.getPlayers({ location: steven.location, maxDistance: 100 });
                if (players.length > 0) {
                    const nearestPlayer = players[0];
                    const dx = steven.location.x - nearestPlayer.location.x;
                    const dy = steven.location.y - nearestPlayer.location.y;
                    const dz = steven.location.z - nearestPlayer.location.z;
                    const distanceSq = dx * dx + dy * dy + dz * dz;

                    if (distanceSq > 20 * 20) {
                        // Trigger @come logic to teleport closer
                        handleCommand(steven, nearestPlayer, "come", "");
                    }
                }
            }

            // Guarding
            if (steven.hasTag("state:guarding")) {
                const gx = steven.getDynamicProperty("guard_x");
                const gy = steven.getDynamicProperty("guard_y");
                const gz = steven.getDynamicProperty("guard_z");
                const grad = steven.getDynamicProperty("guard_radius");

                if (gx !== undefined && gy !== undefined && gz !== undefined && grad !== undefined) {
                    const dx = steven.location.x - gx;
                    const dy = steven.location.y - gy;
                    const dz = steven.location.z - gz;
                    const distSq = dx*dx + dy*dy + dz*dz;

                    if (distSq > grad * grad) {
                        // Exceeded radius: drop target via component group swap unconditionally
                        if (!steven.hasTag("state:guarding_return")) {
                            steven.triggerEvent("steven:cmd_guard_return");
                            steven.addTag("state:guarding_return");
                        }
                        const nav = steven.getComponent("minecraft:navigation.walk");
                        if (nav) nav.moveTo({ x: gx, y: gy, z: gz });
                    } else if (steven.hasTag("state:guarding_return")) {
                        steven.removeTag("state:guarding_return");
                        steven.triggerEvent("steven:cmd_guard_resume"); // re-enable combat components
                    }
                }
            }

            // Protecting
            if (steven.hasTag("state:protecting")) {
                // If in combat, and player is > 15 blocks away, drop target and sprint back
                const players = dimension.getPlayers({ location: steven.location, maxDistance: 100 });
                if (players.length > 0) {
                    const nearestPlayer = players[0];
                    const dx = steven.location.x - nearestPlayer.location.x;
                    const dy = steven.location.y - nearestPlayer.location.y;
                    const dz = steven.location.z - nearestPlayer.location.z;
                    const distanceSq = dx * dx + dy * dy + dz * dz;

                    if (distanceSq > 15 * 15 && steven.target) {
                        // trigger sprint following
                        steven.triggerEvent("steven:cmd_sprint_follow");
                        steven.addTag("state:protecting_return");
                    } else if (distanceSq <= 5 * 5 && steven.hasTag("state:protecting_return")) {
                        // resume protecting
                        steven.removeTag("state:protecting_return");
                        steven.triggerEvent("steven:cmd_protect");
                    }
                }
            }

            // Distracting
            if (steven.hasTag("state:distracting")) {
                // Handled via entity filter distance_to_nearest_player in JSON.
                // No additional manual scripting required.
            }

        }
    }
}, 100);
