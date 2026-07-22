(function(){
	"use strict";

	const LEGACY_NAME_KEY = "mas9ServerWillingnessPlayerName";
	const LOGIN_MAP_KEY = "mas9ServerWillingnessPlayerNamesByServer";
	const SERVER_KEY = "mas9ServerWillingnessLastServer";
	const ACTION_COOLDOWN_MS = 1800;

	const serverSelect = document.getElementById("serverSelect");
	const nameInput = document.getElementById("nameInput");
	const mainButton = document.getElementById("mainButton");
	const userButton = document.getElementById("userButton");
	const userNameText = userButton.querySelector(".name-text");
	const statusMessage = document.getElementById("statusMessage");
	const playerGrid = document.getElementById("playerGrid");
	const playersSection = document.getElementById("playersSection");
	const serverStatusText = document.getElementById("serverStatusText");
	const summaryText = document.getElementById("summaryText");

	let currentUser = null;
	let currentName = "";
	let currentServerId = localStorage.getItem(SERVER_KEY) || "";
	let loginNamesByServer = loadLoginNames();
	let servers = {};
	let currentServer = null;
	let serverListenerRef = null;
	let serversListenerStarted = false;
	let lastActionAt = 0;

	function loadLoginNames(){
		try{
			const saved = JSON.parse(localStorage.getItem(LOGIN_MAP_KEY) || "{}");
			return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
		}catch(error){
			return {};
		}
	}

	function saveLoginNames(){
		localStorage.setItem(LOGIN_MAP_KEY,JSON.stringify(loginNamesByServer));
	}

	function loadCurrentServerLogin(){
		currentName = currentServerId ? String(loginNamesByServer[currentServerId] || "") : "";
		nameInput.value = currentName;
	}

	function saveCurrentServerLogin(name){
		if(!currentServerId) return;
		if(name){
			loginNamesByServer[currentServerId] = name;
		}else{
			delete loginNamesByServer[currentServerId];
		}
		saveLoginNames();
		currentName = name || "";
	}

	function migrateLegacyLogin(){
		const legacyName = localStorage.getItem(LEGACY_NAME_KEY);
		if(legacyName && currentServerId && !loginNamesByServer[currentServerId]){
			loginNamesByServer[currentServerId] = legacyName;
			saveLoginNames();
		}
		localStorage.removeItem(LEGACY_NAME_KEY);
	}

	function normalizeName(name){
		return name.trim().replace(/\s+/g," ").toLocaleLowerCase("zh-Hant");
	}

	let statusTimer = null;

	function showStatus(message){
		clearTimeout(statusTimer);
		statusMessage.textContent = message;
		statusMessage.classList.remove("fade-out");
		statusMessage.classList.add("show");

		statusTimer = setTimeout(function(){
			statusMessage.classList.add("fade-out");
			setTimeout(function(){
				statusMessage.classList.remove("show","fade-out");
			},400);
		},2200);
	}

	function hideStatus(){
		clearTimeout(statusTimer);
		statusMessage.classList.remove("show","fade-out");
	}

	function canAct(){
		const remaining = ACTION_COOLDOWN_MS - (Date.now() - lastActionAt);
		if(remaining > 0){
			showStatus("操作太快了，請稍候再試。");
			return false;
		}
		lastActionAt = Date.now();
		return true;
	}

	function formatTime(timestamp){
		if(!timestamp) return "尚未確認";
		const days = Math.floor((Date.now() - timestamp) / 86400000);
		if(days <= 0) return "今天";
		if(days === 1) return "昨天";
		return days + " 天前";
	}

	function getPlayerKey(name){
		return normalizeName(name || currentName);
	}

	function getCurrentPlayer(){
		if(!currentName || !currentServer || !currentServer.players) return null;
		return currentServer.players[getPlayerKey()] || null;
	}

	function hasCurrentPlayer(){
		return Boolean(getCurrentPlayer());
	}

	function renderHeader(){
		const loggedIn = currentName.length > 0;
		if(document.activeElement !== nameInput) nameInput.value = currentName;
		nameInput.readOnly = false;
		userNameText.textContent = loggedIn ? "👤 " + currentName : "👤 尚未登入";
		userButton.classList.toggle("logged-in",loggedIn);

		if(!loggedIn){
			mainButton.textContent = "登記 / 讀取";
			mainButton.dataset.action = "join";
		}else if(hasCurrentPlayer()){
			mainButton.textContent = "變更暱稱";
			mainButton.dataset.action = "rename";
		}else{
			mainButton.textContent = "加入這個伺服器";
			mainButton.dataset.action = "join";
		}
	}

	function renderServer(){
		if(!currentServer){
			playersSection.classList.remove("server-closed");
			serverStatusText.textContent = "尚未選擇伺服器";
			summaryText.textContent = "";
			playerGrid.innerHTML = '<div class="empty">目前沒有可顯示的伺服器。</div>';
			renderHeader();
			return;
		}

		const players = Object.entries(currentServer.players || {});
		const activeCount = players.filter((entry) => entry[1].status === "active").length;
		const offline = currentServer.status === "offline";
		playersSection.classList.toggle("server-closed",offline);
		serverStatusText.textContent = offline ? "伺服器目前已關閉🟣" : "伺服器目前開放中🟢";
		summaryText.textContent = players.length
			? activeCount + " 人仍有遊玩需求"
			: "尚無玩家登記";

		const requests = Object.values(currentServer.restartRequests || {});
		const requested = Boolean(
			currentName &&
			currentServer.restartRequests &&
			currentServer.restartRequests[getPlayerKey(currentName)]
		);

		let cardsHtml = "";
		if(!players.length){
			cardsHtml = '<div class="empty">這台伺服器目前還沒有人加入調查。</div>';
		}else{
			cardsHtml = players
				.sort((a,b) => a[1].displayName.localeCompare(b[1].displayName,"zh-Hant"))
				.map(function(entry){
					const playerKey = entry[0];
					const player = entry[1];
					const isMe = Boolean(currentName && playerKey === getPlayerKey(currentName));
					const active = player.status === "active";
					return `
						<article class="player-card ${active ? "" : "inactive"} ${isMe ? "me" : ""}">
							<div class="player-name">${escapeHtml(player.displayName)}${isMe ? "（你）" : ""}</div>
							<div class="player-card-divider"></div>
							<div class="player-state ${active ? "active-text" : "inactive-text"}">
								${active ? "還會繼續玩" : "暫時不玩了"}
							</div>
							<div class="player-meta">最後確認：${formatTime(player.updatedAt)}</div>
							${isMe ? `
								<div class="player-actions">
									<button class="action-btn" type="button" data-action="toggle-status">
										${active ? "我暫時不玩了" : "我又想玩了"}
									</button>
								</div>
							` : ""}
						</article>
					`;
				}).join("");
		}

		playerGrid.innerHTML = cardsHtml;
		const oldOverlay = playersSection.querySelector(".closed-request-overlay");
		if(oldOverlay) oldOverlay.remove();

		if(offline){
			const requestText = requests.length
				? "請求人：" + requests.map((item) => escapeHtml(item.displayName)).join("、")
				: "請求人：";
			const overlay = document.createElement("div");
			overlay.className = "closed-request-overlay";
			overlay.innerHTML = `
				<div class="restart-count">目前有 ${requests.length} 人希望重新開放</div>
				<div class="restart-names">${requestText}</div>
				${hasCurrentPlayer() ? `
					<button id="restartButton" class="action-btn" type="button">
						${requested ? "取消重新啟用請求" : "請求重新啟用伺服器"}
					</button>
				` : `
					<div class="restart-login-note">你尚未加入這台伺服器，無法提出重新開放請求。</div>
				`}
			`;
			playersSection.appendChild(overlay);
			const restartButton = document.getElementById("restartButton");
			if(restartButton) restartButton.addEventListener("click",toggleRestartRequest);
		}

		renderHeader();
	}


	function getServerCreatedTime(serverId, server){
		if(server && Number.isFinite(Number(server.createdAt))){
			return Number(server.createdAt);
		}

		const match = String(serverId).match(/-(\d+)$/);
		return match ? Number(match[1]) : 0;
	}

	function renderServerSelect(){
		const entries = Object.entries(servers).sort((a, b) => {
			return getServerCreatedTime(b[0], b[1]) - getServerCreatedTime(a[0], a[1]);
		});
		serverSelect.innerHTML = entries
			.map((entry) => `<option value="${escapeHtml(entry[0])}">${escapeHtml(entry[1].name)}</option>`)
			.join("");

		if(!entries.length){
			currentServerId = "";
			currentServer = null;
			renderServer();
			return;
		}

		if(!currentServerId || !servers[currentServerId]) currentServerId = entries[0][0];
		serverSelect.value = currentServerId;
		localStorage.setItem(SERVER_KEY,currentServerId);
		migrateLegacyLogin();
		loadCurrentServerLogin();
		subscribeCurrentServer();
	}

	function subscribeCurrentServer(){
		if(serverListenerRef) serverListenerRef.off();
		if(!currentServerId){
			currentServer = null;
			renderServer();
			return;
		}
		serverListenerRef = database.ref(APP_ROOT + "/servers/" + currentServerId);
		serverListenerRef.on("value",function(snapshot){
			currentServer = snapshot.val();
			renderServer();
		},function(error){
			showStatus("讀取伺服器資料失敗：" + error.message);
		});
	}

	async function loginOrJoin(){
		const name = nameInput.value.trim().replace(/\s+/g," ");
		if(!currentUser){
			showStatus("Firebase 身分驗證尚未完成，請稍候。");
			return;
		}
		if(!name){
			showStatus("請先輸入名字。");
			nameInput.focus();
			return;
		}
		if(!currentServerId){
			showStatus("目前沒有可加入的伺服器。");
			return;
		}
		if(!canAct()) return;

		const key = normalizeName(name);
		const playerRef = database.ref(`${APP_ROOT}/servers/${currentServerId}/players/${key}`);

		try{
			const snapshot = await playerRef.once("value");
			const updates = {};
			if(snapshot.exists()){
				updates[`${APP_ROOT}/servers/${currentServerId}/players/${key}/displayName`] = name;
				updates[`${APP_ROOT}/servers/${currentServerId}/players/${key}/ownerUid`] = null;
				updates[`${APP_ROOT}/servers/${currentServerId}/players/${key}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;
				updates[`${APP_ROOT}/servers/${currentServerId}/players/${key}/changedBy`] = "player";
			}else{
				updates[`${APP_ROOT}/servers/${currentServerId}/players/${key}`] = {
					displayName:name,
					status:"active",
					updatedAt:firebase.database.ServerValue.TIMESTAMP,
					changedBy:"player"
				};
			}
			await database.ref().update(updates);
			saveCurrentServerLogin(name);
			renderServer();
			showStatus("已加入／讀取資料。");
		}catch(error){
			showStatus("加入失敗：" + error.message);
		}
	}

	async function renameCurrentPlayer(){
		const newName = nameInput.value.trim().replace(/\s+/g," ");
		if(!currentUser || !currentName){
			loginOrJoin();
			return;
		}
		if(!newName){
			showStatus("名字不能留空。");
			nameInput.focus();
			return;
		}
		if(!currentServerId || !currentServer || !hasCurrentPlayer()){
			showStatus("找不到目前登入者的資料。");
			return;
		}
		if(!canAct()) return;

		const oldName = currentName;
		const oldKey = getPlayerKey(oldName);
		const newKey = getPlayerKey(newName);
		if(newName === oldName){
			showStatus("名字沒有變更。");
			return;
		}

		const oldPlayer = currentServer.players[oldKey];
		const newPlayerRef = database.ref(`${APP_ROOT}/servers/${currentServerId}/players/${newKey}`);

		try{
			const snapshot = await newPlayerRef.once("value");
			if(newKey !== oldKey && snapshot.exists()) throw new Error("這個名字已經有人使用，請換一個名字。");

			const updates = {};
			updates[`${APP_ROOT}/servers/${currentServerId}/players/${oldKey}`] = null;
			updates[`${APP_ROOT}/servers/${currentServerId}/players/${newKey}`] = {
				displayName:newName,
				status:oldPlayer.status || "active",
				updatedAt:firebase.database.ServerValue.TIMESTAMP,
				changedBy:"player"
			};

			const oldRequest = currentServer.restartRequests && currentServer.restartRequests[oldKey];
			if(oldRequest){
				updates[`${APP_ROOT}/servers/${currentServerId}/restartRequests/${oldKey}`] = null;
				updates[`${APP_ROOT}/servers/${currentServerId}/restartRequests/${newKey}`] = {
					displayName:newName,
					requestedAt:firebase.database.ServerValue.TIMESTAMP
				};
			}

			await database.ref().update(updates);
			saveCurrentServerLogin(newName);
			renderServer();
			showStatus("名字已變更。");
		}catch(error){
			showStatus("變更名字失敗：" + error.message);
		}
	}

	function logout(){
		saveCurrentServerLogin("");
		nameInput.value = "";
		renderHeader();
		renderServer();
		showStatus("已從目前伺服器登出。下次輸入同一個名字，就能繼續修改該名字的資料。");
		nameInput.focus();
	}

	async function toggleStatus(){
		if(!currentUser || !currentServerId || !hasCurrentPlayer() || !canAct()) return;
		const key = getPlayerKey();
		const player = currentServer.players[key];
		const nextStatus = player.status === "active" ? "inactive" : "active";
		try{
			await database.ref(`${APP_ROOT}/servers/${currentServerId}/players/${key}`).update({
				status:nextStatus,
				updatedAt:firebase.database.ServerValue.TIMESTAMP,
				changedBy:"player"
			});
		}catch(error){
			showStatus("更新遊玩意願失敗：" + error.message);
		}
	}

	async function toggleRestartRequest(){
		if(!currentUser || !currentServerId){
			showStatus("身分驗證尚未完成。");
			return;
		}
		if(!hasCurrentPlayer()){
			showStatus("你尚未加入這台伺服器，無法提出重新開放請求。");
			return;
		}
		if(!canAct()) return;

		const requestKey = getPlayerKey(currentName);
		const requestRef = database.ref(
			`${APP_ROOT}/servers/${currentServerId}/restartRequests/${requestKey}`
		);
		try{
			const snapshot = await requestRef.once("value");
			if(snapshot.exists()){
				await requestRef.remove();
			}else{
				await requestRef.set({
					displayName:currentName,
					requestedAt:firebase.database.ServerValue.TIMESTAMP
				});
			}
		}catch(error){
			showStatus("更新重新啟用請求失敗：" + error.message);
		}
	}

	function escapeHtml(value){
		return String(value)
			.replaceAll("&","&amp;")
			.replaceAll("<","&lt;")
			.replaceAll(">","&gt;")
			.replaceAll('"',"&quot;")
			.replaceAll("'","&#039;");
	}

	function startDatabaseListeners(){
		if(serversListenerStarted) return;
		serversListenerStarted = true;
		database.ref(APP_ROOT + "/servers").on("value",function(snapshot){
			servers = snapshot.val() || {};
			renderServerSelect();
		},function(error){
			showStatus("讀取伺服器清單失敗：" + error.message);
		});
	}

	mainButton.addEventListener("click",function(){
		hideStatus();
		if(this.dataset.action === "rename") renameCurrentPlayer();
		else loginOrJoin();
	});

	userButton.addEventListener("click",function(){
		if(currentName) logout();
	});

	serverSelect.addEventListener("change",function(){
		currentServerId = this.value;
		localStorage.setItem(SERVER_KEY,currentServerId);
		loadCurrentServerLogin();
		hideStatus();
		subscribeCurrentServer();
	});

	playerGrid.addEventListener("click",function(event){
		const button = event.target.closest('[data-action="toggle-status"]');
		if(button) toggleStatus();
	});

	nameInput.addEventListener("keydown",function(event){
		if(event.key !== "Enter") return;
		hideStatus();
		if(currentName && hasCurrentPlayer()) renameCurrentPlayer();
		else loginOrJoin();
	});

	auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
		.then(() => auth.signInAnonymously())
		.catch(function(error){
			showStatus("匿名登入失敗：" + error.message);
		});

	auth.onAuthStateChanged(function(user){
		if(!user) return;
		currentUser = user;
		startDatabaseListeners();
	});
})();
