import JSZip from "jszip";
import { ConfigClass } from "./config";

export interface Datapack {
	file_name: string;
	id: string;
	name: string | undefined;
	description:
		| string
		| {
				text: string;
				color: string;
		  }[];
	icon: Blob | undefined;
	mcmeta: Record<string, unknown>;
	zip: JSZip;
	rawConfig: undefined | object;
	instancedConfig: undefined | ConfigClass;
	modules: Set<Module>;
}

export const Modules = {
	STRUCTURE_SET: "structure_set",
	BIOME: "biome",
	OVERWORLD: "overworld",
	DPCONFIG: "dpconfig",
} as const;
type Module = (typeof Modules)[keyof typeof Modules];

export async function loadDatapack(file: File): Promise<Datapack | string> {
	const jsZip = new JSZip();
	const zip = await jsZip.loadAsync(file);

	const mcmetaText = await zip.file("pack.mcmeta")?.async("string");
	if (!mcmetaText) {
		return "Could not load pack.mcmeta. Archive is not a datapack!!! >:(";
	}

	let mcmeta;
	try {
		mcmeta = JSON.parse(mcmetaText);
	} catch (error) {
		return "Failed to parse pack.mcmeta";
	}

	const icon = await zip.file("pack.png")?.async("blob");

	const modules = detectModules(zip);

	let config = {};
	if (modules.has(Modules.DPCONFIG)) config = await loadDpConfig(zip);

	let pack_id = mcmeta.pack.id || file.name;
	pack_id = pack_id + Math.round(Math.random() * 100);

	let new_pack: Datapack = {
		file_name: file.name,
		id: pack_id,
		name: mcmeta.pack.name,
		description: mcmeta.pack.description,
		icon: icon,
		mcmeta: mcmeta,
		rawConfig: config,
		instancedConfig: undefined,
		zip: zip,
		modules: modules,
	};

	new_pack.instancedConfig = new ConfigClass(new_pack);
	await writeConfigWidgetsToPage(new_pack.instancedConfig, zip);
	new_pack.instancedConfig.retrieveValuesFromPage();

	console.info(`Created new datapack with ID: ${pack_id}`);

	return new_pack;
}

async function loadDpConfig(datapackZip: JSZip): Promise<Object> {
	let dpConfigText = await datapackZip.file("dpconfig.json")?.async("string");
	if (dpConfigText) return JSON.parse(dpConfigText);

	dpConfigText = await datapackZip.file("dpconfig.yml")?.async("string");
	if (dpConfigText) return loadDpYaml(dpConfigText);

	dpConfigText = await datapackZip.file("dpconfig.yaml")?.async("string");
	if (dpConfigText) return loadDpYaml(dpConfigText);

	return {};
}

async function loadDpYaml(yamlText: string) {
	console.log(yamlText);
	const yaml = await import("js-yaml");

	return yaml.load(yamlText) as any;
}

function detectModules(datapackZip: JSZip): Set<Module> {
	const modules = new Set<Module>();

	const matchers: Record<string, Module> = {
		"/structure_set/": Modules.STRUCTURE_SET,
		"/worldgen/biome/": Modules.BIOME,
		"minecraft/dimension/overworld.json": Modules.OVERWORLD,

		"dpconfig.json": Modules.DPCONFIG,
		"dpconfig.yml": Modules.DPCONFIG,
		"dpconfig.yaml": Modules.DPCONFIG,
	};

	datapackZip.forEach((relativePath, _) => {
		Object.entries(matchers).forEach(([pattern, mod]) => {
			if (relativePath.includes(pattern)) modules.add(mod);
		});
	});

	return modules;
}

async function writeConfigWidgetsToPage(configObject: ConfigClass, zip: JSZip) {
	const widgets: Array<DocumentFragment> = await configObject.createWidgetsHtml(zip);
	const screen = document.getElementById("config-screen")!;
	widgets.forEach((element) => {
		screen.appendChild(element);
	});
}
