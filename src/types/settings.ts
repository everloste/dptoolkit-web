export type ExportSettings = {
	compressionLevel: CompressionLevel;
	modifiedOnly: boolean;
	combinePacks: boolean;
};

export type CompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
