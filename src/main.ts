import { suggestAAAColorVariant } from "accessible-colors";

import { type Datapack, loadDatapack, Modules } from "./datapack";
import { DatapackModifierInstance } from "./datapack_changes";
import { type DatapackStoreEvents, datapackStore } from "./datapackStore";
import { showIntroIfNotShown } from "./page_interactions/introDialog";
import { getExportSettings } from "./page_interactions/settings";

const fileUploadElement = document.getElementById("input")!;
fileUploadElement.addEventListener("change", onFileUploaded, { passive: true });
datapackStore.addEventListener("datapacksChanged", updateDatapackDisplay, { passive: true });

async function onFileUploaded(e: Event) {
	const fileList = (e.target as HTMLInputElement).files;
	if (!fileList) return;
	const acceptedTypes = [
		"application/zip",
		"application/java-archive",
		"application/x-zip-compressed",
	];
	const zipFiles = Array.from(fileList).filter((file) => acceptedTypes.includes(file.type));
	if (zipFiles.length == 0) {
		window.alert("Couldn't add selected files, they may not be datapacks.");
	}

	// load datapacks as objects
	const datapacks = await Promise.all(zipFiles.map(loadDatapack));
	const validDatapacks = datapacks.filter((dp) => dp instanceof Object);

	// detect loaded packs that do not have a config file
	let datapacksWithoutConfig: Array<string> = [];
	validDatapacks.forEach((element) => {
		if (element.rawConfig === undefined || Object.keys(element.rawConfig).length === 0) {
			datapacksWithoutConfig.push(element.file_name);
		}
	});

	if (
		!validDatapacks.every(
			(dp) => dp.modules.has(Modules.STRUCTURE_SET) || dp.modules.has(Modules.DPCONFIG),
		)
	) {
		window.alert(
			`The following packs do not contain a config file or do not yet have a supportable configuration:
${datapacksWithoutConfig.join("\n")}

Try contacting their authors to see if they'd like to add Datapack Toolkit support.`,
		);
	}

	// add packs to store and finalise there
	datapackStore.add(validDatapacks);

	const anyHasDpConfig = validDatapacks.some((dp) => dp.modules.has(Modules.DPCONFIG));
	const anyHasStructure = validDatapacks.some((dp) => dp.modules.has(Modules.STRUCTURE_SET));

	if (anyHasDpConfig) {
		navigate.call(document.getElementById("config-link")!);
	} else if (anyHasStructure) {
		navigate.call(document.getElementById("structure-link")!);
	}
}

function updateDatapackDisplay(event: DatapackStoreEvents["datapacksChanged"]) {
	const { detail } = event;
	const dpDisplayElement = detail.map(createDatapackDisplayElement);

	const datapackDisplay = document.getElementById("datapack-display")!;
	datapackDisplay.innerHTML = "";
	dpDisplayElement.forEach((element) => {
		datapackDisplay.appendChild(element);
	});
}

function createDatapackDisplayElement(dp: Datapack): DocumentFragment {
	const template = document.getElementById("datapack-template") as HTMLTemplateElement;
	const clone = template.content.cloneNode(true) as DocumentFragment;

	const { name, description } = getNameAndDescription(dp.mcmeta);

	(clone.querySelector(".name") as HTMLElement).innerHTML = name;
	(clone.querySelector(".description") as HTMLElement).innerHTML = description;

	if (dp.icon) {
		(clone.querySelector("img") as HTMLImageElement).src = URL.createObjectURL(dp.icon);
	}

	return clone;
}

function getNameAndDescription(mcmeta: any): {
	name: string;
	description: string;
} {
	let name = mcmeta.pack.name;
	let description = descriptionToDisplayable(mcmeta.pack.description);

	if (!name) {
		const splitDescription = description.split("<br>");
		name = splitDescription[0];
		description = splitDescription.slice(1).join("<br>");
	} else {
		name = sanitizeHtml(name);
	}

	// strip colour codes from the name, both easier and more readable
	name = name.replace(/§./g, "");

	if (!description) description = "";

	return { name, description };
}

function descriptionToDisplayable(description: Datapack["description"]): string {
	if (Array.isArray(description)) {
		const backgroundColor = document.getElementById("datapack-display")!.style.backgroundColor;
		return description
			.map((desc) => ({
				text: sanitizeHtml(desc.text),
				color: suggestAAAColorVariant(desc.color, backgroundColor),
			}))
			.map((desc) => `<span style="color: ${desc.color}">${desc.text}</span>`)
			.join("");
	} else return description.replace("\n", "<br>");
}

function sanitizeHtml(unsafe: string): string {
	const div = document.createElement("div");
	div.innerText = unsafe;
	return div.innerHTML;
}

////////// NAVIGATION //////////

const screens = {
	Config: document.getElementById("config-screen")!,
	"Structure sets": document.getElementById("structures-screen")!,
	"Biome providers": document.getElementById("biomes-screen")!,
	"Loot tables": document.getElementById("loot-screen")!,
};

function navigate(this: HTMLElement, _?: MouseEvent) {
	const element = this.id.split("-")[0];

	Object.entries(screens).forEach(([screenName, screen]) => {
		if (screen.id.startsWith(element)) {
			document.getElementById("screen-name")!.innerText = screenName;
			screen.classList.remove("hidden");
		} else screen.classList.add("hidden");
	});
}

document.getElementById("config-link")?.addEventListener("mousedown", navigate);
document.getElementById("structure-link")?.addEventListener("mousedown", navigate);
document.getElementById("biome-link")?.addEventListener("mousedown", navigate);
document.getElementById("loot-link")?.addEventListener("mousedown", navigate);

////////// EXPORT SETTINGS //////////
const collapsibles = document.getElementsByClassName("collapsible-button");

for (const collapsible of collapsibles) {
	(collapsible as HTMLButtonElement).addEventListener("click", () => {
		collapsible.classList.toggle("toggled");

		var content = collapsible.nextElementSibling;
		if (content != null) {
			if ((content as HTMLDivElement).style.display === "block")
				(content as HTMLDivElement).style.display = "none";
			else (content as HTMLDivElement).style.display = "block";
		}
	});
}

////////// EXPORT BUTTON //////////
const exportButtonElement = document.getElementById("export-button")!;
exportButtonElement.addEventListener("click", exportButtonClicked, { passive: true });

function exportButtonClicked() {
	console.info("Datapack export beginning...");
	document.getElementById("progress-indicator")!.hidden = false;

	const export_settings = getExportSettings();

	datapackStore.getAll().forEach((datapack) => {
		datapack.instancedConfig?.apply(); // this queues changes

		for (const structure of datapack.structureSets) {
			if (!structure.modified) continue;

			DatapackModifierInstance.queueChange(
				datapack,
				structure.filePath,
				"placement/separation",
				structure.placement.separation,
				"set",
			);

			DatapackModifierInstance.queueChange(
				datapack,
				structure.filePath,
				"placement/spacing",
				structure.placement.spacing,
				"set",
			);

			DatapackModifierInstance.queueChange(
				datapack,
				structure.filePath,
				"placement/frequency",
				structure.placement.frequency ?? 1,
				"set",
			);
		}
	});

	DatapackModifierInstance.applyChanges(datapackStore.getAll(), export_settings).then(() => {
		// this applies changes and wipes changes
		document.getElementById("progress-indicator")!.hidden = true;
	});
}

////////// start //////////

showIntroIfNotShown();
