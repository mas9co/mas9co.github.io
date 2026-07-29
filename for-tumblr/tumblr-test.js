(() => {
	"use strict";

	const message = document.createElement("div");

	message.textContent = "GitHub JS 載入成功 ✓";

	Object.assign(message.style, {
		position: "fixed",
		right: "20px",
		bottom: "20px",
		zIndex: "999999",
		padding: "12px 18px",
		borderRadius: "12px",
		background: "rgba(35, 45, 60, 0.92)",
		color: "#ffffff",
		fontFamily: "sans-serif",
		fontSize: "14px",
		boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)"
	});

	document.body.appendChild(message);

	console.log("[Tumblr 測試] 外部 JavaScript 已成功載入。");
})();
