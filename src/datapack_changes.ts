import JSZip from "jszip";

import type { Datapack } from "./datapack";
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

export class DatapackModifier {
	private static instance: DatapackModifier;
	private changeQueue: Array<DatapackChange>;
	private changeCache: { [key: string]: string };

	public static get Instance() {
		return this.instance || (this.instance = new this());
	}

	constructor() {
		this.changeQueue = [];
		this.changeCache = {};
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
	public queueChange(
		datapack: Datapack,
		file_path: string,
		value_path: string,
		value: DatapackChangeValue,
		method: DatapackChangeMethod,
	) {
		if (valueMatchesMethod(value, method)) {
			const change: DatapackChange = {
				datapack: datapack,
				file_path: file_path,
				value_path: value_path,
				value: value,
				application_method: method,
			};
			this.changeQueue.push(change);
			console.log(
				`[DatapackModifier] Queued change: \nDatapack: ${change.datapack.id}\nFiles: ${change.file_path}\nValue: ${change.value_path}\nValue: ${change.value}\nMethod: ${change.application_method}`,
			);
		} else {
			console.warn(
				`[DatapackModifier] Datapack change wasn't queued - value ${value} (type <${typeof value}>) doesn't match application method "${method}!"`,
			);
		}
	}

	public async applyChanges(datapacks: ReadonlyArray<Datapack>, export_settings: ExportSettings) {
		console.time("[DatapackModifier] Applied changes to packs");
		let progress = 0;
		let progress_max = Object.keys(this.changeQueue).length;

		const progressIndicator = document.getElementById("progress-indicator-percentage")!;

		// Apply changes to files
		for (const change of this.changeQueue) {
			await this.applyChange(change).then(() => {
				progress++;
				progressIndicator.innerText = Math.round((progress / progress_max) * 100).toString();
			});
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
						const dpZip = datapacks.find((dp) => dp.id === pack_id)?.zip!;
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

				// Finally, write changed file:
				packs[pack_id].file(file_path.split(":")[1], this.changeCache[file_path], {
					binary: false,
				});
			} else throw new Error("what");
		}

		console.timeEnd("[DatapackModifier] Applied changes to packs");

		if (export_settings.combinePacks) {
			await this.saveFile(packs[Object.keys(packs)[0]], export_settings, "Combined Pack.zip");
		} else {
			for (const pack in packs) {
				if (Object.prototype.hasOwnProperty.call(packs, pack)) {
					const zip = packs[pack];
					await this.saveFile(
						zip,
						export_settings,
						datapacks.find((dp) => dp.id === pack)?.file_name!,
					);
				}
			}
		}

		this.wipeCache();
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
		file: string,
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
		console.info("[DatapackModifier] Change cache wiped.");
		console.info("[DatapackModifier] Change queue wiped.");
	}

	// #endregion

	//#region ///// FILE MODIFICATIONS /////

	private async applyChangeToFile(file_name: string, change: DatapackChange) {
		let file_content: string;

		if (this.isInCache(change.datapack.id, file_name)) {
			file_content = this.retrieveFromCache(change.datapack.id, file_name);

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
			console.warn(`File "${file_name}" doesn't exist in "${change.datapack.id}"!`);
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
	if (!(last_key in json)) {
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
