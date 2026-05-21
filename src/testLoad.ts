import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { basename, resolve } from "node:path";

registerHooks({
	resolve(specifier, context, nextResolve) {
		try {
			return nextResolve(specifier, context);
		} catch (error) {
			return nextResolve(`${specifier}.ts`, context);
		}
	},
});

domShim();

const { loadDatapack } = await import("./datapack.ts");

async function main() {
	const paths = process.argv.slice(2);

	if (paths.length === 0) {
		console.error("no files :(\nuse: node src/test.ts <datapack.zip> [...more.zip]");
		process.exitCode = 1;
		return;
	}

	const files = await Promise.all(paths.map(fileFromPath));

	if (files.length === 0) {
		console.error("no files :(");
		process.exitCode = 1;
		return;
	}

	const datapacks = (await Promise.all(files.map(loadDatapack)))
		.map((datapack) => {
			if (typeof datapack === "string") console.error(datapack);
			return datapack;
		})
		.filter((datapack) => typeof datapack !== "string");

	// console.log(datapacks);
}

async function fileFromPath(path: string): Promise<File> {
	const absolutePath = resolve(path);
	const buffer = await readFile(absolutePath);

	Object.defineProperties(buffer, {
		name: { value: basename(absolutePath) },
		type: { value: mimeTypeForPath(absolutePath) },
	});

	return buffer as unknown as File;
}

function mimeTypeForPath(path: string) {
	if (path.endsWith(".jar")) return "application/java-archive";
	if (path.endsWith(".zip")) return "application/zip";
	return "application/octet-stream";
}

function domShim() {
	if ("document" in globalThis) return;

	const mock = {
		appendChild() {},
	};

	Object.defineProperty(globalThis, "document", {
		value: {
			getElementById(_: string) {
				return mock;
			},
		},
		configurable: true,
	});
}

main();
