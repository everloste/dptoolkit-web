interface Pre82SupportedFormats {
	min_inclusive: number;
	max_inclusive: number;
}

interface TextComponent {
	text: string;
	color: string;
	bold?: boolean;
	italic?: boolean;
	obfuscated?: boolean;
	strikethrough?: boolean;
}

interface PackBase {
	description: PackDescription;
	name?: string;
	id?: string;
}

export type PackDescription = string | TextComponent | (string | TextComponent)[];

type Pre82Format = {
	supported_formats?: number | [number, number] | Pre82SupportedFormats;
};

type Post82Format = {
	min_format: number | [number, number];
	max_format: number | [number, number];
};

export interface Post82MCMeta {
	pack: Post82Format & PackBase;
	filter?: never;
	features?: { enabled: unknown[] };
	overlays?: {
		entries: Post82Format & { directory: string }[];
	};
}

export interface Between82MCMeta {
	pack: Pre82Format & Post82Format & PackBase;
	filter?: never;
	features?: { enabled: unknown[] };
	overlays?: {
		entries: Pre82Format & Post82Format & { directory: string }[];
	};
}

export interface Pre82MCMeta {
	pack: Pre82Format & PackBase & { pack_format: number };
	filter?: never;
	features?: { enabled: unknown[] };
	overlays?: {
		entries: Pre82Format & { directory: string }[];
	};
}

export type MCMeta = Post82MCMeta | Between82MCMeta | Pre82MCMeta;
