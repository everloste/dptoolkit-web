import { type DatapackChangeMethod, DatapackChangeMethods } from "./modifications.ts";

export interface ConfigDefinition {
	meta: {
		ver: 1 | 2;
		tab: string;
		id?: string;
	};
	widgets: Array<WidgetDefinition>;
	methods: { [key: string]: ConfigMethod };
}

////////// WIDGET OBJECT DEFINITIONS //////////

export type InputWidgetDefinition = NumberWidget | SliderWidget | SwitchWidget;
export type WidgetDefinition =
	| TextWidget
	| ImageWidget
	| NumberWidget
	| SliderWidget
	| SwitchWidget;
export const inputTypes: ReadonlyArray<string> = ["number", "slider", "switch"];

type TextWidget = {
	type: "title" | "heading" | "text";
	text: string;
};

type ImageWidget = {
	type: "image";
	file: string;
	width?: string | number;
	height?: string | number;
};

export type NumberWidget = {
	type: "number";
	text: string;
	method?: string;
	methods?: Array<string>;
	slots?: string | string[];

	value: {
		type: "int" | "percent" | "float";
		default: number;
		range: [number, number];
		step?: number;
		suffix?: string;
		decimals?: number;
	};

	inputted_value: number; // technical, must not be in JSON definition
};

export type SliderWidget = {
	type: "slider";
	text: string;
	method?: string;
	methods?: Array<string>;
	slots?: string | string[];

	value: {
		type: "int" | "percent";
		default: number;
		range: [number, number];
		step?: number;
	};

	inputted_value: number; // technical, must not be in JSON definition
};

export type SwitchWidget = {
	type: "switch";
	text: string;
	method?: string;
	methods?: Array<string>;
	slots?: string | string[];

	value: {
		default: true | false;
	};

	inputted_value: boolean; // technical, must not be in JSON definition
};

// CONFIG METHOD
export type ConfigMethod = {
	value: Transformer;
	accessors: Array<Accessor>;
};
// ACCESSOR
export type Accessor = {
	method: DatapackChangeMethod;
	file_path: string | Array<string>;
	value_path: string;
	value?: Transformer;
};
export const AccessorMethods: ReadonlyArray<string> = DatapackChangeMethods;

// TRANSFORMER
export type Transformer =
	| string
	| number
	| IfElseTransformer
	| MathTransformerWithTwoArgs
	| MathTransformerWithSingleArg;

type MathTransformerWithTwoArgs = {
	function: "add" | "multiply";
	argument: Transformer;
	argument1: Transformer;
};

type MathTransformerWithSingleArg = {
	function: "int" | "square" | "square_root";
	argument: Transformer;
};

type IfElseTransformer = {
	function: "if_else";
	argument: Transformer;
	argument1: Transformer;
	operator: "==" | ">=" | ">";
	true: Transformer;
	false: Transformer;
};
