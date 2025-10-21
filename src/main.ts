import { type Datapack, loadDatapack } from "./datapack";
import { DatapackModifierInstance } from "./datapack_changes";
import { type DatapackStoreEvents, datapackStore } from "./datapackStore";
import { getExportSettings } from "./page_interactions/settings";
import { getStructureSets } from "./structureSet";
import { showIntroIfNotShown } from "./page_interactions/introDialog";
import { suggestAAAColorVariant } from "accessible-colors";

const fileUploadElement = document.getElementById("input")!;
fileUploadElement.addEventListener("change", onFileUploaded, { passive: true });
datapackStore.addEventListener("datapacksChanged", updateDatapackDisplay, { passive: true });

async function onFileUploaded(e: Event) {
	const fileList = (e.target as HTMLInputElement).files;
	if (!fileList) return;
	console.time("Loaded files");
	const acceptedTypes = [
		"application/zip",
		"application/java-archive",
		"application/x-zip-compressed",
	];
	const zipFiles = Array.from(fileList).filter((file) => acceptedTypes.includes(file.type));
	if (zipFiles.length == 0) {
		window.alert("Couldn't add selected files, they may not be datapacks.");
	}
	const datapacks = await Promise.all(zipFiles.map(loadDatapack));
	const validDatapacks = datapacks.filter((dp) => dp instanceof Object);
	
	let datapacksWithoutConfig: Array<string> = [];
	
	validDatapacks.forEach(element => {
		if (element.rawConfig === undefined || Object.keys(element.rawConfig).length === 0) {
			datapacksWithoutConfig.push(element.file_name);
		}
	});

	if (datapacksWithoutConfig.length !== 0) {
		window.alert(`The following packs do not contain a config file: ${datapacksWithoutConfig.toString()}. Try contacting their authors to see if they'd like to add Datapack Toolkit support.`);
	}


	console.timeEnd("Loaded files");

	getStructureSets(validDatapacks);
	datapackStore.add(validDatapacks);
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

function getNameAndDescription(mcmeta: any): { name: string; description: string } {
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
	});

	DatapackModifierInstance.applyChanges(datapackStore.getAll(), export_settings).then(() => {
		// this applies changes and wipes changes
		document.getElementById("progress-indicator")!.hidden = true;
	});
}

////////// start //////////

showIntroIfNotShown();
