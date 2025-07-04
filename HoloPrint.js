// START OF MERGED AND OPTIMIZED HoloPrint.js (HoloLab Version) - High-Performance Rewrite v3

import * as NBT from "nbtify";
import { ZipWriter, TextReader, BlobWriter, BlobReader, ZipReader } from "@zip.js/zip.js";

import BlockGeoMaker from "./BlockGeoMaker.js";
import TextureAtlas from "./TextureAtlas.js";
import MaterialList from "./MaterialList.js";
import PreviewRenderer from "./PreviewRenderer.js";

import * as entityScripts from "./entityScripts.molang.js";
import { addPaddingToImage, arrayMin, awaitAllEntries, CachingFetcher, concatenateFiles, createNumericEnum, desparseArray, exp, floor, getFileExtension, hexColorToClampedTriplet, JSONMap, JSONSet, lcm, loadTranslationLanguage, max, min, overlaySquareImages, pi, resizeImageToBlob, round, sha256, translate, UserError } from "./essential.js";
import ResourcePackStack from "./ResourcePackStack.js";
import BlockUpdater from "./BlockUpdater.js";

export const VERSION = "dev";
export const IGNORED_BLOCKS = ["air", "piston_arm_collision", "sticky_piston_arm_collision"];
const IGNORED_BLOCK_ENTITIES = ["Beacon", "Beehive", "Bell", "BrewingStand", "ChiseledBookshelf", "CommandBlock", "Comparator", "Conduit", "EnchantTable", "EndGateway", "JigsawBlock", "Lodestone", "SculkCatalyst", "SculkShrieker", "SculkSensor", "CalibratedSculkSensor", "StructureBlock", "BrushableBlock", "TrialSpawner", "Vault"];
export const PLAYER_CONTROL_NAMES = {
	TOGGLE_RENDERING: "player_controls.toggle_rendering",
	CHANGE_OPACITY: "player_controls.change_opacity",
	TOGGLE_TINT: "player_controls.toggle_tint",
	TOGGLE_VALIDATING: "player_controls.toggle_validating",
	CHANGE_LAYER: "player_controls.change_layer",
	DECREASE_LAYER: "player_controls.decrease_layer",
	CHANGE_LAYER_MODE: "player_controls.change_layer_mode",
	MOVE_HOLOGRAM: "player_controls.move_hologram",
	ROTATE_HOLOGRAM: "player_controls.rotate_hologram",
	CHANGE_STRUCTURE: "player_controls.change_structure",
	DISABLE_PLAYER_CONTROLS: "player_controls.disable_player_controls",
	BACKUP_HOLOGRAM: "player_controls.backup_hologram"
};
export const DEFAULT_PLAYER_CONTROLS = {
	TOGGLE_RENDERING: createItemCriteria("brick"),
	CHANGE_OPACITY: createItemCriteria("amethyst_shard"),
	TOGGLE_TINT: createItemCriteria("white_dye"),
	TOGGLE_VALIDATING: createItemCriteria("iron_ingot"),
	CHANGE_LAYER: createItemCriteria("leather"),
	DECREASE_LAYER: createItemCriteria("feather"),
	CHANGE_LAYER_MODE: createItemCriteria("flint"),
	MOVE_HOLOGRAM: createItemCriteria("stick"),
	ROTATE_HOLOGRAM: createItemCriteria("copper_ingot"),
	CHANGE_STRUCTURE: createItemCriteria("arrow"),
	DISABLE_PLAYER_CONTROLS: createItemCriteria("bone"),
	BACKUP_HOLOGRAM: createItemCriteria("paper")
};

const HOLOGRAM_LAYER_MODES = createNumericEnum(["SINGLE", "ALL_BELOW"]);
const FIXED_PACK_ICON_PATH = "guihjzzz.png"; 
const HOLOLAB_VERSION_STRING = "HoloLab dev"; 

export async function makePack(structureFiles, config = {}, resourcePackStack, previewCont) {
	console.info(`Running HoloLab (based on HoloPrint ${VERSION})`); 
	if(!resourcePackStack) {
		console.debug("Waiting for resource pack stack initialisation...");
		resourcePackStack = await new ResourcePackStack();
		console.debug("Resource pack stack initialised!");
	}
	let startTime = performance.now();
	
	config = addDefaultConfig(config);
	if(!Array.isArray(structureFiles)) {
		structureFiles = [structureFiles];
	}
	let nbts = await Promise.all(structureFiles.map(structureFile => readStructureNBT(structureFile)));
	console.info("Finished reading structure NBTs!");
	let structureSizes = nbts.map(nbt => nbt["size"].map(x => +x));
	let packName = config.PACK_NAME ?? getDefaultPackName(structureFiles);
	
    let packIconBlob;
    try { 
        const response = await fetch(FIXED_PACK_ICON_PATH);
        if (!response.ok) throw new Error(`HTTP status ${response.status} for ${FIXED_PACK_ICON_PATH}`);
        packIconBlob = await response.blob();
    } catch (e) {
        console.warn(`Could not load fixed pack icon from '${FIXED_PACK_ICON_PATH}': ${e.message}. Falling back to dynamic/form icon.`);
        packIconBlob = config.PACK_ICON_BLOB ?? await makePackIconFallback(concatenateFiles(structureFiles));
    }

	let loadedStuff = await loadStuff({
		packTemplate: {
			manifest: "manifest.json",
			hologramRenderControllers: "render_controllers/armor_stand.hologram.render_controllers.json",
			hologramGeo: "models/entity/armor_stand.hologram.geo.json", 
			hologramMaterial: "materials/entity.material",
			hologramAnimationControllers: "animation_controllers/armor_stand.hologram.animation_controllers.json",
			hologramAnimations: "animations/armor_stand.hologram.animation.json",
			boundingBoxOutlineParticle: "particles/bounding_box_outline.json",
			blockValidationParticle: "particles/block_validation.json",
			savingBackupParticle: "particles/saving_backup.json",
			singleWhitePixelTexture: "textures/particle/single_white_pixel.png",
			exclamationMarkTexture: "textures/particle/exclamation_mark.png",
			saveIconTexture: "textures/particle/save_icon.png",
			itemTexture: config.RETEXTURE_CONTROL_ITEMS? "textures/item_texture.json" : undefined,
			terrainTexture: config.RETEXTURE_CONTROL_ITEMS? "textures/terrain_texture.json" : undefined,
			hudScreenUI: config.MATERIAL_LIST_ENABLED? "ui/hud_screen.json" : undefined,
			customEmojiFont: "font/glyph_E2.png",
			languagesDotJson: "texts/languages.json",
            en_US_lang_pack_template: "texts/en_US.lang",
            pt_BR_lang_pack_template: "texts/pt_BR.lang",
            zh_CN_lang_pack_template: "texts/zh_CN.lang"
		},
		resources: { 
			entityFile: "entity/armor_stand.entity.json",
			defaultPlayerRenderControllers: config.PLAYER_CONTROLS_ENABLED? "render_controllers/player.render_controllers.json" : undefined,
			resourceItemTexture: config.RETEXTURE_CONTROL_ITEMS? "textures/item_texture.json" : undefined
		},
		otherFiles: { 
			packIcon: packIconBlob,
			itemIcons: config.RETEXTURE_CONTROL_ITEMS? fetch("data/itemIcons.json").then(res => res.jsonc()) : undefined
		},
		data: { 
			blockMetadata: "metadata/vanilladata_modules/mojang-blocks.json",
			itemMetadata: "metadata/vanilladata_modules/mojang-items.json"
		}
	}, resourcePackStack);
	
    let { 
        manifest: manifestTemplate,
        packIcon, entityFile, hologramRenderControllers, defaultPlayerRenderControllers, 
        hologramGeo, hologramMaterial, hologramAnimationControllers, hologramAnimations, 
        boundingBoxOutlineParticle, blockValidationParticle, savingBackupParticle, 
        singleWhitePixelTexture, exclamationMarkTexture, saveIconTexture, itemTexture, 
        terrainTexture, hudScreenUI, customEmojiFont, languagesDotJson, 
        en_US_lang_pack_template, pt_BR_lang_pack_template, zh_CN_lang_pack_template,
        resourceItemTexture, itemIcons 
    } = loadedStuff.files;
	
    let { blockMetadata, itemMetadata } = loadedStuff.data;

    let packageTemplateLangFiles = { "en_US": en_US_lang_pack_template, "pt_BR": pt_BR_lang_pack_template, "zh_CN": zh_CN_lang_pack_template };
    let fullResourceLangFiles = {};
    for (const langCode of languagesDotJson) {
        try {
            fullResourceLangFiles[langCode] = await resourcePackStack.fetchResource(`texts/${langCode}.lang`).then(res => {
                 if (!res.ok) throw new Error(`Failed to fetch texts/${langCode}.lang from resource stack (status ${res.status})`);
                return res.text();
            });
        } catch (e) {
            console.warn(`Could not load full .lang file for ${langCode} from resource stack. Error: ${e.message}`);
            fullResourceLangFiles[langCode] = packageTemplateLangFiles[langCode] || packageTemplateLangFiles["en_US"] || "title.language=English\n";
        }
    }
	
	let structures = nbts.map(nbt => nbt["structure"]);
	
	let palettesAndIndices = await Promise.all(structures.map(structure => tweakBlockPalette(structure, config.IGNORED_BLOCKS)));
	let { palette: blockPalette, indices: allStructureIndicesByLayer } = mergeMultiplePalettesAndIndices(palettesAndIndices);
	if(desparseArray(blockPalette).length == 0) {
		throw new UserError(`Structure is empty! No blocks are inside the structure.`);
	}
	
	let blockGeoMaker = await new BlockGeoMaker(config);
	let boneTemplatePalette = blockPalette.map(block => blockGeoMaker.makeBoneTemplate(block));
	
	let textureAtlas = await new TextureAtlas(config, resourcePackStack);
	await textureAtlas.makeAtlas([...blockGeoMaker.textureRefs]); 
	let textureBlobs = textureAtlas.imageBlobs;
	let defaultTextureIndex = max(textureBlobs.length - 3, 0); 
	
	boneTemplatePalette.forEach(boneTemplate => {
		boneTemplate["cubes"].forEach(cube => {
			Object.keys(cube["uv"]).forEach(faceName => {
				let face = cube["uv"][faceName];
				let imageUv = structuredClone(textureAtlas.textures[face["index"]]);
				if(face["flip_horizontally"]) {
					imageUv["uv"][0] += imageUv["uv_size"][0];
					imageUv["uv_size"][0] *= -1;
				}
				if(face["flip_vertically"]) {
					imageUv["uv"][1] += imageUv["uv_size"][1];
					imageUv["uv_size"][1] *= -1;
				}
				cube["uv"][faceName] = { "uv": imageUv["uv"], "uv_size": imageUv["uv_size"] };
			});
		});
	});
	
	//===[ START OF REWRITTEN GEOMETRY & ANIMATION LOGIC ]===//

	hologramGeo["minecraft:geometry"][0]["description"]["texture_width"] = textureAtlas.atlasWidth;
	hologramGeo["minecraft:geometry"][0]["description"]["texture_height"] = textureAtlas.atlasHeight;

    boneTemplatePalette.forEach((boneTemplate, paletteIndex) => {
        const templateBoneName = `template_${paletteIndex}`;
        let positionedBoneTemplate = blockGeoMaker.positionBoneTemplate(boneTemplate, [0, 0, 0]);
        hologramGeo["minecraft:geometry"][0]["bones"].push({
            "name": templateBoneName, "parent": "hologram_root", "pivot": [8, 0, -8], "scale": 0.0, ...positionedBoneTemplate
        });
    });

	let structureWMolang = arrayToMolang(structureSizes.map(s => s[0]), "v.hologram.structure_index");
	let structureHMolang = arrayToMolang(structureSizes.map(s => s[1]), "v.hologram.structure_index");
	let structureDMolang = arrayToMolang(structureSizes.map(s => s[2]), "v.hologram.structure_index");
	
	if(!config.SPAWN_ANIMATION_ENABLED) {
		delete hologramAnimations["animations"]["animation.armor_stand.hologram.spawn"];
	}
	
	let entityDescription = entityFile["minecraft:client_entity"]["description"];
    hologramRenderControllers["render_controllers"]["controller.render.armor_stand.hologram"]["geometry"] = "Geometry.default";
    entityDescription["geometry"]["default"] = "geometry.armor_stand.hologram";

	let totalBlocksToValidateByStructure = [];
	let totalBlocksToValidateByStructureByLayer = [];
	let uniqueBlocksToValidate = new Set();
	let structureAnimationFiles = [];
	
	let materialList = await new MaterialList(blockMetadata, itemMetadata);
	allStructureIndicesByLayer.forEach((structureIndicesByLayer, structureI) => {
		let structureSize = structureSizes[structureI];
		let blocksToValidate = [];
		let blocksToValidateByLayer = [];
		let structureAnimation = {
            "format_version": "1.8.0",
            "animations": { [`animation.hologram.structure_${structureI}`]: { "loop": true, "bones": {} } }
        };
        const structureAnimBones = structureAnimation.animations[`animation.hologram.structure_${structureI}`].bones;
        const particleAlignmentBone = hologramGeo["minecraft:geometry"][0].bones.find(b => b.name === 'particle_alignment');

		for(let y = 0; y < structureSize[1]; y++) {
			let blocksToValidateCurrentLayer = 0; 
			for(let x = 0; x < structureSize[0]; x++) {
				for(let z = 0; z < structureSize[2]; z++) {
					let blockI = (x * structureSize[1] + y) * structureSize[2] + z;
					structureIndicesByLayer.forEach((blockPaletteIndices, layerI) => {
						let paletteI = blockPaletteIndices[blockI];
						if(!(paletteI in boneTemplatePalette)) return;
						
                        const blockPosId = `p_${x}_${y}_${z}_${layerI}`;
                        const blockCoordinateName = `b_${x}_${y}_${z}`;

                        structureAnimBones[blockPosId] = {
                            "position": [-16 * x, 16 * y, 16 * z],
                            "scale": `(v.hologram.layer == -1 || v.hologram.layer_mode == ${HOLOGRAM_LAYER_MODES.ALL_BELOW} ? v.hologram.layer >= ${y} : v.hologram.layer == ${y}) ? 1.0 : ${config.MINI_SCALE}`
                        };

                        if (!hologramGeo["minecraft:geometry"][0]["bones"].some(b => b.name === blockPosId)) {
                             hologramGeo["minecraft:geometry"][0]["bones"].push({ "name": blockPosId, "parent": `template_${paletteI}` });
                        }
                        
						if (layerI === 0) {
							blocksToValidate.push({ "locator": blockCoordinateName, "block": blockPalette[paletteI]["name"], "pos": [x, y, z] });
                            if (!config.IGNORED_MATERIAL_LIST_BLOCKS.includes(blockPalette[paletteI]["name"])) {
							    materialList.add(blockPalette[paletteI]);
                            }
							blocksToValidateCurrentLayer++;
							uniqueBlocksToValidate.add(blockPalette[paletteI]["name"]);
						}
					});
				}
			}
			blocksToValidateByLayer.push(blocksToValidateCurrentLayer);
		}
		
        blocksToValidate.forEach(b => { particleAlignmentBone.locators[b.locator] = [8 - 16 * b.pos[0], 16 * b.pos[1], -8 + 16 * b.pos[2]]; });

        const animName = `hologram.structure_${structureI}`;
        const animControllerName = `controller.animation.armor_stand.hologram.structures`;
        if (!hologramAnimationControllers.animation_controllers[animControllerName]) {
            hologramAnimationControllers.animation_controllers[animControllerName] = { "initial_state": "s_0", "states": { "s_0": { "transitions": [] } } };
            entityDescription.animations["controller.hologram.structures"] = animControllerName;
            entityDescription.scripts.animate.push("controller.hologram.structures");
        }
        
        const states = hologramAnimationControllers.animation_controllers[animControllerName].states;
        const stateName = `s_${structureI}`;
        states[stateName] = { "animations": [animName], "transitions": [{ [`s_${(structureI + 1) % allStructureIndicesByLayer.length}`]: `v.hologram.structure_index != ${structureI}`}] };
        if (structureI === 0) {
           states["s_0"].transitions.push({[stateName]: `v.hologram.structure_index == ${structureI}`});
        } else {
            const prevState = states[`s_${structureI - 1}`] || states["s_0"];
            prevState.transitions.push({ [stateName]: `v.hologram.structure_index == ${structureI}` });
        }
        
        entityDescription.animations[animName] = `animation.hologram.structure_${structureI}`;
        structureAnimationFiles.push([`animations/hologram.structure_${structureI}.json`, stringifyWithFixedDecimals(structureAnimation)]);

		addBoundingBoxParticles(hologramAnimationControllers, structureI, structureSize);
		addBlockValidationParticles(hologramAnimationControllers, structureI, blocksToValidate, structureSize);
		totalBlocksToValidateByStructure.push(blocksToValidate.length);
		totalBlocksToValidateByStructureByLayer.push(blocksToValidateByLayer);
	});
	//===[ END OF REWRITTEN LOGIC ]===//
	
	let totalMaterialCountCalculated = materialList.totalMaterialCount;

	entityDescription["materials"]["hologram"] = "holoprint_hologram";
	entityDescription["materials"]["hologram.wrong_block_overlay"] = "holoprint_hologram.wrong_block_overlay";
	entityDescription["textures"]["hologram.overlay"] = "textures/entity/overlay";
	entityDescription["textures"]["hologram.save_icon"] = "textures/particle/save_icon";
	entityDescription["animations"]["hologram.align"] = "animation.armor_stand.hologram.align";
	entityDescription["animations"]["hologram.offset"] = "animation.armor_stand.hologram.offset";
	entityDescription["animations"]["hologram.spawn"] = "animation.armor_stand.hologram.spawn";
	entityDescription["animations"]["hologram.wrong_block_overlay"] = "animation.armor_stand.hologram.wrong_block_overlay";
	entityDescription["animations"]["controller.hologram.spawn_animation"] = "controller.animation.armor_stand.hologram.spawn_animation";
	entityDescription["animations"]["controller.hologram.layers"] = "controller.animation.armor_stand.hologram.layers";
	entityDescription["animations"]["controller.hologram.bounding_box"] = "controller.animation.armor_stand.hologram.bounding_box";
	entityDescription["animations"]["controller.hologram.block_validation"] = "controller.animation.armor_stand.hologram.block_validation";
	entityDescription["animations"]["controller.hologram.saving_backup_particles"] = "controller.animation.armor_stand.hologram.saving_backup_particles";
	entityDescription["scripts"]["animate"] ??= [];
	entityDescription["scripts"]["animate"].push("hologram.align", "hologram.offset", "hologram.wrong_block_overlay", "controller.hologram.spawn_animation", "controller.hologram.layers", "controller.hologram.bounding_box", "controller.hologram.block_validation", "controller.hologram.saving_backup_particles");
	entityDescription["scripts"]["should_update_bones_and_effects_offscreen"] = true; 
	entityDescription["scripts"]["initialize"] ??= [];
	entityDescription["scripts"]["initialize"].push(functionToMolang(entityScripts.armorStandInitialization, {
		structureSize: structureSizes[0],
		initialOffset: config.INITIAL_OFFSET,
		defaultTextureIndex,
		singleLayerMode: HOLOGRAM_LAYER_MODES.SINGLE,
		structureCount: structureFiles.length
	}));
	entityDescription["scripts"]["pre_animation"] ??= [];
	entityDescription["scripts"]["pre_animation"].push(functionToMolang(entityScripts.armorStandPreAnimation, {
		textureBlobsCount: textureBlobs.length,
		totalBlocksToValidate: arrayToMolang(totalBlocksToValidateByStructure, "v.hologram.structure_index"),
		totalBlocksToValidateByLayer: array2DToMolang(totalBlocksToValidateByStructureByLayer, "v.hologram.structure_index", "v.hologram.layer"),
		backupSlotCount: config.BACKUP_SLOT_COUNT,
		structureWMolang,
		structureHMolang,
		structureDMolang,
		toggleRendering: itemCriteriaToMolang(config.CONTROLS.TOGGLE_RENDERING),
		changeOpacity: itemCriteriaToMolang(config.CONTROLS.CHANGE_OPACITY),
		toggleTint: itemCriteriaToMolang(config.CONTROLS.TOGGLE_TINT),
		toggleValidating: itemCriteriaToMolang(config.CONTROLS.TOGGLE_VALIDATING),
		changeLayer: itemCriteriaToMolang(config.CONTROLS.CHANGE_LAYER),
		decreaseLayer: itemCriteriaToMolang(config.CONTROLS.DECREASE_LAYER),
		changeLayerMode: itemCriteriaToMolang(config.CONTROLS.CHANGE_LAYER_MODE),
		moveHologram: itemCriteriaToMolang(config.CONTROLS.MOVE_HOLOGRAM),
		rotateHologram: itemCriteriaToMolang(config.CONTROLS.ROTATE_HOLOGRAM),
		changeStructure: itemCriteriaToMolang(config.CONTROLS.CHANGE_STRUCTURE),
		backupHologram: itemCriteriaToMolang(config.CONTROLS.BACKUP_HOLOGRAM),
		disablePlayerControls: itemCriteriaToMolang(config.CONTROLS.DISABLE_PLAYER_CONTROLS),
		ACTIONS: entityScripts.ACTIONS,
        singleLayerMode: HOLOGRAM_LAYER_MODES.SINGLE
	}));
	entityDescription["geometry"]["hologram.wrong_block_overlay"] = "geometry.armor_stand.hologram.wrong_block_overlay";
	entityDescription["geometry"]["hologram.valid_structure_overlay"] = "geometry.armor_stand.hologram.valid_structure_overlay";
	entityDescription["geometry"]["hologram.particle_alignment"] = "geometry.armor_stand.hologram.particle_alignment";
	entityDescription["render_controllers"] ??= [];
	entityDescription["render_controllers"].push({
		"controller.render.armor_stand.hologram": "v.hologram.rendering"
	}, {
		"controller.render.armor_stand.hologram.wrong_block_overlay": "v.hologram.show_wrong_block_overlay"
	}, {
		"controller.render.armor_stand.hologram.valid_structure_overlay": "v.hologram.validating && v.wrong_blocks == 0"
	}, "controller.render.armor_stand.hologram.particle_alignment");
	entityDescription["particle_effects"] ??= {};
	entityDescription["particle_effects"]["bounding_box_outline"] = "hololab:bounding_box_outline";
	entityDescription["particle_effects"]["saving_backup"] = "hololab:saving_backup";
	
	textureBlobs.forEach(([textureName]) => {
		entityDescription["textures"][textureName] = `textures/entity/${textureName}`;
		hologramRenderControllers["render_controllers"]["controller.render.armor_stand.hologram"]["arrays"]["textures"]["Array.textures"].push(`Texture.${textureName}`);
	});
	
	let tintColorChannels = hexColorToClampedTriplet(config.TINT_COLOR);
	hologramRenderControllers["render_controllers"]["controller.render.armor_stand.hologram"]["overlay_color"] = {
		"r": +tintColorChannels[0].toFixed(4),
		"g": +tintColorChannels[1].toFixed(4),
		"b": +tintColorChannels[2].toFixed(4),
		"a": `v.hologram.show_tint? ${config.TINT_OPACITY} : 0`
	};
	
	let overlayTexture = await singleWhitePixelTexture.setOpacity(config.WRONG_BLOCK_OVERLAY_COLOR[3]);
		
	uniqueBlocksToValidate.forEach(blockName => {
		let particleName = `validate_${blockName.replace(":", ".")}`;
		entityDescription["particle_effects"][particleName] = `hololab:${particleName}`;
	});
	
    let playerRenderControllers;
	if(config.PLAYER_CONTROLS_ENABLED && defaultPlayerRenderControllers){
		playerRenderControllers = addPlayerControlsToRenderControllers(config, defaultPlayerRenderControllers);
	}
	
    let finalisedMaterialLists = Object.fromEntries(languagesDotJson.map(languageCode => {
        materialList.setLanguage(fullResourceLangFiles[languageCode] || fullResourceLangFiles["en_US"]);
        return [languageCode, materialList.export()];
    }));
	let finalisedMaterialListForHUD = finalisedMaterialLists["en_US"]; 
	
	let highestItemCount;
	if(config.MATERIAL_LIST_ENABLED && hudScreenUI) {
		let missingItemAux = blockMetadata["data_items"].find(block => block.name == "minecraft:reserved6")?.["raw_id"] ?? 0;
		
        hudScreenUI["material_list_entries"] ??= {};
        hudScreenUI["material_list_entries"]["controls"] ??= [];

		hudScreenUI["material_list_entries"]["controls"].push(...finalisedMaterialListForHUD.map(({ translationKey, partitionedCount, auxId }, i) => ({
			[`material_list_${i}@hud.material_list_entry`]: {
				"$item_translation_key": translationKey,
				"$item_count": partitionedCount,
				"$item_id_aux": auxId ?? missingItemAux,
				"$background_opacity": i % 2 * 0.2
			}
		})));
		highestItemCount = max(...finalisedMaterialListForHUD.map(({ count }) => count));
		let longestItemNameLength = max(...finalisedMaterialListForHUD.map(({ translatedName }) => translatedName.length));
		let longestCountLength = max(...finalisedMaterialListForHUD.map(({ partitionedCount }) => partitionedCount.length));
		
        if (hudScreenUI["material_list"] && hudScreenUI["material_list"]["size"]) {
            if(longestItemNameLength + longestCountLength >= 43) {
                hudScreenUI["material_list"]["size"][0] = "50%"; 
                hudScreenUI["material_list"]["max_size"][0] = "50%";
            }
            hudScreenUI["material_list"]["size"][1] = finalisedMaterialListForHUD.length * 12 + 12; 
        }

        if (hudScreenUI &&
            hudScreenUI["material_list_entry"] &&
            hudScreenUI["material_list_entry"]["controls"] &&
            hudScreenUI["material_list_entry"]["controls"][0] &&
            hudScreenUI["material_list_entry"]["controls"][0]["content"] &&
            hudScreenUI["material_list_entry"]["controls"][0]["content"]["controls"] &&
            hudScreenUI["material_list_entry"]["controls"][0]["content"]["controls"][3] &&
            hudScreenUI["material_list_entry"]["controls"][0]["content"]["controls"][3]["item_name"] &&
            hudScreenUI["material_list_entry"]["controls"][0]["content"]["controls"][3]["item_name"]["size"] &&
            typeof hudScreenUI["material_list_entry"]["controls"][0]["content"]["controls"][3]["item_name"]["size"][0] === 'string'
        ) {
            hudScreenUI["material_list_entry"]["controls"][0]["content"]["controls"][3]["item_name"]["size"][0] += `${round(longestCountLength * 4.2 + 10)}px`;
        }
	}
	
	let finalManifest = structuredClone(manifestTemplate); 
	finalManifest["header"]["name"] = "pack.name";
    finalManifest["header"]["description"] = "pack.description";
	finalManifest["header"]["uuid"] = crypto.randomUUID();
	let packVersionToUse = VERSION.match(/^v(\d+)\.(\d+)\.(\d+)$/)?.slice(1)?.map(x => +x) ?? [1,0,0];
    if (VERSION === "dev" || VERSION === "testing") packVersionToUse = [1,0,0]; 
    
	finalManifest["header"]["version"] = packVersionToUse;
	finalManifest["modules"][0]["uuid"] = crypto.randomUUID();
	finalManifest["modules"][0]["version"] = packVersionToUse;
    finalManifest["modules"][0]["description"] = "§r\nDeveloped by §l§btik§dtok §cGuihjzzz"; 

    delete finalManifest["metadata"]["generated_with"]; 
	if (!finalManifest["metadata"]) finalManifest["metadata"] = {};
    finalManifest["metadata"]["url"] = "https://discord.gg/YTdKsTjnUy"; 
	finalManifest["metadata"]["authors"] = ["HoloLab", "§r§cGUIHJZZZ", ...config.AUTHORS].filter(Boolean); 
    finalManifest["metadata"]["license"] = "CC BY-NC-SA 4.0";

    finalManifest["settings"] = []; 
    finalManifest["settings"].push(
        { "type": "input", "text": "§bTIK§dTOK:", "default": "https://www.tiktok.com/@guihjzzz?_t=ZM-8vawBdE0Ew2&_r=1", "name": "tiktok" },
        { "type": "input", "text": "Generated by §r§uDISCORD:", "default": "https://discord.gg/YTdKsTjnUy", "name": "discord" }
    );
	
	let controlsHaveBeenCustomised = JSON.stringify(config.CONTROLS) != JSON.stringify(DEFAULT_PLAYER_CONTROLS);
	let pmmpBedrockDataFetcher = config.RENAME_CONTROL_ITEMS || config.RETEXTURE_CONTROL_ITEMS? await createPmmpBedrockDataFetcher() : undefined;
	let itemTags = config.RENAME_CONTROL_ITEMS || config.RETEXTURE_CONTROL_ITEMS? await pmmpBedrockDataFetcher.fetch("item_tags.json").then(res => res.json()) : undefined;
	let { inGameControls, controlItemTranslations } = controlsHaveBeenCustomised || config.RENAME_CONTROL_ITEMS? await translateControlItems(config, blockMetadata, itemMetadata, languagesDotJson, fullResourceLangFiles, itemTags) : {};
	
	let packGenerationTime = (new Date()).toLocaleString();
	const disabledFeatureTranslations = { 
		"SPAWN_ANIMATION_ENABLED": "pack.description.spawn_animation_disabled",
		"PLAYER_CONTROLS_ENABLED": "pack.description.player_controls_disabled",
		"MATERIAL_LIST_ENABLED": "pack.description.material_list_disabled",
		"RETEXTURE_CONTROL_ITEMS": "pack.description.retextured_control_items_disabled",
		"RENAME_CONTROL_ITEMS": "pack.description.renamed_control_items_disabled"
	};

	let processedLanguageFiles = await Promise.all(languagesDotJson.map(async languageCode => {
        let langFileContent = packageTemplateLangFiles[languageCode] || packageTemplateLangFiles["en_US"] || `pack.name=${packName}\npack.description=HoloLab Pack`;
		langFileContent = langFileContent.replaceAll("{PACK_NAME}", packName);
		langFileContent = langFileContent.replaceAll("{PACK_GENERATION_TIME}", packGenerationTime);
        const INVISIBLE_CHAR = "\u200B"; 
        langFileContent = langFileContent.replaceAll("{TOTAL_MATERIAL_COUNT}", INVISIBLE_CHAR); 
        langFileContent = langFileContent.replaceAll("{MATERIAL_LIST}", INVISIBLE_CHAR);
		
		let authorsText = "";
		if(config.AUTHORS.length) {
            let authorsSectionTemplate = translate("pack.description.authors_template", languageCode) || "Authors: {STRUCTURE_AUTHORS}";
            authorsText = authorsSectionTemplate.replace("{STRUCTURE_AUTHORS}", config.AUTHORS.join(" and "));
		}
        langFileContent = langFileContent.replaceAll("{AUTHORS_SECTION}", authorsText);

        let userDescriptionText = "";
		if(config.DESCRIPTION) {
            let userDescTemplate = translate("pack.description.user_description_template", languageCode) || "{DESCRIPTION}";
			userDescriptionText = userDescTemplate.replace("{DESCRIPTION}", config.DESCRIPTION.replaceAll("\n", "\\n"));
		}
        langFileContent = langFileContent.replaceAll("{DESCRIPTION_SECTION}", userDescriptionText);

		let translatedDisabledFeatures = Object.entries(disabledFeatureTranslations)
            .filter(([feature]) => !config[feature])
            .map(([_, translationKey]) => translate(translationKey, languageCode))
            .filter(Boolean)
            .join("\\n");
        let disabledFeaturesText = "";
		if(translatedDisabledFeatures) {
            let disabledFeaturesTemplate = translate("pack.description.disabled_features_template", languageCode) || "Disabled features:\n{DISABLED_FEATURES}";
			disabledFeaturesText = disabledFeaturesTemplate.replace("{DISABLED_FEATURES}", translatedDisabledFeatures);
		}
        langFileContent = langFileContent.replaceAll("{DISABLED_FEATURES_SECTION}", disabledFeaturesText);

        let controlsText = "";
		if(controlsHaveBeenCustomised && inGameControls && inGameControls[languageCode]) {
            let controlsTemplate = translate("pack.description.controls_template", languageCode) || "Controls:\n{CONTROLS}";
			controlsText = controlsTemplate.replace("{CONTROLS}", inGameControls[languageCode].replaceAll("\n", "\\n"));
		}
        langFileContent = langFileContent.replaceAll("{CONTROLS_SECTION}", controlsText);
		
        const optionalSections = ["AUTHORS_SECTION", "DESCRIPTION_SECTION", "DISABLED_FEATURES_SECTION", "CONTROLS_SECTION"];
        optionalSections.forEach(sectionPlaceholder => {
            const regex = new RegExp(`\\{${sectionPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\}`, 'g');
            langFileContent = langFileContent.replace(regex, "");
        });

		langFileContent = langFileContent.replaceAll(/\t*#.+/g, "");
        langFileContent = langFileContent.replace(/^\s*[\r\n]/gm, "");
		if(config.RENAME_CONTROL_ITEMS && controlItemTranslations && controlItemTranslations[languageCode]) {
			langFileContent += "\n" + controlItemTranslations[languageCode];
		}
		return [languageCode, langFileContent.trim()];
	}));
	
	let hasModifiedTerrainTexture = false;
	let controlItemTextures = [];
	if(config.RETEXTURE_CONTROL_ITEMS && itemIcons && resourceItemTexture && textureAtlas?.blocksDotJson && textureAtlas?.terrainTexture) {
		let legacyItemMappings;
		let loadingLegacyItemMappingsPromise;
		let itemIconPatterns = Object.entries(itemIcons).filter(([key]) => key.startsWith("/") && key.endsWith("/")).map(([pattern, itemName]) => [new RegExp(pattern.slice(1, -1), "g"), itemName]);
		await Promise.all(Object.entries(config.CONTROLS).map(async ([control, itemCriteria]) => {
			let controlTexturePath = `textures/items/~${control.toLowerCase()}.png`; 
			let controlTexture;
            try {
                controlTexture = await fetch(`packTemplate/${controlTexturePath}`).then(res => {
                    if (!res.ok) throw new Error(`Failed to fetch ${controlTexturePath}`);
                    return res.toImage();
                });
            } catch (e) {
                console.warn(`Control item texture ${controlTexturePath} not found, skipping retexture for this control. Error: ${e}`);
                return;
            }

			let paddedTexture = await addPaddingToImage(controlTexture, { right: 16, bottom: 16 });
			let controlItemTextureSizes = new Set();
			let allItems = expandItemCriteria(itemCriteria, itemTags);
			await Promise.all(allItems.map(async itemName => {
				if(itemName in itemIcons) { itemName = itemIcons[itemName]; } 
                else {
					let matchingPatternAndReplacement = itemIconPatterns.find(([pattern]) => pattern.test(itemName));
					if(matchingPatternAndReplacement) { itemName = itemName.replaceAll(...matchingPatternAndReplacement); }
				}
				let variant = -1;
				if(itemName.includes(".")) {
					let dotIndex = itemName.indexOf(".");
					variant = +itemName.slice(dotIndex + 1);
					itemName = itemName.slice(0, dotIndex);
				}
				let usingTerrainAtlas = false;
				let originalTexturePath = resourceItemTexture["texture_data"][itemName]?.["textures"];
				if(originalTexturePath) {
					if(Array.isArray(originalTexturePath)) { if(originalTexturePath.length == 1) { variant = 0; } }
				} else if(itemName in textureAtlas.blocksDotJson) {
					if(typeof textureAtlas.blocksDotJson[itemName]["carried_textures"] == "string" && textureAtlas.terrainTexture["texture_data"][textureAtlas.blocksDotJson[itemName]["carried_textures"]]?.["textures"]?.startsWith?.("textures/items/")) {
						hasModifiedTerrainTexture = true;
						usingTerrainAtlas = true;
						originalTexturePath = textureAtlas.terrainTexture["texture_data"][textureAtlas.blocksDotJson[itemName]["carried_textures"]]["textures"];
						itemName = textureAtlas.blocksDotJson[itemName]["carried_textures"];
					} else { return; }
				} else {
					loadingLegacyItemMappingsPromise ??= new Promise(async (res, rej) => {
						try {
                            if(!pmmpBedrockDataFetcher) { console.error("pmmpBedrockDataFetcher not initialized for legacy item mappings."); return rej("pmmpBedrockDataFetcher not initialized"); }
							legacyItemMappings = new Map();
							let updateMappings = await pmmpBedrockDataFetcher.fetch("r16_to_current_item_map.json").then(res => res.json());
							Object.entries(updateMappings["simple"]).forEach(([oldName, newName]) => { legacyItemMappings.set(newName.slice(10), [oldName.slice(10), -1]); });
							Object.entries(updateMappings["complex"]).forEach(([oldName, newNames]) => { Object.entries(newNames).forEach(([index, newName]) => { legacyItemMappings.set(newName.slice(10), [oldName.slice(10), index]); }); });
							res();
						} catch(e) { rej(e); }
					});
					try { await loadingLegacyItemMappingsPromise; } catch(e) { console.error("Somehow failed loading legacy item mappings. Please report this on GitHub!", e); return; }
					if(!legacyItemMappings || !legacyItemMappings.has(itemName)) { return; }
					let [oldItemName, legacyVariant] = legacyItemMappings.get(itemName);
					variant = legacyVariant;
					originalTexturePath = resourceItemTexture["texture_data"][oldItemName]?.["textures"];
					if(!originalTexturePath) { return; }
					itemName = oldItemName; 
				}
				
				if(Array.isArray(originalTexturePath)) { 
					if(variant == -1) { return; }
					if(!(variant in originalTexturePath)) { console.error(`Item texture variant ${variant} for ${itemName} does not exist!`); return; }
                    itemTexture["texture_data"][itemName] ??= { "textures": [] };
					if(!Array.isArray(itemTexture["texture_data"][itemName]["textures"])){ itemTexture["texture_data"][itemName]["textures"] = [itemTexture["texture_data"][itemName]["textures"]]; }
                    while(itemTexture["texture_data"][itemName]["textures"].length <= variant) { itemTexture["texture_data"][itemName]["textures"].push(null); }

					let specificOriginalTexturePath = `${originalTexturePath[variant]}.png`;
					let originalImage;
					try { originalImage = await resourcePackStack.fetchResource(specificOriginalTexturePath).then(res => res.toImage()); } catch(e) { console.warn(`Failed to load texture ${specificOriginalTexturePath} for control item retexturing!`); return; }
					let overlayedImageBlob = await overlaySquareImages(originalImage, paddedTexture);
					let newTexturePath = `${originalTexturePath[variant].replace(/^textures\/items\//, "")}_${control.toLowerCase()}.png`;
					controlItemTextures.push([`textures/items/${newTexturePath}`, overlayedImageBlob]);
					itemTexture["texture_data"][itemName]["textures"][variant] = `textures/items/${newTexturePath.slice(0, -4)}`;
				} else {
					let itemTextureSize = 16;
					if(resourcePackStack.hasResourcePacks) { try { let originalImage = await resourcePackStack.fetchResource(`${originalTexturePath}.png`).then(res => res.toImage()); itemTextureSize = originalImage.width; } catch(e) { } }
					let safeSize = lcm(paddedTexture.width, itemTextureSize) * config.CONTROL_ITEM_TEXTURE_SCALE; 
					controlItemTextureSizes.add(safeSize);
					(usingTerrainAtlas? terrainTexture : itemTexture)["texture_data"][itemName] = { "textures": [originalTexturePath, `textures/items/~${control.toLowerCase()}_${safeSize}`], "additive": true };
				}
			}));
			await Promise.all([...controlItemTextureSizes].map(async size => {
				let resizedImagePath = `textures/items/~${control.toLowerCase()}_${size}.png`;
				let resizedTextureBlob = await resizeImageToBlob(paddedTexture, size);
				controlItemTextures.push([resizedImagePath, resizedTextureBlob]);
			}));
		}));
	}
	
	console.info("Finished making all pack files!");
	
	let packFileWriter = new BlobWriter();
	let packZip = new ZipWriter(packFileWriter);
	let packFiles = [];
	if(structureFiles.length == 1) {
		packFiles.push([".mcstructure", structureFiles[0], structureFiles[0].name]);
	} else {
		packFiles.push(...structureFiles.map((structureFile, i) => [`${i}.mcstructure`, structureFile, structureFile.name]));
	}
	packFiles.push(["manifest.json", JSON.stringify(finalManifest)]);
	packFiles.push(["pack_icon.png", packIcon]);
	packFiles.push(["entity/armor_stand.entity.json", JSON.stringify(entityFile).replaceAll("HOLOGRAM_INITIAL_ACTIVATION", true)]);
	packFiles.push(["subpacks/punch_to_activate/entity/armor_stand.entity.json", JSON.stringify(entityFile).replaceAll("HOLOGRAM_INITIAL_ACTIVATION", false)]);
	packFiles.push(["render_controllers/armor_stand.hologram.render_controllers.json", JSON.stringify(hologramRenderControllers)]);
	
	if(config.PLAYER_CONTROLS_ENABLED && playerRenderControllers) { 
		packFiles.push(["render_controllers/player.render_controllers.json", JSON.stringify(playerRenderControllers)]);
	}

	packFiles.push(["models/entity/armor_stand.hologram.geo.json", stringifyWithFixedDecimals(hologramGeo)]);
    packFiles.push(...structureAnimationFiles);
	packFiles.push(["materials/entity.material", JSON.stringify(hologramMaterial)]);
	packFiles.push(["animation_controllers/armor_stand.hologram.animation_controllers.json", JSON.stringify(hologramAnimationControllers)]);
	packFiles.push(["particles/bounding_box_outline.json", JSON.stringify(boundingBoxOutlineParticle)]);
	uniqueBlocksToValidate.forEach(blockName => {
		let particleName = `validate_${blockName.replace(":", ".")}`; 
		let particle = structuredClone(blockValidationParticle);
		particle["particle_effect"]["description"]["identifier"] = `hololab:${particleName}`;
		particle["particle_effect"]["components"]["minecraft:particle_expire_if_in_blocks"] = [blockName.includes(":")? blockName : `minecraft:${blockName}`]; 
		packFiles.push([`particles/${particleName}.json`, JSON.stringify(particle)]);
	});
	packFiles.push(["particles/saving_backup.json", JSON.stringify(savingBackupParticle)]);
	packFiles.push(["textures/particle/single_white_pixel.png", await singleWhitePixelTexture.toBlob()]);
	packFiles.push(["textures/particle/exclamation_mark.png", await exclamationMarkTexture.toBlob()]);
	packFiles.push(["textures/particle/save_icon.png", await saveIconTexture.toBlob()]);
	packFiles.push(["textures/entity/overlay.png", await overlayTexture.toBlob()]);
	packFiles.push(["animations/armor_stand.hologram.animation.json", JSON.stringify(hologramAnimations)]);
	textureBlobs.forEach(([textureName, blob]) => {
		packFiles.push([`textures/entity/${textureName}.png`, blob]);
	});
	if(config.RETEXTURE_CONTROL_ITEMS) {
		packFiles.push(["textures/item_texture.json", JSON.stringify(itemTexture)]);
		if(hasModifiedTerrainTexture) {
			packFiles.push(["textures/terrain_texture.json", JSON.stringify(terrainTexture)]);
		}
		packFiles.push(...controlItemTextures);
	}
	if(config.MATERIAL_LIST_ENABLED && hudScreenUI) {
		packFiles.push(["ui/hud_screen.json", JSON.stringify(hudScreenUI)]);
		if(highestItemCount >= 1728 && customEmojiFont) {
			packFiles.push(["font/glyph_E2.png", await customEmojiFont.toBlob()]);
		}
	}
	packFiles.push(["texts/languages.json", JSON.stringify(languagesDotJson)]);
	processedLanguageFiles.forEach(([languageCode, langFileContent]) => {
		packFiles.push([`texts/${languageCode}.lang`, langFileContent]);
	});
	
	await Promise.all(packFiles.map(([fileName, fileContents, comment]) => {
		let options = { comment, level: config.COMPRESSION_LEVEL };
		if(fileContents instanceof Blob) {
			return packZip.add(fileName, new BlobReader(fileContents), options);
		} else {
			return packZip.add(fileName, new TextReader(fileContents), options);
		}
	}));
	let zippedPack = await packZip.close();
	
	console.info(`Finished creating pack in ${(performance.now() - startTime).toFixed(0) / 1000}s!`);
	
	if(previewCont) {
		let showPreview = () => {
			(new PreviewRenderer(previewCont, textureAtlas, hologramGeo, { ...hologramAnimations, ...Object.fromEntries(structureAnimationFiles.map(([path, content])=> [path, JSON.parse(content)])) }, config.SHOW_PREVIEW_SKYBOX)).catch(e => console.error("Preview renderer error:", e)); 
		};
        let totalBlockCountForPreview = allStructureIndicesByLayer.reduce((sum, structureIndices) => {
            return sum + structureIndices.flat().filter(paletteIndex => {
                return paletteIndex !== -1 && blockPalette[paletteIndex] && blockPalette[paletteIndex].name !== 'air';
            }).length;
        }, 0);

		if(totalBlockCountForPreview < config.PREVIEW_BLOCK_LIMIT) {
			showPreview();
		} else {
			let message = document.createElement("div");
			message.classList.add("previewMessage", "clickToView");
			let p = document.createElement("p");
			p.dataset.translationSubTotalBlockCount = totalBlockCountForPreview.toString();
			if(structureFiles.length == 1) { p.dataset.translate = "preview.click_to_view"; } 
            else { p.dataset.translate = "preview.click_to_view_multiple"; }
			message.appendChild(p);
			message.addEventListener("click", () => { message.remove(); showPreview(); });
			previewCont.appendChild(message);
		}
	}
	
	return new File([zippedPack], `${packName}.hololab.mcpack`, { type: "application/mcpack" });
}
/**
 * Retrieves the structure files from a completed HoloLab resource pack.
 * @param {File} resourcePack HoloLab resource pack (`*.mcpack)
 * @returns {Promise<Array<File>>}
 */
export async function extractStructureFilesFromPack(resourcePack) {
	let packFileReader = new BlobReader(resourcePack);
	let packFolder = new ZipReader(packFileReader);
	let structureFileEntries = (await packFolder.getEntries()).filter(entry => entry.filename.endsWith(".mcstructure"));
	packFolder.close();
	let structureBlobs = await Promise.all(structureFileEntries.map(entry => entry.getData(new BlobWriter())));
	let packName = resourcePack.name.slice(0, resourcePack.name.indexOf("."));
	if(structureBlobs.length == 1) {
		return [new File([structureBlobs[0]], structureFileEntries[0].comment || `${packName}.mcstructure`)];
	} else {
		return await Promise.all(structureBlobs.map(async (structureBlob, i) => new File([structureBlob], structureFileEntries[i].comment || `${packName}_${i}.mcstructure`)));
	}
}
/**
 * Updates a HoloLab resource pack by remaking it.
 * @param {File} resourcePack HoloLab resource pack to update (`*.mcpack`)
 * @param {HoloPrintConfig} [config]
 * @param {ResourcePackStack} [resourcePackStack]
 * @param {HTMLElement} [previewCont]
 * @returns {Promise<File>}
 */
export async function updatePack(resourcePack, config, resourcePackStack, previewCont) {
	let structureFiles = await extractStructureFilesFromPack(resourcePack); 
	if(!structureFiles || structureFiles.length === 0) { 
		throw new UserError(`No structure files found inside resource pack ${resourcePack.name}; cannot update pack!`);
	}
	return await makePack(structureFiles, config, resourcePackStack, previewCont);
}
/**
 * Returns the default pack name that would be used if no pack name is specified.
 * @param {Array<File>} structureFiles
 * @returns {String}
 */
export function getDefaultPackName(structureFiles) {
	let defaultName = structureFiles.map(structureFile => structureFile.name.replace(/(\.hololab)?\.[^.]+$/, "")).join(", "); 
	if(defaultName.length > 40) {
		defaultName = `${defaultName.slice(0, 19)}...${defaultName.slice(-19)}`
	}
	if(defaultName.trim() == "") {
		defaultName = "hologram";
	}
	return defaultName;
}
/**
 * Finds all labels and links in a description section that will be put in the settings links section.
 * @param {String} description
 * @returns {Array<[String, String]>}
 */
export function findLinksInDescription(description) {
	let links = [];
	Array.from(description.matchAll(/(.*?)\n?\s*(https?:\/\/[^\s]+)/g)).forEach(match =>  {
		let label = match[1].trim();
		let url = match[2].trim();
		links.push([label, url]);
	});
	return links;
}
/**
 * Creates an ItemCriteria from arrays of names and tags.
 * @param {String|Array<String>} names
 * @param {String|Array<String>} [tags]
 * @returns {ItemCriteria}
 */
export function createItemCriteria(names, tags = []) { 
	if(!Array.isArray(names)) {
		names = [names];
	}
	if(!Array.isArray(tags)) {
		tags = [tags];
	}
	return { names, tags };
}
/**
 * Adds default config options to a potentially incomplete config object.
 * @param {Partial<HoloPrintConfig>} config
 * @returns {HoloPrintConfig}
 */
export function addDefaultConfig(config) {
	return Object.freeze({
		...{ 
			IGNORED_BLOCKS: [],
			IGNORED_MATERIAL_LIST_BLOCKS: [],
			SCALE: 0.95,
			OPACITY: 0.9,
			MULTIPLE_OPACITIES: true,
			TINT_COLOR: "#579EFA",
			TINT_OPACITY: 0.2,
			MINI_SCALE: 0.125, 
			TEXTURE_OUTLINE_WIDTH: 0.25, 
			TEXTURE_OUTLINE_COLOR: "#00F",
			TEXTURE_OUTLINE_OPACITY: 0.65,
			SPAWN_ANIMATION_ENABLED: true,
			SPAWN_ANIMATION_LENGTH: 0.4, 
			PLAYER_CONTROLS_ENABLED: true,
			CONTROLS: {},
			MATERIAL_LIST_ENABLED: true,
			RETEXTURE_CONTROL_ITEMS: false, 
			CONTROL_ITEM_TEXTURE_SCALE: 1,
			RENAME_CONTROL_ITEMS: true,
			WRONG_BLOCK_OVERLAY_COLOR: [1, 0, 0, 0.3],
			INITIAL_OFFSET: [0, 0, 0],
			BACKUP_SLOT_COUNT: 10,
			PACK_NAME: undefined,
			PACK_ICON_BLOB: undefined,
			AUTHORS: [],
			DESCRIPTION: undefined,
			COMPRESSION_LEVEL: 5, 
			PREVIEW_BLOCK_LIMIT: 500,
			SHOW_PREVIEW_SKYBOX: true
		},
		...config,
		...{ 
			IGNORED_BLOCKS: IGNORED_BLOCKS.concat(config.IGNORED_BLOCKS ?? []),
			CONTROLS: {
				...DEFAULT_PLAYER_CONTROLS,
				...config.CONTROLS
			}
		}
	});
}
/**
 * Creates a CachingFetcher to read pmmp/BedrockData.
 * @returns {Promise<CachingFetcher>}
 */
export async function createPmmpBedrockDataFetcher() {
	const pmmpBedrockDataVersion = "4.1.0+bedrock-1.21.70";
	return await new CachingFetcher(`BedrockData@${pmmpBedrockDataVersion}`, `https://cdn.jsdelivr.net/gh/pmmp/BedrockData@${pmmpBedrockDataVersion}/`);
}

/**
 * Reads the NBT of a structure file, returning a JSON object.
 * @param {File} structureFile `*.mcstructure`
 * @returns {Promise<Object>}
 */
async function readStructureNBT(structureFile) {
	if(structureFile.size == 0) {
		throw new UserError(`"${structureFile.name}" is an empty file! Please try exporting your structure again.\nIf you play on a version below 1.20.50, exporting to OneDrive will cause your structure file to be empty.`);
	}
	let arrayBuffer = await structureFile.arrayBuffer().catch(e => { throw new Error(`Could not read contents of structure file "${structureFile.name}"!\n${e}`); });
	let nbt = await NBT.read(arrayBuffer).catch(e => { throw new Error(`Invalid NBT in structure file "${structureFile.name}"!\n${e}`); });
	return nbt.data;
}
/**
 * Loads many files from different sources.
 * @template TPackTemplate
 * @template TResources
 * @template TOtherFiles
 * @template TData
 * @param {{ packTemplate?: TPackTemplate, resources?: TResources, otherFiles?: TOtherFiles, data?: TData }} stuff
 * @param {ResourcePackStack} resourcePackStack
 * @returns {Promise<{ files: { [K in keyof TPackTemplate | keyof TResources | keyof TOtherFiles]?: String|Blob|Record<String, any>|Array<any>|HTMLImageElement }, data: { [K in keyof TData]?: String|Blob|Record<String, any>|Array<any>|HTMLImageElement } }>}
*/
async function loadStuff(stuff, resourcePackStack) {
	let filePromises = {};
	Object.entries(stuff.packTemplate ?? {}).forEach(([name, path]) => {
		filePromises[name] = path && getResponseContents(fetch(`packTemplate/${path}`), path);
	});
	Object.entries(stuff.resources ?? {}).forEach(([name, path]) => {
		filePromises[name] = path && getResponseContents(resourcePackStack.fetchResource(path), path);
	});
	Object.assign(filePromises, stuff.otherFiles ?? {});
	let dataPromises = {};
	Object.entries(stuff.data ?? {}).forEach(([name, path]) => {
		dataPromises[name] = path && getResponseContents(resourcePackStack.fetchData(path), path);
	});
	return await awaitAllEntries({
		files: awaitAllEntries(filePromises),
		data: awaitAllEntries(dataPromises)
	});
}
/**
 * Gets the contents of a response based on the requested file extension (e.g. object from .json, image from .png, etc.).
 * @overload
 * @param {Promise<Response>} resPromise
 * @param {`${String}.${"json"|"material"}`} filePath
 * @returns {Promise<Record<String, any>|Array<any>>}
 */
/**
 * Gets the contents of a response based on the requested file extension (e.g. object from .json, image from .png, etc.).
 * @overload
 * @param {Promise<Response>} resPromise
 * @param {`${String}.lang`} filePath
 * @returns {Promise<String>}
 */
/**
 * Gets the contents of a response based on the requested file extension (e.g. object from .json, image from .png, etc.).
 * @overload
 * @param {Promise<Response>} resPromise
 * @param {`${String}.png`} filePath
 * @returns {Promise<HTMLImageElement>}
 */
/**
 * Gets the contents of a response based on the requested file extension (e.g. object from .json, image from .png, etc.).
 * @overload
 * @param {Promise<Response>} resPromise
 * @param {String} filePath
 * @returns {Promise<Blob>}
 */
async function getResponseContents(resPromise, filePath) {
	let res = await resPromise;
	if(res.status >= 400) {
		throw new Error(`HTTP error ${res.status} for ${res.url}`);
	}
	let fileExtension = getFileExtension(filePath);
	switch(fileExtension) {
		case "json":
		case "material": return await res.jsonc();
		case "lang": return await res.text();
		case "png": return await res.toImage();
	}
	return await res.blob();
}
/**
 * Removes ignored blocks from the block palette, updates old blocks, and adds block entities as separate entries.
 * @param {Record<String, any>} structure The de-NBT-ed structure file
 * @param {Array<String>} ignoredBlocks Array of block names to ignore
 * @returns {Promise<{ palette: Array<Block>, indices: Array<Array<Number>> }>}
 */
async function tweakBlockPalette(structure, ignoredBlocks) {
	let palette = structuredClone(structure["palette"]["default"]["block_palette"]);
	
	let blockVersions = new Set(); 
	let blockUpdater = new BlockUpdater(true);
	let updatedBlocks = 0;
	for(let [i, block] of Object.entries(palette)) {
		blockVersions.add(+block["version"]);
		if(blockUpdater.blockNeedsUpdating(block)) {
			if(await blockUpdater.update(block)) {
				updatedBlocks++;
			}
		}
		block["name"] = block["name"].replace(/^minecraft:/, ""); 
		if(ignoredBlocks.includes(block["name"])) {
			delete palette[i];
			continue;
		}
		delete block["version"];
		if(block["states"] && !Object.keys(block["states"]).length) {
			delete block["states"]; 
		}
	}
	let blockVersionsStringified = [...blockVersions].map(v => BlockUpdater.parseBlockVersion(v).join("."));
	if(updatedBlocks > 0) {
		console.info(`Updated ${updatedBlocks} block${updatedBlocks > 1? "s" : ""} from ${blockVersionsStringified.join(", ")} to ${BlockUpdater.parseBlockVersion(BlockUpdater.LATEST_VERSION).join(".")}!`);
		console.info(`Note: Updated blocks may not be 100% accurate! If there are some errors, try loading the structure in the latest version of Minecraft then saving it again, so all blocks are up to date.`);
	}
	
	let indices = structure["block_indices"].map(layer => structuredClone(layer).map(i => +i));
	let newIndexCache = new JSONMap();
	let entitylessBlockEntityIndices = new Set(); 
	let blockPositionData = structure["palette"]["default"]["block_position_data"];
	for(let i in blockPositionData) {
		let oldPaletteI = indices[0][i];
		if(!(oldPaletteI in palette)) { 
			continue;
		}
		if(!("block_entity_data" in blockPositionData[i])) { 
			continue;
		}
		
		let blockEntityData = structuredClone(blockPositionData[i]["block_entity_data"]);
		if(IGNORED_BLOCK_ENTITIES.includes(blockEntityData["id"])) {
			continue;
		}
		delete blockEntityData["x"];
		delete blockEntityData["y"];
		delete blockEntityData["z"];
		
		let newBlock = structuredClone(palette[oldPaletteI]);
		newBlock["block_entity_data"] = blockEntityData;
		
		if(newIndexCache.has(newBlock)) {
			indices[0][i] = newIndexCache.get(newBlock);
		} else {
			let paletteI = palette.length;
			palette[paletteI] = newBlock;
			indices[0][i] = paletteI;
			newIndexCache.set(newBlock, paletteI);
			entitylessBlockEntityIndices.add(oldPaletteI); 
		}
	}
	for(let paletteI of entitylessBlockEntityIndices) {
		delete palette[paletteI]; 
	}
	
	return { palette, indices };
}
/**
 * Combines multiple block palettes into one, and updates indices for each.
 * @param {Array<{palette: Array<Block>, indices: Array<Array<Number>>}>} palettesAndIndices
 * @returns {{palette: Array<Block>, indices: Array<Array<[Number, Number]>>}}
 */
function mergeMultiplePalettesAndIndices(palettesAndIndices) {
	if(palettesAndIndices.length == 1) {
		return {
			palette: palettesAndIndices[0].palette,
			indices: [palettesAndIndices[0].indices]
		};
	}
	let mergedPaletteSet = new JSONSet();
	let remappedIndices = [];
	palettesAndIndices.forEach(({ palette, indices }) => {
		let indexRemappings = [];
		palette.forEach((block, i) => {
			mergedPaletteSet.add(block);
			indexRemappings[i] = mergedPaletteSet.indexOf(block);
		});
		remappedIndices.push(indices.map(layer => layer.map(i => indexRemappings[i] ?? -1)));
	});
	return {
		palette: [...mergedPaletteSet],
		indices: remappedIndices
	};
}
/**
 * Adds bounding box particles for a single structure to the hologram animation controllers in-place.
 * @param {Record<String, any>} hologramAnimationControllers
 * @param {Number} structureI
 * @param {Vec3} structureSize
 */
function addBoundingBoxParticles(hologramAnimationControllers, structureI, structureSize) {
	let outlineParticleSettings = [
		`v.size = ${structureSize[0] / 2}; v.dir = 0; v.r = 1; v.g = 0; v.b = 0;`,
		`v.size = ${structureSize[1] / 2}; v.dir = 1; v.r = 1 / 255; v.g = 1; v.b = 0;`,
		`v.size = ${structureSize[2] / 2}; v.dir = 2; v.r = 0; v.g = 162 / 255; v.b = 1;`,
		`v.size = ${structureSize[0] / 2}; v.dir = 0; v.y = ${structureSize[1]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[0] / 2}; v.dir = 0; v.z = ${structureSize[2]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[0] / 2}; v.dir = 0; v.y = ${structureSize[1]}; v.z = ${structureSize[2]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[1] / 2}; v.dir = 1; v.x = ${structureSize[0]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[1] / 2}; v.dir = 1; v.z = ${structureSize[2]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[1] / 2}; v.dir = 1; v.x = ${structureSize[0]}; v.z = ${structureSize[2]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[2] / 2}; v.dir = 2; v.x = ${structureSize[0]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[2] / 2}; v.dir = 2; v.y = ${structureSize[1]}; v.r = 1; v.g = 1; v.b = 1;`,
		`v.size = ${structureSize[2] / 2}; v.dir = 2; v.x = ${structureSize[0]}; v.y = ${structureSize[1]}; v.r = 1; v.g = 1; v.b = 1;`
	];
	let boundingBoxAnimation = {
		"particle_effects": [], "transitions": [{ "hidden": `!v.hologram.rendering || v.hologram.structure_index != ${structureI}` }]
	};
	outlineParticleSettings.forEach(particleMolang => {
		boundingBoxAnimation["particle_effects"].push({ "effect": "bounding_box_outline", "locator": "hologram_root", "pre_effect_script": particleMolang.replaceAll(/\s/g, "") });
	});
	let animationStateName = `visible_${structureI}`;
	hologramAnimationControllers["animation_controllers"]["controller.animation.armor_stand.hologram.bounding_box"]["states"][animationStateName] = boundingBoxAnimation;
	hologramAnimationControllers["animation_controllers"]["controller.animation.armor_stand.hologram.bounding_box"]["states"]["hidden"]["transitions"].push({ [animationStateName]: `v.hologram.rendering && v.hologram.structure_index == ${structureI}` });
}
/**
 * Adds block validation particles for a single structure to the hologram animation controllers in-place.
 * @param {Record<String, any>} hologramAnimationControllers
 * @param {Number} structureI
 * @param {Array<Record<String, any>>} blocksToValidate
 * @param {Vec3} structureSize
 */
function addBlockValidationParticles(hologramAnimationControllers, structureI, blocksToValidate, structureSize) {
	let validateAllState = { "particle_effects": [], "transitions": [{ "default": "!v.hologram.validating" }] };
	let validateAllStateName = `validate_${structureI}`;
	let validationStates = hologramAnimationControllers["animation_controllers"]["controller.animation.armor_stand.hologram.block_validation"]["states"];
	validationStates[validateAllStateName] = validateAllState;
	let validateAllStateTransition = { [validateAllStateName]: `v.hologram.validating && v.hologram.structure_index == ${structureI} && v.hologram.layer == -1` };
	validationStates["default"]["transitions"].push(validateAllStateTransition);
	let layersWithBlocksToValidate = [];
	blocksToValidate.forEach(blockToValidate => {
		let [x, y, z] = blockToValidate["pos"];
		let animationStateName = `validate_${structureI}_l_${y}`;
		if(!(animationStateName in validationStates)) {
			let layerAnimationState = { "particle_effects": [], "transitions": [{ "default": "!v.hologram.validating" }, validateAllStateTransition] };
			layersWithBlocksToValidate.forEach(layerY => { layerAnimationState["transitions"].push({ [`validate_${structureI}_l_${layerY}`]: `v.hologram.validating && v.hologram.structure_index == ${structureI} && v.hologram.layer == ${layerY}` }); });
			Object.values(validationStates).forEach(state => { state["transitions"].push({ [animationStateName]: `v.hologram.validating && v.hologram.structure_index == ${structureI} && v.hologram.layer == ${y}` }); });
			validationStates[animationStateName] = layerAnimationState;
			layersWithBlocksToValidate.push(y);
		}
		let particleEffect = { "effect": `hololab:validate_${blockToValidate["block"].replace(":", ".")}`, "locator": blockToValidate["locator"], "pre_effect_script": `v.x = ${x}; v.y = ${y}; v.z = ${z};`.replaceAll(/\s/g, "") };
		validateAllState["particle_effects"].push(particleEffect);
		validationStates[animationStateName]["particle_effects"].push(particleEffect);
	});
	for(let y = 0; y < structureSize[1]; y++) { 
		if(!layersWithBlocksToValidate.includes(y)) {
			Object.entries(validationStates).forEach(([validationStateName, validationState]) => { if(validationStateName.startsWith(`validate_${structureI}`)) { validationState["transitions"][0]["default"] += ` || v.hologram.layer == ${y}`; } });
		}
	}
}

/**
 * Add player controls. These are done entirely in the render controller so character creator skins aren't disabled.
 * @param {HoloPrintConfig} config
 * @param {Record<String, any>} defaultPlayerRenderControllers
 * @returns {Record<String, any>}
 */
function addPlayerControlsToRenderControllers(config, defaultPlayerRenderControllers) {
	let initVariables = functionToMolang(entityScripts.playerInitVariables);
	let renderingControls = functionToMolang(entityScripts.playerRenderingControls, {
		toggleRendering: itemCriteriaToMolang(config.CONTROLS.TOGGLE_RENDERING),
		changeOpacity: itemCriteriaToMolang(config.CONTROLS.CHANGE_OPACITY),
		toggleTint: itemCriteriaToMolang(config.CONTROLS.TOGGLE_TINT),
		toggleValidating: itemCriteriaToMolang(config.CONTROLS.TOGGLE_VALIDATING),
		changeLayer: itemCriteriaToMolang(config.CONTROLS.CHANGE_LAYER),
		decreaseLayer: itemCriteriaToMolang(config.CONTROLS.DECREASE_LAYER),
		changeLayerMode: itemCriteriaToMolang(config.CONTROLS.CHANGE_LAYER_MODE),
		moveHologram: itemCriteriaToMolang(config.CONTROLS.MOVE_HOLOGRAM),
		rotateHologram: itemCriteriaToMolang(config.CONTROLS.ROTATE_HOLOGRAM),
		changeStructure: itemCriteriaToMolang(config.CONTROLS.CHANGE_STRUCTURE),
		backupHologram: itemCriteriaToMolang(config.CONTROLS.BACKUP_HOLOGRAM),
		disablePlayerControls: itemCriteriaToMolang(config.CONTROLS.DISABLE_PLAYER_CONTROLS),
		ACTIONS: entityScripts.ACTIONS
	});
	let broadcastActions = functionToMolang(entityScripts.playerBroadcastActions, {
		backupSlotCount: config.BACKUP_SLOT_COUNT
	});
	return patchRenderControllers(defaultPlayerRenderControllers, {
		"controller.render.player.first_person": functionToMolang(entityScripts.playerFirstPerson, { initVariables, renderingControls, broadcastActions }),
		"controller.render.player.third_person": functionToMolang(entityScripts.playerThirdPerson, { initVariables, renderingControls, broadcastActions })
	});
}
/**
 * Patches a set of render controllers with some extra Molang code. Returns a new set of render controllers.
 * @param {Record<String, any>} renderControllers
 * @param {Record<String, any>} patches
 * @returns {Record<String, any>}
 */
function patchRenderControllers(renderControllers, patches) {
	return {
		"format_version": renderControllers["format_version"],
		"render_controllers": Object.fromEntries(Object.entries(patches).map(([controllerId, patch]) => {
			let controller = renderControllers["render_controllers"][controllerId];
			if(!controller) {
				console.error(`No render controller ${controllerId} found!`, renderControllers);
				return;
			}
			let originalTexture0 = controller["textures"][0];
			patch = patch.replace(/\n|\t/g, "");
			if(originalTexture0.endsWith(";")) {
				patch += originalTexture0;
			} else {
				patch += `return ${originalTexture0};`;
			}
			return [controllerId, {
				...controller,
				"textures": [patch, ...controller["textures"].slice(1)]
			}];
		}).filter(Boolean))
	};
}
/**
 * Translates control items by making a fake material list.
 * @param {HoloPrintConfig} config
 * @param {Record<String, any>} blockMetadata
 * @param {Record<String, any>} itemMetadata
 * @param {Array<String>} languagesDotJson
 * @param {Record<String, String>} fullResourceLangFiles
 * @param {Record<String, Array<String>>} itemTags
 * @returns {Promise<{ inGameControls: Record<String, String>, controlItemTranslations: Record<String, String> }>}
 */
async function translateControlItems(config, blockMetadata, itemMetadata, languagesDotJson, fullResourceLangFiles, itemTags) {
	let controlsMaterialList = await new MaterialList(blockMetadata, itemMetadata);
	let inGameControls = {};
	let controlItemTranslations = {};
	
	await Promise.all(languagesDotJson.map(language => loadTranslationLanguage(language))); 
	
	languagesDotJson.forEach(languageCode => {
		inGameControls[languageCode] = "";
		let translatedControlNames = {};
		let translatedControlItems = {};
		/** @type {Record<String, Set<String>>} */
		let controlItemTranslationKeys = {};
		Object.entries(config.CONTROLS).forEach(([control, itemCriteria]) => {
			controlsMaterialList.clear();
			controlsMaterialList.setLanguage(fullResourceLangFiles[languageCode] || fullResourceLangFiles["en_US"]);
			itemCriteria["names"].forEach(itemName => controlsMaterialList.addItem(itemName));
			
			let itemInfo = controlsMaterialList.export();
			let translatedControlName = translate(PLAYER_CONTROL_NAMES[control], languageCode); 
			translatedControlNames[control] = translatedControlName;
			inGameControls[languageCode] += `\n${translatedControlName}: ${[itemInfo.map(item => `§3${item.translatedName}§r`).join(", "), itemCriteria.tags.map(tag => `§p${tag}§r`).join(", ")].removeFalsies().join("; ")}`;
			
			let itemsInTags = itemCriteria.tags.filter(tag => !tag.includes(":")).map(tag => itemTags?.[`minecraft:${tag}`]).removeFalsies().flat().map(itemName => itemName.replace(/^minecraft:/, ""));
			itemsInTags.forEach(itemName => controlsMaterialList.addItem(itemName));
			controlItemTranslationKeys[control] = new Set();
			controlsMaterialList.export().forEach(({ translationKey, translatedName }) => {
				controlItemTranslationKeys[control].add(translationKey);
				translatedControlItems[translationKey] = translatedName;
			}); 
		});
		controlItemTranslations[languageCode] = "";
		Object.entries(controlItemTranslationKeys).forEach(([control, itemTranslationKeys]) => {
			itemTranslationKeys.forEach(itemTranslationKey => {
				controlItemTranslations[languageCode] += `\n${itemTranslationKey}=${translatedControlItems[itemTranslationKey]}\\n§u${translatedControlNames[control]}§r`; 
			});
		});
	});
	return { inGameControls, controlItemTranslations };
}
/**
 * Makes a blob for pack_icon.png based on a structure file's SHA256 hash (fallback)
 * @param {File} structureFile
 * @returns {Promise<Blob>}
 */
async function makePackIconFallback(structureFile) { 
	let fileHashBytes = [...await sha256(structureFile)]; 
	let fileHashBits = fileHashBytes.map(byte => [7, 6, 5, 4, 3, 2, 1, 0].map(bitI => byte >> bitI & 0x1)).flat();
	
	const ICON_RESOLUTION = [4, 6][fileHashBytes[1] % 2]; 
	const ICON_TILE_SIZE = 200 / ICON_RESOLUTION;
	const MORE_TILE_TYPES = false; 
	
	let can = new OffscreenCanvas(256, 256);
	let ctx = can.getContext("2d");
	
	ctx.lineWidth = 8;
	ctx.lineCap = "round";
	
	let padding = (can.width - ICON_RESOLUTION * ICON_TILE_SIZE) / 2;
	let drawArc = (x, y, startAngle, endAngle) => {
		ctx.beginPath();
		ctx.arc(x * ICON_TILE_SIZE + padding, y * ICON_TILE_SIZE + padding, ICON_TILE_SIZE / 2, startAngle, endAngle);
		ctx.stroke();
	};
	let drawLine = (x, y, w, h) => {
		ctx.beginPath();
		ctx.moveTo(x * ICON_TILE_SIZE + padding, y * ICON_TILE_SIZE + padding);
		ctx.lineTo((x + w) * ICON_TILE_SIZE + padding, (y + h) * ICON_TILE_SIZE + padding);
		ctx.stroke();
	};
	
	for(let x = 0; x < ICON_RESOLUTION; x++) {
		for(let y = 0; y < ICON_RESOLUTION; y++) {
			let i = min(x, ICON_RESOLUTION - 1 - x) * ICON_RESOLUTION + y; 
			i *= 4;
			let bit = fileHashBits[i];
			if(MORE_TILE_TYPES) {
				if(fileHashBits[i] && fileHashBits[i + 1] && fileHashBits[i + 2] && fileHashBits[i + 3]) {
					drawArc(x + 0.5, y + 0.5, 0, pi * 2);
					continue;
				}
				if(!fileHashBits[i] && !fileHashBits[i + 1] && !fileHashBits[i + 2] && !fileHashBits[i + 3]) {
					drawLine(x, y + 0.5, 1, 0);
					drawLine(x + 0.5, y, 0, 1);
					continue;
				}
			}
			if(bit == x >= ICON_RESOLUTION / 2) {
				drawArc(x, y, 0, pi / 2);
				drawArc(x + 1, y + 1, pi, pi * 3 / 2);
			} else {
				drawArc(x + 1, y, pi / 2, pi);
				drawArc(x, y + 1, pi * 3 / 2, pi * 2);
			}
		}
	}
	
	let hue = fileHashBytes[0] / 256 * 360;
	let grad = ctx.createRadialGradient(can.width / 2, can.height / 2, 0, can.width / 2, can.height / 2, ICON_RESOLUTION * ICON_TILE_SIZE / 2 * Math.SQRT2);
	grad.addColorStop(0, `hsl(${hue}deg, 70%, 50%)`);
	grad.addColorStop(1, `hsl(${hue + 20}deg, 60%, 60%)`);
	ctx.globalCompositeOperation = "source-in"; 
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, can.width, can.height);
	
	ctx.globalCompositeOperation = "destination-over"; 
	ctx.fillStyle = `hsl(${hue}deg, 40%, 85%)`;
	ctx.fillRect(0, 0, can.width, can.height);
	
	return await can.convertToBlob();
}
/**
 * Expands item criteria into an array of item names by expanding all item tags.
 * @param {ItemCriteria} itemCriteria
 * @param {Record<String, Array<String>>} itemTags
 * @returns {Array<String>}
 */
function expandItemCriteria(itemCriteria, itemTags) {
    if (!itemTags) return [...itemCriteria.names];
	let minecraftTags = itemCriteria["tags"].filter(tag => !tag.includes(":")); 
	let namespacedItemsFromTags = minecraftTags.map(tag => itemTags[`minecraft:${tag}`]).flat().removeFalsies();
	return [...itemCriteria["names"], ...namespacedItemsFromTags.map(itemName => itemName.replace(/^minecraft:/, ""))];
}
/**
 * Converts an item filter into a Molang expression representation.
 * @param {ItemCriteria} itemCriteria
 * @returns {String}
 */
function itemCriteriaToMolang(itemCriteria, slot = "slot.weapon.mainhand") {
	let names = itemCriteria["names"].map(name => name.includes(":")? name : `minecraft:${name}`);
	let tags = itemCriteria["tags"].map(tag => tag.includes(":")? tag : `minecraft:${tag}`);
	let nameQuery = names.length > 0? `q.is_item_name_any('${slot}',${names.map(name => `'${name}'`).join(",")})` : undefined;
	let tagQuery = tags.length > 0? `q.equipped_item_any_tag('${slot}',${tags.map(tag => `'${tag}'`).join(",")})` : undefined;
	return [nameQuery, tagQuery].removeFalsies().join("||") || "false";
}
/**
 * Creates a Molang expression that mimics array access. Defaults to the last element if nothing is found.
 * @param {Array} array A continuous array
 * @param {String} indexVar
 * @returns {String}
 */
export function arrayToMolang(array, indexVar) {
	let arrayEntries = Object.entries(array); 
	return arrayEntriesToMolang(arrayEntries, indexVar);
}
function arrayEntriesToMolang(entries, indexVar) {
	const splittingThreshold = 50;
	if(entries.length > splittingThreshold) { 
		let middle = floor(entries.length / 2);
		return `${indexVar}<${entries[middle][0]}?(${arrayEntriesToMolang(entries.slice(0, middle), indexVar)}):(${arrayEntriesToMolang(entries.slice(middle), indexVar)})`;
	}
	return entries.map(([index, value], i) => i == entries.length - 1? value : `${i > 0? "(" : ""}${indexVar}==${index}?${value}:`).join("") + ")".repeat(max(entries.length - 2, 0));
}
/**
 * Creates a Molang expression that mimics 2D array access.
 * @param {Array<Array>} array
 * @param {String} indexVar1
 * @param {String} indexVar2
 * @returns {String}
 */
function array2DToMolang(array, indexVar1, indexVar2) {
	return arrayToMolang(array.map(subArray => `(${arrayToMolang(subArray, indexVar2)})`), indexVar1);
}
/**
 * Converts a function into minified Molang code. Variables can be referenced with $[...].
 * @param {Function} func
 * @param {Record<String, any>} [vars]
 * @returns {String} Molang code
 */
function functionToMolang(func, vars = {}) {
	let funcCode = func.toString();
	let minifiedFuncBody = funcCode.slice(funcCode.indexOf("{") + 1, funcCode.lastIndexOf("}")).replaceAll(/\/\/.+/g, "").replaceAll(/(?<!return)\s/g, "");
	let expandedElseIfCode = "";
	for(let i = 0; i < minifiedFuncBody.length; i++) {
		if(minifiedFuncBody.slice(i, i + 7) == "elseif(") {
			expandedElseIfCode += "else{if(";
			let inIfBlock = false;
			let braceCounter = 0;
			i += 6;
			let j = i;
			for(; braceCounter > 0 || !inIfBlock; j++) {
				if(minifiedFuncBody[j] == "{") {
					braceCounter++;
					inIfBlock = true;
				} else if(minifiedFuncBody[j] == "}") {
					braceCounter--;
				}
				if(braceCounter == 0 && inIfBlock && minifiedFuncBody.slice(j, j + 5) == "}else") {
					inIfBlock = false; 
				}
			}
			minifiedFuncBody = minifiedFuncBody.slice(0, j) + "}" + minifiedFuncBody.slice(j);
			continue;
		}
		expandedElseIfCode += minifiedFuncBody[i];
	}
	let mathedCode = expandedElseIfCode.replaceAll(`"`, `'`).replaceAll(/([\w\.]+)(\+|-){2};/g, "$1=$1$21;").replaceAll(/([\w\.]+)--;/g, "$1=$1-1;").replaceAll(/([\w\.\$\[\]]+)(\+|-|\*|\/|\?\?)=([^;]+);/g, "$1=$1$2$3;");
	
	let substituteInVariables = (code, vars) => code.replaceAll(/\$\[(\w+)(?:\[(\d+)\]|\.(\w+))?(?:(\+|-|\*|\/)(\d+))?\]/g, (match, varName, index, key, operator, operand) => {
		if(varName in vars) {
			let value = vars[varName];
			index ??= key;
			if(index != undefined) {
				if(index in value) {
					value = value[index];
				} else {
					throw new RangeError(`Index out of bounds: [${value.join(", ")}][${index}] does not exist`);
				}
			}
			switch(operator) {
				case "+": return +value + +operand; 
				case "-": return value - operand;
				case "*": return value * operand;
				case "/": return value / operand;
				default: return value;
			}
		} else {
			throw new ReferenceError(`Variable "${varName}" was not passed to function -> Molang converter!`);
		}
	});
	let conditionedCode = "";
	let parenthesisCounter = 0;
	let inIfCondition = false;
	let needsExtraBracketAtEndOfIfCondition = false; 
	for(let i = 0; i < mathedCode.length; i++) {
		let char = mathedCode[i];
		if(mathedCode.slice(i, i + 3) == "if(") {
			inIfCondition = true;
			parenthesisCounter++;
			needsExtraBracketAtEndOfIfCondition = /^if\([^()]+\?\?/.test(mathedCode.slice(i)); 
			if(needsExtraBracketAtEndOfIfCondition) {
				conditionedCode += "(";
			}
			i += 2;
			continue;
		} else if(mathedCode.slice(i, i + 4) == "else") {
			conditionedCode = conditionedCode.slice(0, -1) + ":"; 
			i += 3;
			continue;
		} else if(/^for\([^)]+\)/.test(mathedCode.slice(i))) {
			let forStatement = substituteInVariables(mathedCode.slice(i).match(/^for\([^)]+\)/)[0], vars);
			let [, forVarName, initialValue, upperBound] = forStatement.match(/^for\(let(\w+)=(\d+);\w+<(\d+);\w+\+\+\)/);
			let forBlockStartI = mathedCode.slice(i).indexOf("{") + i;
			let forBlockEndI = forBlockStartI + 1;
			let braceCounter = 1;
			while(braceCounter > 0) {
				if(mathedCode[forBlockEndI] == "{") {
					braceCounter++;
				} else if(mathedCode[forBlockEndI] == "}") {
					braceCounter--;
				}
				forBlockEndI++;
			}
			let forBlockContent = mathedCode.slice(forBlockStartI + 1, forBlockEndI - 1);
			let expandedForCode = "";
			for(let forI = +initialValue; forI < upperBound; forI++) {
				expandedForCode += substituteInVariables(forBlockContent, {
					...vars,
					...{
						[forVarName]: forI
					}
				});
			}
			mathedCode = mathedCode.slice(0, i) + expandedForCode + mathedCode.slice(forBlockEndI);
			i--;
			continue;
		} else if(char == "(") {
			parenthesisCounter++;
		} else if(char == ")") {
			parenthesisCounter--;
			if(parenthesisCounter == 0 && inIfCondition) {
				inIfCondition = false;
				if(needsExtraBracketAtEndOfIfCondition) {
					conditionedCode += ")";
				}
				conditionedCode += "?";
				continue;
			}
		} else if(char == "}") {
			conditionedCode += "};";
			continue;
		}
		conditionedCode += char;
	}
	let variabledCode = substituteInVariables(conditionedCode, vars);
	return variabledCode;
}

function stringifyWithFixedDecimals(value) {
	const NUMBER_OF_DECIMALS = 4;
	return JSON.stringify(value, (key, x) => {
		if(typeof x == "number") {
			x = Number(x.toFixed(NUMBER_OF_DECIMALS));
		}
		return x;
	});
}

// Type definitions (HoloPrintConfig, ItemCriteria, Block, etc.)
/** @typedef {Object} HoloPrintConfig ... (omitted for brevity) */
/** @typedef {Object} HoloPrintControlsConfig ... (omitted for brevity) */
/** @typedef {Object} ItemCriteria ... (omitted for brevity) */
/** @typedef {Object} NBTBlock ... (omitted for brevity) */
/** @typedef {Object} Block ... (omitted for brevity) */
/** @typedef {Object} BoneTemplate ... (omitted for brevity) */
/** @typedef {Object} Bone ... (omitted for brevity) */
/** @typedef {Object} TextureReference ... (omitted for brevity) */
/** @typedef {Object} TextureFragment ... (omitted for brevity) */
/** @typedef {Object} ImageFragment ... (omitted for brevity) */
/** @typedef {Object} MaterialListEntry ... (omitted for brevity) */
/** @typedef {Object} TypedBlockStateProperty ... (omitted for brevity) */
/** @typedef {Object} BlockUpdateSchemaFlattenRule ... (omitted for brevity) */
/** @typedef {Object} BlockUpdateSchemaRemappedState ... (omitted for brevity) */
/** @typedef {Object} BlockUpdateSchemaSkeleton ... (omitted for brevity) */
/** @typedef {Object} BlockUpdateSchema ... (omitted for brevity) */
/** @typedef {[Number, Number]} Vec2 */
/** @typedef {[Number, Number, Number]} Vec3 */
// END OF MERGED AND OPTIMIZED HoloPrint.js
