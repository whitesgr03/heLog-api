const themeBtn = document.querySelector(".themeBtn");

const handleChangeTheme = () => {
	localStorage.setItem(
		"darkScheme",
		JSON.stringify(document.body.classList.toggle("dark"))
	);
};

themeBtn.addEventListener("click", handleChangeTheme);
