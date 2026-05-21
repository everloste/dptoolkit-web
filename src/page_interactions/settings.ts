import type { CompressionLevel, ExportSettings } from "../types/settings";

export function getExportSettings(): ExportSettings {
	let element = document.getElementById("setting-archive-compression-level") as HTMLInputElement;
	let archive_compression_level = element.valueAsNumber;
	if (Number.isNaN(archive_compression_level)) {
		archive_compression_level = 6;
		console.warn("Could not get setting for archive compression level");
	}

	element = document.getElementById("setting-export-modified-only") as HTMLInputElement;
	const export_modified_only = element.checked;

	element = document.getElementById("setting-combine-packs") as HTMLInputElement;
	const combine = element.checked;

	console.info(
		`Getting export settings...
	Compression level: ${archive_compression_level}
	Export modified only: ${export_modified_only}
	Combine: ${combine}`,
	);

	return {
		compressionLevel: archive_compression_level as CompressionLevel,
		modifiedOnly: export_modified_only,
		combinePacks: combine,
	};
}
