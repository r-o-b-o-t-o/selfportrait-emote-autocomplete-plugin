//META{"name":"SelfportraitEmoteAutocomplete","website":"http://roboto.space/gogs/roboto/selfportrait-emote-autocomplete-plugin","source":"http://roboto.space/gogs/roboto/selfportrait-emote-autocomplete-plugin/raw/master/SelfportraitEmoteAutocomplete.plugin.js"}*//

function pluginNameLabel(plugin) {
	return `
		<style>
			#bd-settingspane-container *::-webkit-scrollbar {
				max-width: 10px;
			}

			#bd-settingspane-container *::-webkit-scrollbar-track-piece {
				background: transparent;
				border: none;
				border-radius: 5px;
			}

			#bd-settingspane-container *:hover::-webkit-scrollbar-track-piece {
				background: #2F3136;
				border-radius: 5px;
			}

			#bd-settingspane-container *::-webkit-scrollbar-thumb {
				background: #1E2124;
				border: none;
				border-radius: 5px;
			}

			#bd-settingspane-container *::-webkit-scrollbar-button {
				display: none;
			}
		</style>
		<h style="color: white;font-size: 24px;font-weight: bold;">${plugin.getName().replace(/([A-Z])/g, ' $1').trim()} by ${plugin.getAuthor()}</h>`;
}

class SelfportraitEmoteAutocomplete {
	getName() { return "SelfportraitEmoteAutocomplete"; }
	getDescription() { return "Adds an auto-complete menu for Selfportrait emotes."; }
	getVersion() { return "1.0.0"; }
	getAuthor() { return "Roboto#9185"; }
	getChanges() {
		return {};
	}

	load() {}

	start() {
		let libLoadedEvent = () => {
			try {
				this.onLibLoaded();
			} catch(err) {
				console.error(this.getName(), "Fatal error, plugin could not be started!", err);
			}
		};

		let lib = document.getElementById("NeatoBurritoLibrary");
		if (lib == undefined) {
			lib = document.createElement("script");
			lib.setAttribute("id", "NeatoBurritoLibrary");
			lib.setAttribute("type", "text/javascript");
			lib.setAttribute("src", "https://rawgit.com/Metalloriff/BetterDiscordPlugins/master/Lib/NeatoBurritoLibrary.js");
			document.head.appendChild(lib);
		}
		if (typeof window.NeatoLib !== "undefined") {
			libLoadedEvent();
		} else {
			lib.addEventListener("load", libLoadedEvent);
		}
	}

	getSettingsPanel() {
		setTimeout(() => {
			NeatoLib.Settings.pushElement(NeatoLib.Settings.Elements.createTextField("Library URL", "text", this.settings.url, e => {
				this.settings.url = e.target.value;
				this.saveSettings();
			}, { tooltip : "The URL used to fetch preview images." }), this.getName());

			NeatoLib.Settings.pushElement(NeatoLib.Settings.Elements.createTextField("Emotes prefix", "text", this.settings.prefix, e => {
				this.settings.prefix = e.target.value;
				this.saveSettings();
			}, { tooltip : "The character you put before your Selfportrait emotes' names." }), this.getName());

			NeatoLib.Settings.pushElement(NeatoLib.Settings.Elements.createTextField("Auto-complete emote size", "number", this.settings.size, e => {
				this.settings.size = e.target.value;
				this.saveSettings();
			}, { tooltip : "The size in pixels to display the auto-complete emotes." }), this.getName());

			NeatoLib.Settings.pushElement(NeatoLib.Settings.Elements.createTextField("Auto-complete results limit", "number", this.settings.resultsCap, e => {
				this.settings.resultsCap = e.target.value;
				this.saveSettings();
			}, { tooltip : "Maximum amount of results to display. The higher this is, the slower larger results will be." }), this.getName());

			NeatoLib.Settings.pushElement(NeatoLib.Settings.Elements.createToggleSwitch("Validate selected emote with Enter/Return", this.settings.validateWithReturn, () => {
				this.settings.validateWithReturn = !this.settings.validateWithReturn;
				this.saveSettings();
			}), this.getName());

			// NeatoLib.Settings.pushChangelogElements(this);
		}, 0);

		return pluginNameLabel(this);
	}

	saveSettings() {
		NeatoLib.Settings.save(this);
	}
	
	updateSelected() {
		let items = document.getElementById("spea-autocomplete-list").getElementsByClassName("selector-2IcQBU selectable-3dP3y-");

		for (let i = 0; i < items.length; i++) {
			if (i == this.selectedIndex) {
				items[i].classList.add("selectorSelected-1_M1WV");
			} else {
				items[i].classList.remove("selectorSelected-1_M1WV");
			}
		}
	}

	onLibLoaded() {
		NeatoLib.Updates.check(this);

		this.settings = NeatoLib.Settings.load(this, {
			"displayUpdateNotes" : true,
			"url": "http://127.0.0.1:35066",
			"prefix" : ">",
			"size" : 24,
			"resultsCap" : 10,
			"validateWithReturn": true
		});

		/*if (this.settings.displayUpdateNotes) {
			NeatoLib.Changelog.compareVersions(this.getName(), this.getChanges());
		}*/

		this.selectedIndex = 0;
		this.results = [];

		this.onGlobalKey = e => {
			let validate = false;
			let enter = false;
			if (this.settings.validateWithReturn && e.key == "Enter") {
				validate = true;
				enter = true;
			}
			if (e.key == "Tab") {
				validate = true;
			}

			if (validate) {
				let list = document.getElementById("spea-autocomplete-list");
				if (list) {
					list.getElementsByClassName("autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa")[this.selectedIndex].click();
					if (enter) {
						e.preventDefault();
						e.stopPropagation();
					}
				}
			}
		};

		this.onChatKeyDown = (e) => {
			if (e.key.includes("Arrow")) {
				if (e.key.includes("Up")) {
					if (this.selectedIndex > 0) {
						this.selectedIndex--;
					} else {
						this.selectedIndex = this.results.length - 1;
					}
				} else if (e.key.includes("Down")) {
					if (this.selectedIndex < this.results.length - 1) {
						this.selectedIndex++;
					} else {
						this.selectedIndex = 0;
					}
				} else {
					return;
				}
				this.updateSelected();
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		};

		this.onChatKeyUp = (e) => {
			if (e.key.includes("Arrow") && (e.key.includes("Up") || e.key.includes("Down"))) {
				return;
			}

			let chatbox = e.target, autocomplete = document.getElementById("spea-autocomplete"), words = chatbox.value.split(" "), lastWord = words[words.length - 1];

			if (!lastWord || lastWord.length <= this.settings.prefix.length || (this.settings.prefix && !lastWord.startsWith(this.settings.prefix))) {
				if (autocomplete) {
					autocomplete.outerHTML = "";
				}
				return;
			}

			if (this.settings.prefix) {
				lastWord = lastWord.substring(this.settings.prefix.length, lastWord.length);
			}

			let emotes = [];

			let lim = 0;
			for (let i = 0; i < this.emotes.length; i++) {
				if (lim >= this.settings.resultsCap) {
					break;
				}

				if (!this.emotes[i].name.toLowerCase().includes(lastWord.toLowerCase())) {
					continue;
				}

				emotes.push(this.emotes[i]);

				lim++;
			}

			this.results = emotes;

			if (emotes.length == 0) {
				if (autocomplete) {
					autocomplete.outerHTML = "";
				}
				return;
			}

			if (!autocomplete) {
				chatbox.parentElement.insertAdjacentHTML("beforeend", `
					<div id="spea-autocomplete" class="autocomplete-1vrmpx autocomplete-i9yVHs">
						<div class="autocompleteInner-zh20B_">
							<div class="autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa">
								<div class="selector-2IcQBU">
									<div class="contentTitle-2tG_sM small-29zrCQ size12-3R0845 height16-2Lv3qA weightSemiBold-NJexzi">Emotes matching <strong>${lastWord}</strong></div>
								</div>
							</div>
							<div id="spea-autocomplete-list">

							</div>
						</div>
					</div>
				`);

				autocomplete = document.getElementById("spea-autocomplete");
			}

			this.selectedIndex = 0;

			let list = document.getElementById("spea-autocomplete-list");

			list.innerHTML = "";

			for (let i = 0; i < emotes.length; i++) {
				list.insertAdjacentHTML("beforeend", `
					<div class="autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa">
						<div class="selector-2IcQBU selectable-3dP3y-">
							<div class="flex-1xMQg5 flex-1O1GKY horizontal-1ae9ci horizontal-2EEEnY flex-1O1GKY directionRow-3v3tfG justifyStart-2NDFzi alignCenter-1dQNNs noWrap-3jynv6 content-Qb0rXO" style="flex: 1 1 auto;"><img style="width:${this.settings.size}px;height:${this.settings.size}px;" src="${emotes[i].url}">
								<div class="marginLeft8-1YseBe">${emotes[i].name}</div>
								<div style="margin-left:auto;opacity:0.5;">${emotes[i].type}</div>
							</div>
						</div>
					</div>
				`);

				let items = document.getElementsByClassName("autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa");

				items[items.length - 1].addEventListener("click", e => {
					words[words.length - 1] = this.settings.prefix + emotes[this.selectedIndex].name + " ";
					NeatoLib.Chatbox.setText(words.join(" "));
					autocomplete.outerHTML = "";
				});

				items[items.length - 1].addEventListener("mouseover", e => {
					this.selectedIndex = i;
					this.updateSelected();
				});
			}

			this.updateSelected();
		};

		this.initialized = true;

		document.addEventListener("keydown", this.onGlobalKey);
		
		NeatoLib.Events.onPluginLoaded(this);

		this.switch();

		this.switchEvent = () => this.switch();

		NeatoLib.Events.attach("switch", this.switchEvent);

	}

	switch() {
		if (this.initialized != true) return;

		if (this.emotes === undefined || this.emotes.length == 0) {
			this.getEmotes();
		}

		let chatbox = NeatoLib.Chatbox.get();

		if (chatbox) {
			chatbox.addEventListener("keyup", this.onChatKeyUp);
			chatbox.addEventListener("keydown", this.onChatKeyDown);
		}
	}

	getEmotes() {
		let _this = this;

		$.getJSON(this.settings.url + "/list", data => {
			_this.emotes = [];
			for (let emoteList of data) {
				let type = emoteList["type_name"];
				for (let emote of emoteList["list"]) {
					_this.emotes.push({
						"name": emote["name"],
						"url": _this.settings.url + emote["path"],
						"type": type
					});
				}
			}
		});
	}

	stop() {
		let chatbox = NeatoLib.Chatbox.get();

		if (chatbox) chatbox.removeEventListener("keyup", this.onChatKeyUp);
		if (chatbox) chatbox.removeEventListener("keydown", this.onChatKeyDown);

		document.removeEventListener("keydown", this.onGlobalKey);

		NeatoLib.Events.detach("switch", this.switchEvent);
	}
	
}