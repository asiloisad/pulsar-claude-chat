/** @babel */

import { CompositeDisposable } from "atom";

const { SelectListView, highlightMatches } = require("pulsar-select-list");

/**
 * Available slash commands for Claude CLI
 */
const SLASH_COMMANDS = [
  { name: "compact", description: "Compact conversation context" },
  { name: "cost", description: "Show token cost breakdown" },
  { name: "init", description: "Initialize project configuration" },
  { name: "pr-comments", description: "Review PR comments" },
  { name: "release-notes", description: "Generate release notes" },
  { name: "review", description: "Code review current changes" },
  { name: "security-review", description: "Security audit of code" },
];

/**
 * SlashList manages the slash command select list.
 */
export default class SlashList {
  constructor(main) {
    this.main = main;

    this.selectList = new SelectListView({
      items: SLASH_COMMANDS,

      maxResults: 20,

      className: "claude-chat-slash",

      emptyMessage: "No matching commands",

      filterKeyForItem: (item) => "/" + item.name + " " + item.description,

      elementForItem: (item) => {
        const li = document.createElement("li");
        li.classList.add("two-lines");

        const matches = [];

        // Primary line with command name
        const priBlock = document.createElement("div");
        priBlock.classList.add("primary-line");
        priBlock.appendChild(highlightMatches(`/${item.name}`, matches));
        li.appendChild(priBlock);

        // Secondary line with description
        const secBlock = document.createElement("div");
        secBlock.classList.add("secondary-line");
        const nameLen = item.name.length + 2; // +1 for "/" +1 for space in filterKey
        secBlock.appendChild(
          highlightMatches(
            item.description,
            matches.map((x) => x - nameLen)
          )
        );
        li.appendChild(secBlock);

        return li;
      },

      didConfirmSelection: (item) => {
        this.selectList.hide();
        this.sendCommand(item.name);
      },

      didCancelSelection: () => {
        this.selectList.hide();
        this.main.focusActiveChat();
      },
    });

    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.commands.add(".claude-chat", {
        "claude-chat:slash-commands": () => this.toggle(),
      })
    );
  }

  destroy() {
    this.disposables.dispose();
    this.selectList.destroy();
  }

  toggle() {
    this.selectList.toggle();
  }

  show() {
    this.selectList.show();
  }

  hide() {
    this.selectList.hide();
  }

  sendCommand(name) {
    const panel = this.main.getActiveChat();
    if (panel) {
      panel.sendSlashCommand(name);
    }
  }
}
