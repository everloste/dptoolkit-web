import type JSZip from "jszip";

import { filePathToId, getFiles } from "./common";

export interface Biome {
	packIds: string[];
	packLabels: string[];
	preference: string | null;
	changed: boolean;
}

export function getBiomes(
	zip: JSZip,
	packId: string,
	packLabel: string,
	out: Record<string, Biome>,
) {
	const divider = "/worldgen/biome/";

	const files = getFiles({ zip, contains: divider, excludes: "/tags/" });
	const biomeNames = new Set(files.map(([filePath, _]) => filePathToId(filePath, divider)));

	biomeNames.forEach((biome) => {
		if (out[biome]) {
			out[biome].packIds.push(packId);
			out[biome].packLabels.push(packLabel);
		} else
			out[biome] = {
				packIds: [packId],
				packLabels: [packLabel],
				preference: null,
				changed: false,
			};
	});
}

export async function createBiomeWidgetsHtml(biomes: Record<string, Biome>) {
	const template = document.getElementById("biome-widget-template") as HTMLTemplateElement;

	const loadOrder = "Load order";

	const widgets = Object.entries(biomes).map(([biomeId, biome]) => {
		const clone = template.content.cloneNode(true) as DocumentFragment;
		const biomeNameLabel = clone.querySelector("h3") as HTMLHeadingElement;
		const biomeName = biomeId.split(":")[1].replaceAll("_", " ");
		biomeNameLabel.textContent = biomeName;

		const biomeIdLabel = clone.querySelector("p") as HTMLParagraphElement;
		biomeIdLabel.textContent = biomeId;

		const selector = clone.querySelector("select") as HTMLSelectElement;
		selector.replaceChildren(
			new Option(loadOrder, loadOrder, biome.preference === null),
			new Option("Vanilla", "Vanilla"),
			...biome.packIds.map(
				(packId, index) => new Option(biome.packLabels[index], packId, packId === biome.preference),
			),
		);

		selector.addEventListener("change", (ev) => {
			const value = (ev.target as HTMLSelectElement).value;
			if (value === loadOrder) {
				biome.changed = false;
				biome.preference = null;
			} else {
				biome.preference = value;
				biome.changed = true;
			}
		});

		return clone;
	});

	return widgets;
}
