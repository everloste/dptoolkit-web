import type JSZip from "jszip";

export function getFiles({
	zip,
	contains,
	excludes,
}: {
	zip: JSZip;
	contains: string;
	excludes?: string;
}) {
	return Object.entries(zip.files).filter(
		([filePath, _]) =>
			filePath.includes(contains) &&
			(!excludes || !filePath.includes(excludes)) &&
			filePath.endsWith(".json"),
	);
}

export function filePathToId(filePath: string, div: string) {
	let [prefix, fileName] = filePath.split(div);
	prefix = prefix.split("/").at(-1) ?? "unknown";
	fileName = fileName.replace(".json", "");

	return `${prefix}:${fileName}`;
}
