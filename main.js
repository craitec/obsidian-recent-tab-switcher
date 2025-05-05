"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
// Defaults for orientation-specific positions
const DEFAULT_SETTINGS = {
    // Portrait defaults (usually taller than wide)
    posPortraitLeft: { top: '85%', left: '10%' },
    posPortraitRight: { top: '85%', left: '90%' },
    activeIndexPortrait: 1, // Default right in portrait
    // Landscape defaults (usually wider than tall)
    posLandscapeLeft: { top: '80%', left: '5%' },
    posLandscapeRight: { top: '80%', left: '95%' },
    activeIndexLandscape: 1, // Default right in landscape
    // Appearance
    fabSize: 50,
    fabOpacity: 1.0,
};
// --- Plugin Class ---
class RecentTabsPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.recentLeaves = [];
        this.fabElement = null;
        // Interaction state variables
        this.isDragging = false;
        this.longPressTimer = null;
        this.pointerDownHandled = false;
        // Position tracking
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.fabInitialX = 0;
        this.fabInitialY = 0;
        // --- Pointer Move Handler ---
        this.onPointerMove = (event) => {
            var _a;
            if (!this.pointerDownHandled)
                return;
            if (!this.isDragging) { // Check if dragging threshold met
                let currentX = (event instanceof MouseEvent) ? event.clientX : event.touches[0].clientX;
                let currentY = (event instanceof MouseEvent) ? event.clientY : event.touches[0].clientY;
                const deltaX = Math.abs(currentX - this.dragStartX);
                const deltaY = Math.abs(currentY - this.dragStartY);
                const dragThreshold = 5;
                if (deltaX > dragThreshold || deltaY > dragThreshold) {
                    console.log("Movement detected, confirming drag.");
                    if (this.longPressTimer) { // Cancel long press if dragging starts
                        clearTimeout(this.longPressTimer);
                        this.longPressTimer = null;
                        console.log("Cleared long press timer due to movement.");
                    }
                    this.isDragging = true;
                    (_a = this.fabElement) === null || _a === void 0 ? void 0 : _a.classList.add('is-dragging');
                }
            }
            if (!this.isDragging || !this.fabElement)
                return; // Exit if not dragging
            if (event.type === 'touchmove')
                event.preventDefault();
            // Calculate and apply new position during drag
            let currentX = (event instanceof MouseEvent) ? event.clientX : event.touches[0].clientX;
            let currentY = (event instanceof MouseEvent) ? event.clientY : event.touches[0].clientY;
            const deltaX = currentX - this.dragStartX;
            const deltaY = currentY - this.dragStartY;
            const newX = this.fabInitialX + deltaX;
            const newY = this.fabInitialY + deltaY;
            const fabSize = this.settings.fabSize;
            const clampedX = Math.max(0, Math.min(newX, window.innerWidth - fabSize));
            const clampedY = Math.max(0, Math.min(newY, window.innerHeight - fabSize));
            requestAnimationFrame(() => {
                if (this.fabElement && this.isDragging) {
                    this.fabElement.style.left = `${clampedX}px`;
                    this.fabElement.style.top = `${clampedY}px`;
                }
            });
        };
        // --- Pointer Up Handler ---
        this.onPointerUp = (event) => {
            var _a;
            if (!this.pointerDownHandled)
                return;
            const wasDragging = this.isDragging;
            const longPressTimerStillPending = !!this.longPressTimer;
            console.log(`Pointer Up (${event.type}). Was Dragging: ${wasDragging}, Timer Pending: ${longPressTimerStillPending}`);
            if (this.longPressTimer) { // Clear timer if it was pending
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
                console.log("Cleared pending long press timer on pointer up.");
            }
            this.removeGlobalListeners();
            (_a = this.fabElement) === null || _a === void 0 ? void 0 : _a.classList.remove('is-dragging');
            // --- Decide action ---
            if (wasDragging) {
                // Drag completed: Save position with overlap check
                console.log("Pointer Up: Drag detected, saving position.");
                this.saveDraggedPosition(); // Call dedicated save function
            }
            else if (longPressTimerStillPending) {
                // Timer was cleared by this pointerUp -> TAP
                console.log("Pointer Up: Tap detected (timer cleared).");
                this.jumpToRecentTab();
            }
            else {
                // Timer was already null (fired or cancelled by drag) AND not dragging -> Long press completed
                console.log("Pointer Up: Ignoring, long press action completed earlier or drag cancelled timer.");
            }
            // Reset state flags
            this.isDragging = false;
            this.pointerDownHandled = false;
        };
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Loading Recent Tabs FAB plugin`);
            yield this.loadSettings();
            this.addSettingTab(new RecentTabsSettingTab(this.app, this));
            this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf)
                    this.updateRecentLeaves(leaf);
            }));
            this.createFAB();
            const initDelay = obsidian_1.Platform.isMobile ? 500 : 0;
            setTimeout(() => {
                var _a;
                const activeLeaf = (_a = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView)) === null || _a === void 0 ? void 0 : _a.leaf;
                if (activeLeaf)
                    this.updateRecentLeaves(activeLeaf);
            }, initDelay);
            // Use resize observer for more reliable orientation change detection
            this.registerDomEvent(window, 'resize', this.handleResize.bind(this));
            // Initial check in case orientation is already landscape
            this.handleResize();
        });
    }
    onunload() {
        var _a;
        console.log('Unloading Recent Tabs FAB plugin');
        if (this.longPressTimer)
            clearTimeout(this.longPressTimer);
        this.removeGlobalListeners();
        (_a = this.fabElement) === null || _a === void 0 ? void 0 : _a.remove();
        this.fabElement = null;
        this.recentLeaves = [];
    }
    // --- Settings Management ---
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Load settings, merging with new orientation-specific defaults
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
            // Basic migration check from previous dual-position structure
            if (this.settings.fabPositionLeft && !this.settings.posPortraitLeft) {
                console.log("Attempting to migrate old dual-position settings.");
                this.settings.posPortraitLeft = Object.assign({}, this.settings.fabPositionLeft);
                this.settings.posPortraitRight = Object.assign({}, this.settings.fabPositionRight);
                this.settings.activeIndexPortrait = (_a = this.settings.activePositionIndex) !== null && _a !== void 0 ? _a : 1;
                // Set landscape defaults or copy portrait? Let's use defaults for simplicity.
                this.settings.posLandscapeLeft = Object.assign({}, DEFAULT_SETTINGS.posLandscapeLeft);
                this.settings.posLandscapeRight = Object.assign({}, DEFAULT_SETTINGS.posLandscapeRight);
                this.settings.activeIndexLandscape = DEFAULT_SETTINGS.activeIndexLandscape;
                // Delete old keys
                delete this.settings.fabPositionLeft;
                delete this.settings.fabPositionRight;
                delete this.settings.activePositionIndex;
                yield this.saveSettings();
            }
            console.log('Settings loaded');
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
            console.log('Settings saved');
        });
    }
    // --- FAB Creation and Styling ---
    createFAB() {
        this.fabElement = document.createElement('button');
        this.fabElement.id = 'recent-tab-fab';
        this.fabElement.setAttribute('aria-label', 'Jump to recent tab (Long press 1s to switch side)');
        this.fabElement.addClasses(['view-action', 'clickable-icon']);
        (0, obsidian_1.setIcon)(this.fabElement, 'arrow-left-right');
        this.applyPosition(); // Apply initial position based on current orientation/index
        this.applyFabStyles();
        // --- Event Listeners ---
        this.registerDomEvent(this.fabElement, 'mousedown', this.onPointerDown.bind(this));
        this.registerDomEvent(this.fabElement, 'touchstart', this.onPointerDown.bind(this), { passive: false });
        // Click listener (Fallback ONLY)
        this.registerDomEvent(this.fabElement, 'click', (event) => {
            // This should ideally not be needed if pointerUp handles taps correctly
            if (this.isDragging)
                return; // Ignore clicks after dragging
            console.log("Unexpected click event - Tap/LongPress should be handled earlier.");
        });
        document.body.appendChild(this.fabElement);
    }
    applyFabStyles() {
        if (!this.fabElement)
            return;
        this.fabElement.style.setProperty('--fab-actual-size', `${this.settings.fabSize}px`);
        this.fabElement.style.setProperty('--fab-actual-opacity', `${this.settings.fabOpacity}`);
    }
    // --- Orientation Helper ---
    isLandscape() {
        return window.innerWidth > window.innerHeight;
    }
    // Apply position based on current orientation and ACTIVE index
    applyPosition() {
        if (!this.fabElement)
            return;
        const landscape = this.isLandscape();
        const activeIndex = landscape ? this.settings.activeIndexLandscape : this.settings.activeIndexPortrait;
        const activePosition = activeIndex === 0
            ? (landscape ? this.settings.posLandscapeLeft : this.settings.posPortraitLeft)
            : (landscape ? this.settings.posLandscapeRight : this.settings.posPortraitRight);
        // Use the stored percentage values
        const topPercent = parseFloat(activePosition.top) || 0;
        const leftPercent = parseFloat(activePosition.left) || 0;
        const fabSize = this.settings.fabSize;
        // Calculate target pixel positions (top-left corner)
        let targetTop = (topPercent / 100) * window.innerHeight;
        let targetLeft = (leftPercent / 100) * window.innerWidth;
        // Clamp values within viewport
        const clampedTop = Math.max(0, Math.min(targetTop, window.innerHeight - fabSize));
        const clampedLeft = Math.max(0, Math.min(targetLeft, window.innerWidth - fabSize));
        // Apply final positions
        this.fabElement.style.top = `${clampedTop}px`;
        this.fabElement.style.left = `${clampedLeft}px`;
        this.fabElement.style.bottom = '';
        this.fabElement.style.right = '';
        // console.log(`Applied position for ${landscape ? 'Landscape' : 'Portrait'} index ${activeIndex}: T ${clampedTop}px, L ${clampedLeft}px`);
    }
    // --- Pointer Down Handler ---
    onPointerDown(event) {
        if (!this.fabElement || this.pointerDownHandled)
            return;
        this.pointerDownHandled = true;
        console.log(`Pointer Down (${event.type})`);
        this.isDragging = false;
        if (this.longPressTimer)
            clearTimeout(this.longPressTimer);
        const fabRect = this.fabElement.getBoundingClientRect();
        this.fabInitialX = fabRect.left;
        this.fabInitialY = fabRect.top;
        if (event instanceof MouseEvent) {
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            document.addEventListener('mousemove', this.onPointerMove);
            document.addEventListener('mouseup', this.onPointerUp);
        }
        else { // TouchEvent
            event.preventDefault();
            const touch = event.touches[0];
            this.dragStartX = touch.clientX;
            this.dragStartY = touch.clientY;
            document.addEventListener('touchmove', this.onPointerMove, { passive: false });
            document.addEventListener('touchend', this.onPointerUp);
            document.addEventListener('touchcancel', this.onPointerUp);
        }
        // Start 1-second long press timer
        this.longPressTimer = window.setTimeout(() => {
            if (!this.isDragging) { // Only trigger if not dragging
                console.log("Long press timer fired AND not dragging!");
                this.handleLongPress();
            }
            else {
                console.log("Long press timer fired, but dragging started. Ignoring.");
            }
            this.longPressTimer = null; // Mark timer as handled
        }, 1000);
    }
    // --- Save Dragged Position with Overlap Check ---
    saveDraggedPosition() {
        if (!this.fabElement)
            return;
        const landscape = this.isLandscape();
        const activeIndex = landscape ? this.settings.activeIndexLandscape : this.settings.activeIndexPortrait;
        const positionToUpdate = activeIndex === 0
            ? (landscape ? this.settings.posLandscapeLeft : this.settings.posPortraitLeft)
            : (landscape ? this.settings.posLandscapeRight : this.settings.posPortraitRight);
        const otherPosition = activeIndex === 1 // Get the *other* position for the current orientation
            ? (landscape ? this.settings.posLandscapeLeft : this.settings.posPortraitLeft)
            : (landscape ? this.settings.posLandscapeRight : this.settings.posPortraitRight);
        const finalRect = this.fabElement.getBoundingClientRect();
        const fabSize = this.settings.fabSize;
        const minSeparation = fabSize * 1.2; // Minimum distance between centers
        // Calculate final center position in pixels
        const finalCenterX = finalRect.left + fabSize / 2;
        const finalCenterY = finalRect.top + fabSize / 2;
        // Calculate other position's center in pixels
        const otherTopPercent = parseFloat(otherPosition.top) || 0;
        const otherLeftPercent = parseFloat(otherPosition.left) || 0;
        const otherTargetTop = (otherTopPercent / 100) * window.innerHeight;
        const otherTargetLeft = (otherLeftPercent / 100) * window.innerWidth;
        const otherCenterX = otherTargetLeft + fabSize / 2;
        const otherCenterY = otherTargetTop + fabSize / 2;
        // Calculate distance between centers
        const dx = finalCenterX - otherCenterX;
        const dy = finalCenterY - otherCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let finalTopPercent;
        let finalLeftPercent;
        if (distance < minSeparation && distance > 1) { // Check if too close (and not exactly the same spot)
            console.warn(`Positions too close (dist: ${distance.toFixed(1)}px). Adjusting.`);
            // Calculate vector away from the other position
            const vectorX = dx / distance;
            const vectorY = dy / distance;
            // Calculate new center position pushed away
            const adjustedCenterX = otherCenterX + vectorX * minSeparation;
            const adjustedCenterY = otherCenterY + vectorY * minSeparation;
            // Convert back to top-left pixel position
            let adjustedTopPx = adjustedCenterY - fabSize / 2;
            let adjustedLeftPx = adjustedCenterX - fabSize / 2;
            // Clamp adjusted position within viewport
            adjustedTopPx = Math.max(0, Math.min(adjustedTopPx, window.innerHeight - fabSize));
            adjustedLeftPx = Math.max(0, Math.min(adjustedLeftPx, window.innerWidth - fabSize));
            // Convert clamped pixels back to percentages
            finalTopPercent = (adjustedTopPx / window.innerHeight) * 100;
            finalLeftPercent = (adjustedLeftPx / window.innerWidth) * 100;
            console.log(`Adjusted to T% ${finalTopPercent.toFixed(2)}, L% ${finalLeftPercent.toFixed(2)}`);
            // Apply the adjusted position visually immediately
            this.fabElement.style.top = `${adjustedTopPx}px`;
            this.fabElement.style.left = `${adjustedLeftPx}px`;
        }
        else {
            // Position is fine, save as is (convert final top-left pixel pos to percentages)
            finalTopPercent = (finalRect.top / window.innerHeight) * 100;
            finalLeftPercent = (finalRect.left / window.innerWidth) * 100;
        }
        // Save the final (potentially adjusted) percentages
        positionToUpdate.top = `${finalTopPercent.toFixed(2)}%`;
        positionToUpdate.left = `${finalLeftPercent.toFixed(2)}%`;
        console.log(`Saving dragged position to index ${activeIndex} (${landscape ? 'Landscape' : 'Portrait'}): T ${positionToUpdate.top}, L ${positionToUpdate.left}`);
        this.saveSettings();
    }
    // --- Long Press Handler (Called ONLY by Timer) ---
    handleLongPress() {
        // Assumes !this.isDragging check was done by the timer callback
        console.log("Executing Long Press Action!");
        // Timer is marked null by the callback that calls this
        const landscape = this.isLandscape();
        // Toggle the active index for the CURRENT orientation
        if (landscape) {
            this.settings.activeIndexLandscape = this.settings.activeIndexLandscape === 0 ? 1 : 0;
            console.log(`Toggled Landscape index to: ${this.settings.activeIndexLandscape}`);
        }
        else {
            this.settings.activeIndexPortrait = this.settings.activeIndexPortrait === 0 ? 1 : 0;
            console.log(`Toggled Portrait index to: ${this.settings.activeIndexPortrait}`);
        }
        // Apply the *other* position (for the current orientation) visually
        this.applyPosition();
        // Save the updated settings (saves the new active index)
        this.saveSettings();
        new obsidian_1.Notice(`Switched button position!`);
        if (obsidian_1.Platform.isMobile && navigator.vibrate)
            navigator.vibrate(100);
        // Let onPointerUp handle listener cleanup.
    }
    // --- Utility to remove global listeners ---
    removeGlobalListeners() {
        document.removeEventListener('mousemove', this.onPointerMove);
        document.removeEventListener('mouseup', this.onPointerUp);
        document.removeEventListener('touchmove', this.onPointerMove);
        document.removeEventListener('touchend', this.onPointerUp);
        document.removeEventListener('touchcancel', this.onPointerUp);
    }
    // --- Resize Handler ---
    handleResize() {
        console.log("Resize/Orientation Change Detected");
        this.applyPosition(); // Re-apply position based on new orientation/index
        this.applyFabStyles();
    }
    // --- Tab History and Jumping Logic --- (Unchanged)
    updateRecentLeaves(currentLeaf) {
        if (!(currentLeaf.view instanceof obsidian_1.MarkdownView))
            return;
        const existingIndex = this.recentLeaves.findIndex(leaf => leaf === currentLeaf);
        if (existingIndex > -1)
            this.recentLeaves.splice(existingIndex, 1);
        this.recentLeaves.unshift(currentLeaf);
        if (this.recentLeaves.length > 2)
            this.recentLeaves = this.recentLeaves.slice(0, 2);
    }
    jumpToRecentTab() {
        var _a, _b;
        console.log("Executing jumpToRecentTab");
        if (this.recentLeaves.length < 2) {
            new obsidian_1.Notice('No previous tab available to switch to.'); // Updated notice
            return;
        }
        const activeLeaf = (_a = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView)) === null || _a === void 0 ? void 0 : _a.leaf;
        let targetLeaf = null;
        if (!activeLeaf) {
            targetLeaf = this.recentLeaves[0];
        }
        else if (activeLeaf === this.recentLeaves[0]) {
            targetLeaf = this.recentLeaves[1];
        }
        else {
            targetLeaf = this.recentLeaves[0];
        }
        if (targetLeaf) {
            try {
                this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
            }
            catch (error) {
                console.error('Error calling setActiveLeaf:', error);
                new obsidian_1.Notice('Error switching tabs. Check console.');
            }
        }
        else {
            new obsidian_1.Notice('Could not determine target tab.');
        }
        (_b = this.fabElement) === null || _b === void 0 ? void 0 : _b.blur(); // Remove focus after action
    }
}
exports.default = RecentTabsPlugin;
// --- Settings Tab Class --- (Updated for orientation-specific settings)
class RecentTabsSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Recent Tabs FAB Settings' });
        // Size and Opacity Sliders
        new obsidian_1.Setting(containerEl)
            .setName('Button Size')
            .setDesc('Adjust the size of the floating button (in pixels).')
            .addSlider(slider => slider
            .setLimits(30, 100, 5)
            .setValue(this.plugin.settings.fabSize)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.fabSize = value;
            this.plugin.applyFabStyles();
            this.plugin.applyPosition(); // Re-apply position due to size change
            yield this.plugin.saveSettings();
        })));
        new obsidian_1.Setting(containerEl)
            .setName('Button Opacity')
            .setDesc('Adjust the transparency of the floating button (0=invisible, 1=solid).')
            .addSlider(slider => slider
            .setLimits(0.1, 1, 0.1)
            .setValue(this.plugin.settings.fabOpacity)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.fabOpacity = value;
            this.plugin.applyFabStyles();
            yield this.plugin.saveSettings();
        })));
        // Reset Button - Resets ALL positions and indices
        new obsidian_1.Setting(containerEl)
            .setName('Reset Positions')
            .setDesc('Reset all saved positions (Portrait & Landscape) and active sides to defaults.')
            .addButton(button => button
            .setButtonText('Reset All')
            .onClick(() => __awaiter(this, void 0, void 0, function* () {
            // Reset all position and index settings to defaults
            this.plugin.settings.posPortraitLeft = Object.assign({}, DEFAULT_SETTINGS.posPortraitLeft);
            this.plugin.settings.posPortraitRight = Object.assign({}, DEFAULT_SETTINGS.posPortraitRight);
            this.plugin.settings.activeIndexPortrait = DEFAULT_SETTINGS.activeIndexPortrait;
            this.plugin.settings.posLandscapeLeft = Object.assign({}, DEFAULT_SETTINGS.posLandscapeLeft);
            this.plugin.settings.posLandscapeRight = Object.assign({}, DEFAULT_SETTINGS.posLandscapeRight);
            this.plugin.settings.activeIndexLandscape = DEFAULT_SETTINGS.activeIndexLandscape;
            yield this.plugin.saveSettings(); // Save the reset values
            // Apply the reset position and styles visually
            this.plugin.applyPosition();
            this.plugin.applyFabStyles();
            new obsidian_1.Notice('All FAB positions reset.');
            // No need to refresh display as positions are hidden
            // this.display();
        })));
        // Help text
        containerEl.createEl('p', { text: `Drag button to move active position for the current screen orientation.` });
        containerEl.createEl('p', { text: `Long press (1s) to switch between saved left/right positions for the current orientation.` });
    }
}
