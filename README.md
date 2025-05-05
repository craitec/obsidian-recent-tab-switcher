# Obsidian Recent Tab Switcher FAB

A simple Obsidian plugin that adds a floating action button (FAB) to quickly switch between your two most recently used markdown tabs.

## Features

* **Floating Action Button (FAB):** Provides a persistent button on the screen for easy access.
* **Quick Tab Switching:** Click the button to instantly jump between the current tab and the previously active markdown tab.
* **Draggable Button:** Click and drag the button to place it anywhere on the screen.
* **Persistent Position:** The button's position is saved and restored across Obsidian sessions.
* **Customizable Appearance:** Adjust the button's size and opacity via the plugin settings.

## How to Install

**Manual Installation:**

1.  Download the `main.js`, `styles.css`, and `manifest.json` files from the [latest release](https://github.com/craitec/obsidian-recent-tab-switcher/releases/latest).
2.  Navigate to your Obsidian vault's plugins folder: `YourVault/.obsidian/plugins/`.
3.  Create a new folder named `recent-tab-switcher-fab`.
4.  Place the downloaded `main.js`, `styles.css`, and `manifest.json` files into this new folder.
5.  Reload Obsidian (Ctrl+R or Cmd+R).
6.  Go to Settings -> Community Plugins, find "Recent Tab Switcher FAB", and enable it.

## Settings

Access the plugin settings via Obsidian's Settings -> Community Plugins -> Recent Tab Switcher FAB:

* **Button Size:** Adjust the size of the floating button (in pixels).
* **Button Opacity:** Adjust the transparency of the button (0=invisible, 1=solid).
* **Reset FAB Position:** Resets the button to its default screen position.

## Development

**Prerequisites:**

* **Node.js:** You need Node.js installed on your system to manage packages and run build commands. You can download it from [nodejs.org](https://nodejs.org/). Installing Node.js also installs `npm` (Node Package Manager) and `npx` (Node Package Execute).

**Steps:**

1.  **Clone Repository:** Clone this repository to your local machine.
    ```bash
    git clone https://github.com/craitec/obsidian-recent-tab-switcher.git
    cd obsidian-recent-tab-switcher
    ```
2.  **Install Dependencies:** Navigate to the repository folder in your terminal and run `npm install`. This command reads the `package.json` file and installs the necessary development dependencies, including TypeScript and the Obsidian API typings.
    ```bash
    npm install
    ```
3.  **Compile Code:** Run `npx tsc` in the terminal. This command executes the TypeScript compiler (`tsc`), which is installed as part of the development dependencies. It reads the `tsconfig.json` file and compiles the TypeScript code (`main.ts`) into JavaScript (`main.js`).
    ```bash
    npx tsc
    ```
    *(Alternatively, if you have TypeScript installed globally, you could just run `tsc`)*.
4.  **Copy to Vault:** Copy the generated `main.js` file, along with `styles.css` and `manifest.json`, to your Obsidian vault's plugin folder (e.g., `YourVault/.obsidian/plugins/recent-tab-switcher-fab/`). Create the folder if it doesn't exist.
5.  **Reload Obsidian:** Reload Obsidian (Ctrl+R or Cmd+R) or disable/enable the plugin to load the updated code.


## License

Apache License 2.0

https://github.com/craitec/obsidian-recent-tab-switcher/blob/main/LICENSE

## Support

Many thanks for your support&nbsp;🙂

[![Buy&nbsp;me&nbsp;a&nbsp;coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-☕-brightorange?style=flat-square)](https://buymeacoffee.com/craitec)
