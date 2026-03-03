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
// System Loop
// ---------------------------------------------------------------------------
system.runInterval(() => {
    // Run every 5 seconds (100 ticks)
    for (const player of world.getAllPlayers()) {
        const dimension = player.dimension;
        // Optimization: Could keep track of stevens, but getting entities by type in dimension is fine for now
        const stevens = dimension.getEntities({ type: "shifolabs:steven" });
        for (const steven of stevens) {
            autoEquip(steven);
            autoHeal(steven);
        }
    }
}, 100);
