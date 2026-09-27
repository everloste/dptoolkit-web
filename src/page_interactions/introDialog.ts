const CURRENT_INTRO_VERSION = 2;

export function showIntroIfNotShown() {

	const introDialog = document.getElementById("intro-dialog") as HTMLDialogElement;
	const closeIntroButton = introDialog.querySelector("button") as HTMLButtonElement;

	const lastShownVersion = Number.parseInt(localStorage.getItem("dialogVersion") || "-1");

	if (lastShownVersion >= CURRENT_INTRO_VERSION) {
		console.debug(`Intro dialog already shown (version ${lastShownVersion}), skipping.`);
		return;
	}

	closeIntroButton.addEventListener("click", () => {
		localStorage.setItem("dialogVersion", CURRENT_INTRO_VERSION.toString());
		introDialog.close();
	});

	introDialog.showModal();
}
