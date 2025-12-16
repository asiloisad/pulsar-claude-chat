/** @babel */

import { CompositeDisposable } from "atom";
import {
  listSessions,
  deleteSession,
  formatSessionForList,
} from "./session-store";

const { SelectListView, highlightMatches } = require("pulsar-select-list");

/**
 * HistoryList manages the chat session history select list.
 */
export default class HistoryList {
  constructor(main) {
    this.main = main;
    this.showAll = false;
    this.items = [];
    this.reload = true;

    this.selectList = new SelectListView({
      items: [],

      maxResults: 50,

      className: "claude-chat-history",

      emptyMessage: "No sessions for this project",

      filterKeyForItem: (item) => item.text,

      emptyMessage: "No sessions found",

      willShow: () => this.loadItems(),

      removeDiacritics: true,

      elementForItem: (item) => {
        const li = document.createElement("li");
        li.classList.add("two-lines");

        const matches = this.selectList.getMatchIndices(item) || [];

        // Primary line with date and project
        const priBlock = document.createElement("div");
        priBlock.classList.add("primary-line");
        priBlock.appendChild(highlightMatches(item.label, matches));
        li.appendChild(priBlock);

        // Secondary line with first message preview
        const secBlock = document.createElement("div");
        secBlock.classList.add("secondary-line");
        const labelLen = item.label.length + 1; // +1 for space in filterKey
        secBlock.appendChild(
          highlightMatches(
            item.description,
            matches.map((x) => x - labelLen)
          )
        );
        li.appendChild(secBlock);

        return li;
      },

      didConfirmSelection: async (item) => {
        this.selectList.hide();
        await this.main.openSession(item.sessionId);
      },

      didCancelSelection: () => {
        this.selectList.hide();
      },
    });

    this.disposables = new CompositeDisposable();
    this.disposables.add(
      atom.commands.add(this.selectList.element, {
        "claude-chat:open-keep-list": async () => {
          const item = this.selectList.getSelectedItem();
          if (item) {
            await this.main.openSession(item.sessionId);
          }
        },
        "claude-chat:delete-session": async () => {
          const item = this.selectList.getSelectedItem();
          if (item) {
            await deleteSession(item.sessionId);
            this.items = this.items.filter(
              (i) => i.sessionId !== item.sessionId
            );
            if (this.items.length === 0) {
              this.selectList.hide();
              atom.notifications.addInfo("No more chat history.");
            } else {
              this.selectList.update({ items: this.items });
            }
          }
        },
        "claude-chat:toggle-all-sessions": () => {
          this.showAll = !this.showAll;
          this.reload = true;
          this.loadItems();
        },
        "claude-chat:refresh-list": () => {
          this.reload = true;
          this.loadItems();
        },
      }),
      atom.commands.add("atom-workspace", {
        "claude-chat:history": () => this.toggle(),
      })
    );
  }

  destroy() {
    this.disposables.dispose();
    this.selectList.destroy();
  }

  toggle() {
    console.log("toggle history");
    this.selectList.toggle();
  }

  show() {
    this.selectList.show();
  }

  hide() {
    this.selectList.hide();
  }

  async loadItems() {
    if (this.reload) {
      this.selectList.update({
        items: [],
        loadingMessage: "Loading sessions...",
        helpMarkdown:
          "Available commands:\n" +
          "- **Enter** — Open selected chat\n" +
          "- **Ctrl+Enter** — Open chat (keep list open)\n" +
          "- **Ctrl+D** — Delete selected chat\n" +
          "- **Ctrl+0** — Toggle project/global mode " +
          (this.showAll ? "(P)" : "(G)") +
          "\n- **F5** — Refresh list",
      });
      const projectPaths = this.showAll ? [] : atom.project.getPaths();
      const sessions = await listSessions(projectPaths);
      this.items = sessions.map(formatSessionForList).map((item) => {
        item.text = item.label + " " + item.description;
        return item;
      });
      this.selectList.update({
        items: this.items,
        loadingMessage: null,
      });
      this.reload = false;
    }
  }
}
