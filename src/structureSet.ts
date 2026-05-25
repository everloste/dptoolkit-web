import type JSZip from "jszip";
// import { Modules, type Datapack } from "./datapack";

type Placement = {
	type?: string;
	spread_type?: string;
	salt?: number;
	frequency_reduction_method?: unknown;
	preferred_biomes?: unknown;
	exclusion_zone?: unknown;
	locate_offset?: unknown;
	spacing: number;
	separation: number;
	frequency: number;
};

export class StructureSet {
	id: string;
	modified: boolean;
	type: string;
	placement: Placement;
	originalPlacement: Readonly<Placement>;

	constructor(id: string, originalPlacement: Readonly<Placement>) {
		this.id = id;
		const placement = { ...originalPlacement };

		delete placement.type;
		delete placement.salt;
		delete placement.spread_type;
		delete placement.frequency_reduction_method;
		delete placement.preferred_biomes;
		delete placement.exclusion_zone;
		delete placement.locate_offset;

		this.placement = placement;
		this.originalPlacement = { ...placement };
		this.modified = false;
		this.type = originalPlacement.type!;
	}

	setPlacement(data: Readonly<Placement>) {
		this.placement = {
			...this.placement,
			...data,
		};

		this.modified = true;
	}

	resetPlacement() {
		this.placement = Object.assign({}, this.originalPlacement);
		this.modified = false;
	}
}

// function getStructureDatapacks(datapacks: ReadonlyArray<Datapack>) {
// 	return datapacks.filter((dp) => dp.modules.has(Modules.STRUCTURE_SET));
// }

export async function getStructureSets(zip: JSZip) {
	const divider = "/worldgen/structure_set/";
	const files = Object.entries(zip.files).filter(
		([filePath, _]) => filePath.includes(divider) && filePath.endsWith(".json"),
	);

	const structureNames = new Set(
		files.map(([filePath, _]) => filePathToSetName(filePath, divider)),
	);

	let filtered: [string, JSZip.JSZipObject][] = [];
	structureNames.forEach((set) => {
		filtered = filtered.concat(
			files.filter((file) => {
				const splitSet = set.split(":");
				return file[0].includes(`${splitSet[0]}${divider}${splitSet[1]}.json`);
			}),
		);
	});

	return Promise.all(
		filtered.map(async ([filePath, file]) => {
			const setName = filePathToSetName(filePath, divider);
			return new StructureSet(setName, JSON.parse(await file.async("string")).placement);
		}),
	);
}

function filePathToSetName(filePath: string, div: string) {
	let [prefix, fileName] = filePath.split(div);
	prefix = prefix.split("/").at(-1) ?? "unknown";
	fileName = fileName.replace(".json", "");

	return `${prefix}:${fileName}`;
}

export async function createStructureWidgetsHtml(structures: readonly StructureSet[]) {
	const template = document.getElementById("structure-widget-template") as HTMLTemplateElement;

	const widgets = structures.map((structure, index) => {
		let clone = template.content.cloneNode(true) as DocumentFragment;

		const widgetText = clone.querySelector(".widget-text") as HTMLElement;
		widgetText.innerText = structure.id;

		const spacingElement = clone.getElementById("structure-widget-spacing-x") as HTMLInputElement;
		spacingElement.value = String(structure.placement.spacing);

		const separationElement = clone.getElementById(
			"structure-widget-separation-x",
		) as HTMLInputElement;
		separationElement.value = String(structure.placement.separation);

		const frequencyElement = clone.getElementById(
			"structure-widget-frequency-x",
		) as HTMLInputElement;
		frequencyElement.value = String(structure.placement.frequency);

		if (index !== structures.length - 1) clone.append(document.createElement("hr"));

		return clone;
	});

	return widgets;
}
