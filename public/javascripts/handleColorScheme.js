const setDarkScheme = () => {
	const darkScheme =
		window.matchMedia("(prefers-color-scheme: dark)")?.matches ?? false;
	localStorage.setItem("darkScheme", JSON.stringify(darkScheme));
	return darkScheme;
};

(JSON.parse(localStorage.getItem("darkScheme")) ?? setDarkScheme()) &&
	document.body.classList.add("dark");
