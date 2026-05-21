export type DatapackChangeValue = string | number | boolean;

export type DatapackChangeMethod =
	| "multiply"
	| "divide"
	| "add"
	| "subtract"
	| "set"
	| "multiply_int"
	| "divide_int"
	| "add_int"
	| "subtract_int"
	| "remove"
	| "pop";

export const DatapackChangeMethods: ReadonlyArray<DatapackChangeMethod> = [
	"multiply",
	"divide",
	"add",
	"subtract",
	"set",
	"multiply_int",
	"divide_int",
	"add_int",
	"subtract_int",
	"remove",
	"pop",
];

export const StringMethods: ReadonlyArray<DatapackChangeMethod> = ["add", "pop", "remove", "set"];

export const NumberMethods: ReadonlyArray<DatapackChangeMethod> = [
	"multiply",
	"divide",
	"add",
	"subtract",
	"set",
	"multiply_int",
	"divide_int",
	"add_int",
	"subtract_int",
	"remove",
	"pop",
];

export const BooleanMethods: ReadonlyArray<DatapackChangeMethod> = ["set"];
