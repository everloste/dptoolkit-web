export function showIntroIfNotShown() {
	const currentIntroVersion = 0;

	const introDialog = document.getElementById("intro-dialog") as HTMLDialogElement;
	const closeIntroButton = introDialog.querySelector("button") as HTMLButtonElement;

	const lastShownVersion = Number.parseInt(localStorage.getItem("dialogVersion") || "-1");

	if (lastShownVersion >= currentIntroVersion) {
		console.debug(`Intro dialog already shown (version ${lastShownVersion}), skipping.`);
		return;
	}

	closeIntroButton.addEventListener("click", () => {
		localStorage.setItem("dialogVersion", currentIntroVersion.toString());
		introDialog.close();
	});

	introDialog.showModal();
}
