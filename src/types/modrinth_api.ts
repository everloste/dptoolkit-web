export type ModrinthProject = {
	slug: string;
	title: string;
	description: string;
	icon_url: string;
	categories: Array<string>;
	author?: string; // this is not returned by modrinth but is added later by the script
	organization?: string;
};
