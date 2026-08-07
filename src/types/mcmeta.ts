export interface Pre82SupportedFormats {
	min_inclusive: number;
	max_inclusive: number;
}

export type PackFormat = number | [number] | [number, number];
export type SupportedFormats = number | [number, number] | Pre82SupportedFormats;

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
	supported_formats?: SupportedFormats;
};

type Post82Format = {
	min_format: PackFormat;
	max_format: PackFormat;
};

export type Pre82OverlayEntry = {
	directory: string;
	formats: SupportedFormats;
};

export type Post82OverlayEntry = Post82Format & {
	directory: string;
	formats?: SupportedFormats;
};

export type OverlayEntry = Pre82OverlayEntry | Post82OverlayEntry;

export interface Post82MCMeta {
	pack: Post82Format & PackBase;
	filter?: never;
	features?: { enabled: unknown[] };
	overlays?: {
		entries: Post82OverlayEntry[];
	};
}

export interface Between82MCMeta {
	pack: Pre82Format & Post82Format & PackBase & { pack_format: number };
	filter?: never;
	features?: { enabled: unknown[] };
	overlays?: {
		entries: Post82OverlayEntry[];
	};
}

export interface Pre82MCMeta {
	pack: Pre82Format & PackBase & { pack_format: number };
	filter?: never;
	features?: { enabled: unknown[] };
	overlays?: {
		entries: Pre82OverlayEntry[];
	};
}

export type MCMeta = Post82MCMeta | Between82MCMeta | Pre82MCMeta;
