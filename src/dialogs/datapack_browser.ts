import type { ModrinthProject } from "../types/modrinth_api";

const SupportedPacks: ReadonlyArray<string> = ["geophilic", "explorify", "continents"];

async function getSupportedPacks() {
	let a = [];
	console.info("Fetching data from Modrinth...");
	for (const slug of SupportedPacks) {
		const response = await fetch(`https://api.modrinth.com/v2/project/${slug}`);
		let info = (await response.json()) as ModrinthProject;

		const response2 = await fetch(`https://api.modrinth.com/v2/project/${slug}/members`);
		const info2 = (await response2.json()) as Array<{
			user: { username: string; name: string };
		}>;
		info.author = "unknown author";
		if (info2.length != 0) {
			const username = info2[0].user.username;
			info.author = username;
		} else {
			if (info.organization) {
				const response3 = await fetch(
					`https://api.modrinth.com/v3/organization/${info.organization}`,
				);
				const info3 = (await response3.json()) as { name: string };
				info.author = info3.name;
			}
		}
		a.push(info);
	}
	return a;
}

export async function generateDatapackBrowser() {
	const list_widget = document.querySelector(".pack-download-list");
	if (!list_widget) throw new Error();

	const entries: ModrinthProject[] = await getSupportedPacks();
	for (const pack of entries) {
		let temp = document.getElementById("PACK-DOWNLOAD-ITEM-TEMPLATE") as HTMLTemplateElement;
		let html_entry = temp.content.querySelector("label")!.cloneNode(true) as HTMLLabelElement;

		html_entry.id = pack.slug + "-label";
		html_entry.htmlFor = pack.slug + "-download";
		(html_entry.querySelector("img") as HTMLImageElement)!.src = pack.icon_url;
		(html_entry.querySelector(".-name") as HTMLSpanElement)!.innerText = pack.title;
		(html_entry.querySelector(".-author") as HTMLSpanElement)!.innerText = pack.author!;
		(html_entry.querySelector(".-desc") as HTMLSpanElement)!.innerText = pack.description;
		(html_entry.querySelector("input") as HTMLInputElement)!.id = pack.slug + "-download";

		list_widget.appendChild(html_entry);
	}
}
