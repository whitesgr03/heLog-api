const antiClickjack = document.getElementById("antiClickjack");
self === top
	? antiClickjack.parentNode.removeChild(antiClickjack)
	: (top.location = self.location);
