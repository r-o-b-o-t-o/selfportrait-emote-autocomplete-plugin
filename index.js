module.exports = (Plugin, Library) => {
    const { Logger, Patcher, Settings } = Library;

    return class ExamplePlugin extends Plugin {
        constructor() {
            super();
            this.defaultSettings = {
                "url": "https://selfportrait-rs.herokuapp.com",
                "prefix": ">",
                "twitchPrefix": "%",
                "previewSize": 24,
                "maxResults": 10,
                "validateWithReturn": true
            };
        }

        onStart() {
            Logger.log("Started");

            this.$autocompleteTemplate = $(
                `<div id="spea-autocomplete" class="autocomplete-1vrmpx autocomplete-i9yVHs">
                    <div class="autocompleteInner-zh20B_">
                        <div class="autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa">
                            <div class="selector-2IcQBU">
                                <div class="contentTitle-2tG_sM small-29zrCQ size12-3R0845 height16-2Lv3qA weightSemiBold-NJexzi">Emotes matching <strong class="spea-query"></strong></div>
                            </div>
                        </div>
                        <div class="spea-autocomplete-list"></div>
                    </div>
                </div>`
            );
            this.$autocomplete = null;

            this.results = [];
            this.emotes = [];
            this.getEmotes();
            this.selectedIdx = -1;

            this.observer = new MutationObserver((mutations, _observer) => {
                for (var mut of mutations) {
                    for (var node of mut.addedNodes) {
                        var $search = $(node).find(".da-textArea");
                        if ($search.length != 0) {
                            this.$chatbox = $search;
                            this.setChatboxEvent();
                            return;
                        }
                    }
                }
            });
            this.observer.observe($(".da-container")[0], {
                "childList": true,
                "subtree": true,
            });

            this.$chatbox = $(".da-textArea");
            this.setChatboxEvent();
        }

        // Walk the element tree, stop when func(node) returns false
        nodeWalk(node, func) {
            var result = func(node);
            for (node = node.firstChild; result !== false && node; node = node.nextSibling) {
                result = this.nodeWalk(node, func);
            }
            return result;
        }

        // Returns [start, end] as offsets to elem.textContent that
        //   correspond to the selected portion of text
        //   (if start == end, caret is at given position and no text is selected)
        // From https://stackoverflow.com/a/53128599
        getCaretPosition(elem) {
            var sel = window.getSelection();
            var cumLength = [0, 0];

            if (sel.anchorNode == elem) {
                cumLength = [sel.anchorOffset, sel.extentOffset];
            } else {
                var nodesToFind = [sel.anchorNode, sel.extentNode];
                if (!elem.contains(sel.anchorNode) || !elem.contains(sel.extentNode)) {
                    return undefined;
                } else {
                    var found = [0, 0];
                    var i;
                    this.nodeWalk(elem, function(node) {
                        for (i = 0; i < 2; i++) {
                            if (node == nodesToFind[i]) {
                                found[i] = true;
                                if (found[i == 0 ? 1 : 0]) {
                                    return false; // all done
                                }
                            }
                        }

                        if (node.textContent && !node.firstChild) {
                            for (i = 0; i < 2; i++) {
                                if (!found[i]) {
                                    cumLength[i] += node.textContent.length;
                                }
                            }
                        }
                    });
                    cumLength[0] += sel.anchorOffset;
                    cumLength[1] += sel.extentOffset;
                }
            }
            if (cumLength[0] <= cumLength[1]) {
                return cumLength;
            }
            return [cumLength[1], cumLength[0]];
        }

        setChatboxEvent() {
            this.$chatbox.on("keydown", e => {
                var modifierKeys = e.altKey || e.ctrlKey || e.shiftKey;
                if ((e.which == 40 || // Down arrow
                    e.which == 38) && // Up arrow
                    !modifierKeys) {

                    if (e.which == 38) { // Up
                        if (this.selectedIdx > 0) {
                            --this.selectedIdx;
                        } else {
                            this.selectedIdx = this.results.length - 1;
                        }
                    } else if (e.which == 40) { // Down
                        if (this.selectedIdx < this.results.length - 1) {
                            ++this.selectedIdx;
                        } else {
                            this.selectedIdx = 0;
                        }
                    }

                    if (this.updateSelected()) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                } else if (e.which == 27) { // Escape
                    this.removeAutocompletePanel();
                    return;
                } else if (!modifierKeys && (e.which == 9 || (e.which == 13 && this.settings.validateWithReturn))) {
                    // Tab or return
                    if (this.selectedIdx != -1 && this.$autocomplete != null) {
                        this.onSelectionValidated();
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            });

            this.$chatbox.on("keyup", e => {
                if ((e.which == 40 || // Down arrow
                    e.which == 38) && // Up arrow
                    !e.altKey && !e.ctrlKey && !e.shiftKey) {
                    return; // Prevent recreating the list item elements when going up or down to avoid losing the selection
                }
                if (e.which == 27) { // Escape
                    return;
                }
                var $elem = this.$chatbox.find(":focus");
                if ($elem[0] == null) {
                    return;
                }
                var text = $elem.text();
                var selection = this.getCaretPosition($elem[0]);
                if (selection[0] != selection[1]) {
                    return;
                }
                text = text.substring(0, selection[0]);
                var words = text.split(" ");
                var lastWord = words[words.length - 1];

                if (!lastWord || lastWord.length <= this.settings.prefix.length || (this.settings.prefix && !lastWord.startsWith(this.settings.prefix))) {
                    this.removeAutocompletePanel();
                    return;
                }

                if (this.settings.prefix) {
                    lastWord = lastWord.substring(this.settings.prefix.length, lastWord.length);
                }

                this.results = [];

                var addedCount = 0;
                for (var emote of this.emotes) {
                    if (addedCount >= this.settings.maxResults) {
                        break;
                    }
                    if (!emote.name.toLowerCase().includes(lastWord.toLowerCase())) {
                        continue;
                    }

                    this.results.push(emote);
                    ++addedCount;
                }

                if (this.results.length == 0) {
                    this.removeAutocompletePanel();
                    return;
                }

                if (this.$autocomplete == null) {
                    this.$autocomplete = this.$autocompleteTemplate.clone();
                    this.$autocomplete.prependTo(this.$chatbox.parent().parent().parent());
                }

                var $list = this.$autocomplete.find(".spea-autocomplete-list");
                $list.empty();
                $(this.results).each((idx, emote) => {
                    var img = emote.type == "Sound" ? "/assets/658d047ef378c3147a9d8d3a01fef268.svg" : emote.url;
                    var $item = $(`<div class="autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa">
                                        <div class="selector-2IcQBU selectable-3dP3y- spea-autocomplete-item">
                                            <div class="flex-1xMQg5 flex-1O1GKY horizontal-1ae9ci horizontal-2EEEnY flex-1O1GKY directionRow-3v3tfG justifyStart-2NDFzi alignCenter-1dQNNs noWrap-3jynv6 content-Qb0rXO" style="flex: 1 1 auto;">
                                                <img style="width: ${this.settings.previewSize}px; height: ${this.settings.previewSize}px;" src="${img}" />
                                                <div class="marginLeft8-1YseBe">${emote.name}</div>
                                                <div style="margin-left: auto; opacity: 0.5;">${emote.type}</div>
                                            </div>
                                        </div>
                                    </div>`);
                    $item.appendTo($list);
                    $item.on("mouseover", e => {
                        if (this.selectedIdx != idx) {
                            this.selectedIdx = idx;
                            this.updateSelected();
                        }
                    });
                    $item.on("click", e => {
                        this.onSelectionValidated();
                    });
                });

                this.selectedIdx = Math.min(this.results.length - 1, Math.max(this.selectedIdx, 0));
                this.updateSelected();
            });
        }

        removeAutocompletePanel() {
            if (this.$autocomplete != null) {
                this.$autocomplete.remove();
                this.$autocomplete = null;
                this.selectedIdx = -1;
            }
        }

        updateSelected() {
            if (this.$autocomplete == null) {
                return false;
            }
            var _this = this;
            this.$autocomplete.find(".spea-autocomplete-item").each((idx, item) => {
                if (idx == _this.selectedIdx) {
                    $(item).addClass("selectorSelected-1_M1WV");
                } else {
                    $(item).removeClass("selectorSelected-1_M1WV");
                }
            });
            return true;
        }

        onSelectionValidated() {
            if (this.selectedIdx == -1 || this.$autocomplete == null) {
                return;
            }
            var $elem = this.$chatbox.find(".da-slateTextArea");
            if ($elem[0] == null) {
                return;
            }
            $elem.select();
            var text = $elem.text();
            var selection = this.getCaretPosition($elem[0]);
            text = text.substring(0, selection[0]);
            var words = text.split(" ");
            var lastWord = words[words.length - 1];
            var emote = this.results[this.selectedIdx];
            var prefix = this.settings.prefix;
            for (var i = 0; i < lastWord.length - prefix.length; ++i) {
                document.execCommand("delete", false);
            }
            document.execCommand("insertText", false, emote.name + " ");

            this.removeAutocompletePanel();
            this.selectedIdx = -1;
        }

        onStop() {
            this.observer.disconnect();
            Logger.log("Stopped");
            Patcher.unpatchAll();
        }

        getSettingsPanel() {
            return Settings.SettingPanel.build(
                this.saveSettings.bind(this),
                new Settings.Textbox("Library URL", "", this.settings.url, (e) => { this.settings.url = e; }),
                new Settings.Textbox("Emote Prefix", "", this.settings.prefix, (e) => { this.settings.prefix = e; }),
                new Settings.Textbox("Twitch Emote Prefix", "", this.settings.twitchPrefix, (e) => { this.settings.twitchPrefix = e; }),
                new Settings.Slider("Emote Preview Size", "", 12, 128, this.settings.previewSize, (e) => { this.settings.previewSize = e; }, {
                    "markers": [12, 16, 24, 32, 48, 64, 80, 96, 112, 128],
                    "stickToMarkers": true,
                }),
                new Settings.Textbox("Max Results", "", this.settings.maxResults, (e) => {
                    var parsed = parseInt(e);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.settings.maxResults = parsed;
                    }
                }),
                new Settings.Switch("Validate with ↵ (Return Key)", "", this.settings.validateWithReturn === true, (e) => { this.settings.validateWithReturn = e; }),
            );
        }

        getEmotes() {
            var _this = this;

            $.getJSON(this.settings.url + "/library", data => {
                _this.emotes = [];
                for (var emoteList of data) {
                    var type = emoteList["type_name"];
                    for (var emote of emoteList["emotes"]) {
                        _this.emotes.push({
                            "name": emote["name"],
                            "url": _this.settings.url + emote["url"],
                            "type": type,
                        });
                    }
                }
            });
        }
    };
};
