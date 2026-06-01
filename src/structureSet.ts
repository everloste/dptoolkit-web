import type JSZip from "jszip";

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
	frequency?: number;
};

export class StructureSet {
	id: string;
	modified: boolean;
	type: string;
	placement: Placement;
	originalPlacement: Readonly<Placement>;
	filePath: string;

	constructor(id: string, filePath: string, originalPlacement: Readonly<Placement>) {
		this.id = id;
		this.filePath = filePath;
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
			return new StructureSet(setName, filePath, JSON.parse(await file.async("string")).placement);
		}),
	);
}

function filePathToSetName(filePath: string, div: string) {
	let [prefix, fileName] = filePath.split(div);
	prefix = prefix.split("/").at(-1) ?? "unknown";
	fileName = fileName.replace(".json", "");

	return `${prefix}:${fileName}`;
}

export async function createStructureWidgetsHtml(structures: StructureSet[], datapackId: string) {
	const template = document.getElementById("structure-widget-template") as HTMLTemplateElement;

	const widgets = structures.map((structure) => {
		let clone = template.content.cloneNode(true) as DocumentFragment;

		const widgetText = clone.querySelector(".widget-text") as HTMLElement;
		widgetText.innerText = structure.id;

		const container = clone.querySelector(".structure-widget")!;
		container.id = `structure-${datapackId}-${structure.id}`;

		const spacingElement = clone.querySelector(".structure-spacing") as HTMLInputElement;
		const separationElement = clone.querySelector(".structure-separation") as HTMLInputElement;
		const frequencyElement = clone.querySelector(".structure-frequency") as HTMLInputElement;

		spacingElement.value = String(structure.placement.spacing);
		separationElement.value = String(structure.placement.separation);
		frequencyElement.value = String(structure.placement.frequency ?? 1);

		const resetButton = clone.getElementById("stucture-reset-x") as HTMLButtonElement;
		resetButton.id = `structure-reset-${datapackId}-${structure.id}`;
		resetButton.addEventListener("click", () => {
			spacingElement.value = String(structure.originalPlacement.spacing);
			separationElement.value = String(structure.originalPlacement.separation);
			frequencyElement.value = String(structure.originalPlacement.frequency ?? 1);
			structure.modified = false;
		});

		function updatePlacement<K extends keyof Placement>(param: K) {
			return (ev: Event) => {
				structure.modified = true;
				const value = Number((ev.target as HTMLInputElement).value);
				structure.placement[param] = value as Placement[K];
			};
		}

		spacingElement.addEventListener("change", updatePlacement("spacing"));
		separationElement.addEventListener("change", updatePlacement("separation"));
		frequencyElement.addEventListener("change", updatePlacement("frequency"));

		// if (index !== structures.length - 1) clone.append(document.createElement("hr"));

		return clone;
	});

	return widgets;
}
