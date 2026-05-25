import path from "node:path";

import { defineConfig } from "vite";
import handlebars from "vite-plugin-handlebars";

export default defineConfig({
	base: "/dptoolkit-web/",
	plugins: [
		handlebars({
			partialDirectory: path.resolve("./partials"),
		}),
	],
});
