import JSZip from "jszip";

import { generateRandomString, type Datapack } from "./datapack";
import type {
	Between82MCMeta,
	MCMeta,
	OverlayEntry,
	PackFormat,
	Post82MCMeta,
	Post82OverlayEntry,
	SupportedFormats,
} from "./types/mcmeta";
import {
	BooleanMethods,
	type DatapackChangeMethod,
	type DatapackChangeValue,
	NumberMethods,
	StringMethods,
} from "./types/modifications.ts";
import type { ExportSettings } from "./types/settings";

interface DatapackChange {
	datapack: Datapack;
	file_path: string;
	value_path: string;
	value: DatapackChangeValue;
	application_method: DatapackChangeMethod;
}

interface FileChange {
	datapack: Datapack;
	file_path: string;
}

const LEGACY_PACK_FORMAT_LIMIT = 82;

function getMinSupportedFormat(mcmeta: MCMeta): PackFormat {
	const pack = mcmeta.pack;

	if ("min_format" in pack) return pack.min_format;

	if (pack.supported_formats) {
		if (Array.isArray(pack.supported_formats)) return pack.supported_formats[0];
		else if (
			typeof pack.supported_formats !== "number" &&
			"min_inclusive" in pack.supported_formats
		)
			return pack.supported_formats.min_inclusive;
		else return pack.supported_formats;
	}

	return pack.pack_format;
}

function getMaxSupportedFormat(mcmeta: MCMeta): PackFormat {
	const pack = mcmeta.pack;

	if ("max_format" in pack) return pack.max_format;

	if (pack.supported_formats) {
		if (Array.isArray(pack.supported_formats)) return pack.supported_formats[1];
		else if (
			typeof pack.supported_formats !== "number" &&
			"max_inclusive" in pack.supported_formats
		)
			return pack.supported_formats.max_inclusive;
		else return pack.supported_formats;
	}

	return pack.pack_format;
}

function compareFormats(left: PackFormat, right: PackFormat): number {
	return formatMajor(left) - formatMajor(right);
}

function laterFormat(left: PackFormat, right: PackFormat): PackFormat {
	return compareFormats(left, right) >= 0 ? left : right;
}

function earlierFormat(left: PackFormat, right: PackFormat): PackFormat {
	return compareFormats(left, right) <= 0 ? left : right;
}

function formatMajor(format: PackFormat): number {
	return typeof format === "number" ? format : format[0];
}

function getLegacyBounds(formats: SupportedFormats): {
	min: number;
	max: number;
} {
	if (typeof formats === "number") return { min: formats, max: formats };
	if (Array.isArray(formats)) return { min: formats[0], max: formats[1] };
	return { min: formats.min_inclusive, max: formats.max_inclusive };
}

function getOverlayBounds(entry: OverlayEntry): {
	min: PackFormat;
	max: PackFormat;
} {
	if ("min_format" in entry) return { min: entry.min_format, max: entry.max_format };
	return getLegacyBounds(entry.formats);
}

function toLegacyRange(min: PackFormat, max: PackFormat): SupportedFormats {
	const minMajor = formatMajor(min);
	const maxMajor = formatMajor(max);
	return minMajor === maxMajor ? minMajor : [minMajor, maxMajor];
}

interface CombinedOverlay {
	entry: OverlayEntry;
	sourceDatapack: Datapack;
	targetDirectory: string;
}

export class DatapackModifier {
	private static instance: DatapackModifier;
	private changeQueue: Array<DatapackChange>;
	private disableQueue: Array<FileChange>;
	private changeCache: { [key: string]: string | null };

	public static get Instance() {
		return this.instance || (this.instance = new this());
	}

	constructor() {
		this.changeQueue = [];
		this.disableQueue = [];
		this.changeCache = {};
	}

	public queueDisable(change: FileChange) {
		this.disableQueue.push(change);
	}

	/**
	Queue a change to be made to a specific value in a JSON file (or files) in a datapack.
	This change will only be made when datapacks are exported.
	@param datapack
	@param file_path The path to file (or files) using / as the separator. Use with ./ at the beginning to match one specific file.
	@param value_path The path to the value using / as the separator.
	@param value The value must match the method.
	@param method The method to use when applying the change. Use "set" to overwrite the value.
	*/
	public queueChange(change: DatapackChange) {
		if (!valueMatchesMethod(change.value, change.application_method)) {
			console.warn(
				`[DatapackModifier] Change not queued - value ${change.value} (type <${typeof change.value}>) doesn't match application method "${change.application_method}!"`,
			);
			return;
		}

		this.changeQueue.push(change);
		console.debug(
			`[DatapackModifier] Queued change: \nDatapack: ${change.datapack.id}\nFiles: ${change.file_path}\nValue: ${change.value_path}\nValue: ${change.value}\nMethod: ${change.application_method}`,
		);
	}

	public async applyChanges(datapacks: ReadonlyArray<Datapack>, export_settings: ExportSettings) {
		console.time("[DatapackModifier] Applied changes to packs");
		let progress = 0;
		let progress_max = this.changeQueue.length + this.disableQueue.length;

		const progressIndicator = document.getElementById("progress-indicator-percentage")!;

		// Apply changes to files
		for (const change of this.changeQueue) {
			await this.applyChange(change).then(() => {
				progress++;
				progressIndicator.innerText = Math.round((progress / progress_max) * 100).toString();
			});
		}

		for (const disable of this.disableQueue) {
			await this.applyDisable(disable);

			progress++;
			progressIndicator.innerText = Math.round((progress / progress_max) * 100).toString();
		}

		// Cache with changes created -> write to zip
		let packs: { [key: string]: JSZip } = {};

		for (const file_path in this.changeCache) {
			if (Object.prototype.hasOwnProperty.call(this.changeCache, file_path)) {
				const pack_id = file_path.split(":")[0];

				if (!(pack_id in packs)) {
					// If packs are to combine, create one zip at the beginning of the object and refer all other pointers to it:
					if (export_settings.combinePacks) {
						if (Object.keys(packs).length == 0) packs[pack_id] = new JSZip();
						else packs[pack_id] = packs[Object.keys(packs)[0]];
					}

					// Otherwise just create a new zip:
					else {
						packs[pack_id] = new JSZip();
					}

					// And if we ought to include unmodified files as well, we have to copy them over:
					if (export_settings.modifiedOnly == false) {
						const dpZip = datapacks.find((dp) => dp.id === pack_id)!.zip;
						progress_max += Object.keys(dpZip.files).length;

						for (const file_name in dpZip.files) {
							if (file_name in dpZip.files) {
								const file_content = await dpZip.files[file_name].async("blob");
								progress++;
								progressIndicator.innerText = Math.round(
									(progress / progress_max) * 100,
								).toString();
								packs[pack_id].file(file_name, file_content, { binary: true });
							}
						}
					}
				}

				if (this.changeCache[file_path] === null) continue;
				// Finally, write changed file:
				packs[pack_id].file(file_path.split(":")[1], this.changeCache[file_path], {
					binary: false,
				});
			} else throw new Error("what");
		}

		console.timeEnd("[DatapackModifier] Applied changes to packs");
		const packIds = Object.keys(packs);
		if (packIds.length === 0) {
			console.info("[DatapackModifier] No changed files to export.");
			this.wipeCache();
			return;
		}

		if (export_settings.combinePacks) {
			const combinedPack = packs[packIds[0]];
			const includedDatapacks = datapacks.filter((datapack) => packIds.includes(datapack.id));
			const overlayEntries = await this.copyCombinedOverlays(includedDatapacks, combinedPack);
			combinedPack.file(
				"pack.mcmeta",
				JSON.stringify(this.mergeMcMeta(includedDatapacks, overlayEntries), null, 2),
			);

			await this.saveFile(combinedPack, export_settings, "Combined Pack.zip");
		} else {
			for (const pack in packs) {
				const zip = packs[pack];
				await this.saveFile(
					zip,
					export_settings,
					datapacks.find((dp) => dp.id === pack)!.file_name,
				);
			}
		}

		this.wipeCache();
	}

	private async copyCombinedOverlays(
		datapacks: ReadonlyArray<Datapack>,
		combinedPack: JSZip,
	): Promise<Post82OverlayEntry[]> {
		const overlays: CombinedOverlay[] = [];
		const reservedDirectories = new Set<string>();
		const combinedPaths = Object.keys(combinedPack.files);

		datapacks.forEach((datapack, datapackIndex) => {
			const directories = new Map<string, string>();

			for (const entry of datapack.mcmeta.overlays?.entries ?? []) {
				let targetDirectory = directories.get(entry.directory);
				if (!targetDirectory) {
					const baseDirectory = `combined_${datapackIndex}_${directories.size}`;
					targetDirectory = baseDirectory;
					let suffix = 1;
					while (
						reservedDirectories.has(targetDirectory) ||
						combinedPaths.some(
							(path) => path === targetDirectory || path.startsWith(`${targetDirectory}/`),
						)
					) {
						targetDirectory = `${baseDirectory}_${suffix++}`;
					}

					reservedDirectories.add(targetDirectory);
					directories.set(entry.directory, targetDirectory);
				}

				overlays.push({ entry, sourceDatapack: datapack, targetDirectory });
			}
		});

		const copiedDirectories = new Set<string>();
		for (const { entry, sourceDatapack, targetDirectory } of overlays) {
			const copyKey = `${sourceDatapack.id}:${entry.directory}`;
			if (copiedDirectories.has(copyKey)) continue;

			copiedDirectories.add(copyKey);
			await this.copyOverlayDirectory(
				sourceDatapack,
				entry.directory,
				targetDirectory,
				combinedPack,
			);
		}

		const needsLegacyFormats = overlays.some(
			({ entry }) => formatMajor(getOverlayBounds(entry).min) < LEGACY_PACK_FORMAT_LIMIT,
		);

		return overlays.map(({ entry, targetDirectory }): Post82OverlayEntry => {
			const { min, max } = getOverlayBounds(entry);
			const normalizedEntry: Post82OverlayEntry = {
				directory: targetDirectory,
				min_format: min,
				max_format: max,
			};
			if (needsLegacyFormats) normalizedEntry.formats = toLegacyRange(min, max);
			return normalizedEntry;
		});
	}

	private async copyOverlayDirectory(
		datapack: Datapack,
		sourceDirectory: string,
		targetDirectory: string,
		combinedPack: JSZip,
	) {
		const sourcePrefix = `${sourceDirectory.replace(/\/+$/, "")}/`;
		const targetPrefix = `${targetDirectory}/`;
		const copiedFiles = new Set<string>();

		for (const targetPath of Object.keys(combinedPack.files)) {
			if (targetPath === targetDirectory || targetPath.startsWith(targetPrefix)) {
				combinedPack.remove(targetPath);
			}
		}

		for (const [sourcePath, sourceFile] of Object.entries(datapack.zip.files)) {
			if (sourceFile.dir || !sourcePath.startsWith(sourcePrefix)) continue;

			const relativePath = sourcePath.slice(sourcePrefix.length);
			const cachedPath = this.cacheKey(datapack.id, sourcePath);
			const targetPath = `${targetPrefix}${relativePath}`;
			copiedFiles.add(sourcePath);

			if (Object.prototype.hasOwnProperty.call(this.changeCache, cachedPath)) {
				const changedFile = this.changeCache[cachedPath];
				if (changedFile !== null) combinedPack.file(targetPath, changedFile);
			} else {
				combinedPack.file(targetPath, await sourceFile.async("uint8array"), { binary: true });
			}
		}

		const cachePrefix = this.cacheKey(datapack.id, sourcePrefix);
		for (const [cachedPath, changedFile] of Object.entries(this.changeCache)) {
			if (!cachedPath.startsWith(cachePrefix)) continue;

			const sourcePath = cachedPath.slice(datapack.id.length + 1);
			if (copiedFiles.has(sourcePath) || changedFile === null) continue;

			combinedPack.file(`${targetPrefix}${sourcePath.slice(sourcePrefix.length)}`, changedFile);
		}
	}

	private mergeMcMeta(
		datapacks: ReadonlyArray<Datapack>,
		overlayEntries: ReadonlyArray<Post82OverlayEntry>,
	): MCMeta {
		const packNames = datapacks.map(
			({ mcmeta, file_name }) => mcmeta.pack.name || mcmeta.pack.id || file_name,
		);

		const minSupportedVersion = datapacks
			.map(({ mcmeta }) => getMinSupportedFormat(mcmeta))
			.reduce(laterFormat, 1);
		const maxSupportedVersion = datapacks
			.map(({ mcmeta }) => getMaxSupportedFormat(mcmeta))
			.reduce(earlierFormat);
		const supportsLegacyFormats = formatMajor(minSupportedVersion) < LEGACY_PACK_FORMAT_LIMIT;
		const baseMcMeta = {
			pack: {
				name: "Combined pack",
				id: `combined-${generateRandomString()}`,
				description: packNames.join(", "),
				min_format: minSupportedVersion,
				max_format: maxSupportedVersion,
			},
			...(overlayEntries.length > 0 ? { overlays: { entries: [...overlayEntries] } } : {}),
		};

		if (!supportsLegacyFormats) return baseMcMeta satisfies Post82MCMeta;

		const combinedMcMeta: Between82MCMeta = {
			...baseMcMeta,
			pack: {
				...baseMcMeta.pack,
				pack_format: formatMajor(minSupportedVersion),
				supported_formats: [formatMajor(minSupportedVersion), formatMajor(maxSupportedVersion)],
			},
		};
		return combinedMcMeta;
	}

	public async saveFile(zip: JSZip, export_settings: ExportSettings, file_name: string) {
		console.info(`[DatapackModifier] Saving file... [${zip.name}]`);
		await zip
			.generateAsync({
				type: "blob",
				compression: export_settings.compressionLevel == 0 ? "STORE" : "DEFLATE",
				compressionOptions: {
					level: export_settings.compressionLevel,
				},
			})
			.then((content) => {
				var link = document.createElement("a"),
					url = URL.createObjectURL(content);
				link.href = url;
				link.download = `Modded copy of ${file_name}`;
				link.hidden = true;
				document.body.appendChild(link);
				link.click();
				setTimeout(function () {
					document.body.removeChild(link);
					window.URL.revokeObjectURL(url);
				}, 0);
			});
	}

	//#region ///// FILE CACHE MANIPULATION /////

	private cacheKey(datapack_id: string, file_path: string): string {
		return `${datapack_id}:${file_path}`;
	}

	private addToCache(
		datapack_id: string,
		file_path: string,
		file: string | null,
		overwrite: boolean = false,
	) {
		if (overwrite == true) {
			this.changeCache[this.cacheKey(datapack_id, file_path)] = file;
		} else {
			if (this.isInCache(datapack_id, file_path)) {
				throw new Error("Trying to overwrite a file in cache without overwrite permission");
			} else {
				this.changeCache[this.cacheKey(datapack_id, file_path)] = file;
			}
		}
	}

	private isInCache(datapack_id: string, file_path: string) {
		if (this.cacheKey(datapack_id, file_path) in this.changeCache) {
			return true;
		}
		return false;
	}

	private retrieveFromCache(datapack_id: string, file_path: string) {
		if (this.cacheKey(datapack_id, file_path) in this.changeCache) {
			return this.changeCache[this.cacheKey(datapack_id, file_path)];
		}
		throw new Error("Trying to retrieve a file from cache that isn't there");
	}

	private wipeCache() {
		this.changeCache = {};
		this.changeQueue = [];
		this.disableQueue = [];
		console.info("[DatapackModifier] Change cache wiped.");
	}

	// #endregion

	//#region ///// FILE MODIFICATIONS /////

	private async applyChangeToFile(file_name: string, change: DatapackChange) {
		let file_content: string | null;

		if (this.isInCache(change.datapack.id, file_name)) {
			file_content = this.retrieveFromCache(change.datapack.id, file_name);
			if (file_content === null) return;

			let parsed = JSON.parse(file_content);

			applyToValue(parsed, change.value_path, change.value, change.application_method);

			const modified_content = JSON.stringify(parsed, null, 2);

			this.addToCache(change.datapack.id, file_name, modified_content, true);
		} else if (file_name in change.datapack.zip.files) {
			file_content = await change.datapack.zip.files[file_name].async("text");

			let parsed = JSON.parse(file_content);

			applyToValue(parsed, change.value_path, change.value, change.application_method);

			const modified_content = JSON.stringify(parsed, null, 2);

			this.addToCache(change.datapack.id, file_name, modified_content);
		} else {
			console.error(`File "${file_name}" doesn't exist in "${change.datapack.id}"!`);
		}
	}

	private async applyChange(change: DatapackChange) {
		if (change.file_path.startsWith("./")) {
			const file_name = change.file_path.slice(2);
			await this.applyChangeToFile(file_name, change);
		} else {
			const files_in_pack: string[] = Object.keys(change.datapack.zip.files);

			for (const file_name of files_in_pack) {
				if (file_name.endsWith(change.file_path)) {
					await this.applyChangeToFile(file_name, change);
				}
			}
		}
	}

	private async applyDisable(change: FileChange) {
		const filesInPack: string[] = Object.keys(change.datapack.zip.files);
		for (const fileName of filesInPack) {
			if (fileName.endsWith(change.file_path)) {
				await this.rename(change.datapack.zip, fileName, `${fileName}.disabled`);
				this.addToCache(change.datapack.id, fileName, null);
			}
		}
	}

	private async rename(zip: JSZip, from: string, to: string) {
		const old = zip.file(from)!;

		const content = await old.async("uint8array");
		zip.remove(old.name);
		zip.file(to, content);
	}
	// #endregion
}

export const DatapackModifierInstance = DatapackModifier.Instance;

function valueMatchesMethod(value: DatapackChangeValue, method: DatapackChangeMethod) {
	if (typeof value === "string" && !StringMethods.includes(method)) {
		return false;
	} else if (typeof value === "number" && !NumberMethods.includes(method)) {
		return false;
	} else if (typeof value === "boolean" && !BooleanMethods.includes(method)) {
		return false;
	}
	return true;
}

function applyToValue(
	json: { [key: string]: any },
	value_path: string,
	value: DatapackChangeValue,
	method: DatapackChangeMethod,
) {
	const keys = value_path.split("/");
	const error = new Error(`${value_path} doesn't exist in JSON object!`);

	for (let index = 0; index < keys.length - 1; index++) {
		const key = keys[index];
		if (key in json) {
			json = json[key];
		} else {
			throw error;
		}
	}
	const last_key = keys[keys.length - 1];
	if (!(last_key in json) && method !== "set") {
		throw error;
	} else {
		const original_value = json[last_key];
		switch (method) {
			case "set":
				json[last_key] = value;
				break;

			case "add":
				json[last_key] = original_value + value;
				break;
			case "add_int":
				json[last_key] = Math.round(original_value + (value as number));
				break;

			case "subtract":
				json[last_key] = original_value - (value as number);
				break;
			case "subtract_int":
				json[last_key] = Math.round(original_value - (value as number));
				break;

			case "multiply":
				json[last_key] = original_value * (value as number);
				break;
			case "multiply_int":
				json[last_key] = Math.round(original_value * (value as number));
				break;

			case "divide":
				json[last_key] = original_value / (value as number);
				break;
			case "divide_int":
				json[last_key] = Math.round(original_value / (value as number));
				break;

			case "pop":
				let arr = json[last_key] as Array<any>;
				value = typeof value === "string" ? parseInt(value) : (value as number);
				arr.splice(value, 1);
				json[last_key] = arr;
				break;

			case "remove":
				let a = json[last_key] as Array<any>;
				a = a.filter((element) => element != value);
				json[last_key] = a;
				break;

			default:
				break;
		}
	}
}
