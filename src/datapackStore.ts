import { TypedEventTarget } from "typescript-event-target";

import { type Datapack } from "./datapack";

class DatapacksChangedEvent extends CustomEvent<ReadonlyArray<Datapack>> {
	constructor(datapacks: ReadonlyArray<Datapack>) {
		super("datapacksChanged", { detail: datapacks });
	}
}

export interface DatapackStoreEvents {
	datapacksChanged: DatapacksChangedEvent;
}

class DatapackStore extends TypedEventTarget<DatapackStoreEvents> {
	private datapacks = new Map<string, Datapack>();

	getAll(): ReadonlyArray<Datapack> {
		return Array.from(this.datapacks.values());
	}

	add(dp: Datapack | Datapack[]) {
		let changed = false;

		for (const pack of Array.isArray(dp) ? dp : [dp]) {
			if (!this.datapacks.has(pack.id)) {
				this.datapacks.set(pack.id, pack);
				changed = true;
			}
		}

		if (changed) this.notifyChange();
	}

	remove(dp: string | string[]) {
		let changed = false;

		for (const id of Array.isArray(dp) ? dp : [dp]) {
			if (this.datapacks.delete(id)) {
				changed = true;
			}
		}

		if (changed) this.notifyChange();
	}

	private notifyChange() {
		this.dispatchTypedEvent("datapacksChanged", new DatapacksChangedEvent(this.getAll()));
	}
}

export const datapackStore = new DatapackStore();
