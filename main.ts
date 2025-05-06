import { Plugin, WorkspaceLeaf, MarkdownView, Notice, EventRef, setIcon, PluginSettingTab, App, Setting, SliderComponent, Platform } from 'obsidian';

// --- Interfaces ---
interface Position { top: string; left: string; } // Percentages '0%' to '100%'

// Settings structure for orientation-specific positions
interface RecentTabsPluginSettings {
    // Portrait positions
    posPortraitLeft: Position;
    posPortraitRight: Position;
    activeIndexPortrait: 0 | 1; // 0 for left, 1 for right in portrait
    // Landscape positions
    posLandscapeLeft: Position;
    posLandscapeRight: Position;
    activeIndexLandscape: 0 | 1; // 0 for left, 1 for right in landscape
    // Appearance settings
    fabSize: number;
    fabOpacity: number;
}

// Defaults for orientation-specific positions
const DEFAULT_SETTINGS: RecentTabsPluginSettings = {
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
}

// --- Plugin Class ---
export default class RecentTabsPlugin extends Plugin {
    settings!: RecentTabsPluginSettings;
    recentLeaves: WorkspaceLeaf[] = [];
    fabElement: HTMLElement | null = null;

    // Interaction state variables
    isDragging: boolean = false;
    longPressTimer: number | null = null;
    pointerDownHandled: boolean = false;

    // Position tracking
    dragStartX: number = 0;
    dragStartY: number = 0;
    fabInitialX: number = 0;
    fabInitialY: number = 0;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new RecentTabsSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf) this.updateRecentLeaves(leaf);
            })
        );

        this.createFAB();

        const initDelay = Platform.isMobile ? 500 : 0;
        setTimeout(() => {
            const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
            if (activeLeaf) this.updateRecentLeaves(activeLeaf);
        }, initDelay);

        // Use resize observer for more reliable orientation change detection
        this.registerDomEvent(window, 'resize', this.handleResize.bind(this));
        // Initial check in case orientation is already landscape
        this.handleResize();
    }

    onunload() {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
        this.removeGlobalListeners();
        this.fabElement?.remove();
        this.fabElement = null;
        this.recentLeaves = [];
    }

    // --- Settings Management ---
    async loadSettings() {
        // Load settings, merging with new orientation-specific defaults
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        // Basic migration check from previous dual-position structure
        if ((this.settings as any).fabPositionLeft && !this.settings.posPortraitLeft) {
             this.settings.posPortraitLeft = { ...(this.settings as any).fabPositionLeft };
             this.settings.posPortraitRight = { ...(this.settings as any).fabPositionRight };
             this.settings.activeIndexPortrait = (this.settings as any).activePositionIndex ?? 1;
             // Set landscape defaults or copy portrait? Let's use defaults for simplicity.
             this.settings.posLandscapeLeft = { ...DEFAULT_SETTINGS.posLandscapeLeft };
             this.settings.posLandscapeRight = { ...DEFAULT_SETTINGS.posLandscapeRight };
             this.settings.activeIndexLandscape = DEFAULT_SETTINGS.activeIndexLandscape;
             // Delete old keys
             delete (this.settings as any).fabPositionLeft;
             delete (this.settings as any).fabPositionRight;
             delete (this.settings as any).activePositionIndex;
             await this.saveSettings();
         }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // --- FAB Creation and Styling ---
    createFAB() {
        this.fabElement = document.createElement('button');
        this.fabElement.id = 'recent-tab-fab';
        this.fabElement.setAttribute('aria-label', 'Jump to recent tab (Long press 1s to switch side)');
        this.fabElement.addClasses(['view-action', 'clickable-icon']);
        setIcon(this.fabElement, 'arrow-left-right');

        this.applyFabStyles(); // Apply appearance styles first
        this.applyPosition(); // Apply initial position based on current orientation/index

        // --- Event Listeners ---
        this.registerDomEvent(this.fabElement, 'mousedown', this.onPointerDown.bind(this));
        this.registerDomEvent(this.fabElement, 'touchstart', this.onPointerDown.bind(this), { passive: false });

        // Click listener (Fallback ONLY - less important now)
        this.registerDomEvent(this.fabElement, 'click', (event) => {
            if (this.isDragging) return; // Ignore clicks after dragging
        });

        document.body.appendChild(this.fabElement);
    }

    applyFabStyles() {
        if (!this.fabElement) return;
        // Set CSS variables for size and opacity
        this.fabElement.style.setProperty('--fab-actual-size', `${this.settings.fabSize}px`);
        this.fabElement.style.setProperty('--fab-actual-opacity', `${this.settings.fabOpacity}`);
    }

    // --- Orientation Helper ---
    isLandscape(): boolean {
        return window.innerWidth > window.innerHeight;
    }

    // Apply position based on current orientation and ACTIVE index
    applyPosition() {
        if (!this.fabElement) return;

        const landscape = this.isLandscape();
        const activeIndex = landscape ? this.settings.activeIndexLandscape : this.settings.activeIndexPortrait;
        const activePosition = activeIndex === 0
            ? (landscape ? this.settings.posLandscapeLeft : this.settings.posPortraitLeft)
            : (landscape ? this.settings.posLandscapeRight : this.settings.posPortraitRight);

        // Use the stored percentage values from settings
        const topPercent = parseFloat(activePosition.top) || 0;
        const leftPercent = parseFloat(activePosition.left) || 0;
        const fabSize = this.settings.fabSize;

        // Calculate target pixel positions (top-left corner) based on percentages
        let targetTop = (topPercent / 100) * window.innerHeight;
        let targetLeft = (leftPercent / 100) * window.innerWidth;

        // Clamp pixel values within viewport bounds
        const clampedTop = Math.max(0, Math.min(targetTop, window.innerHeight - fabSize));
        const clampedLeft = Math.max(0, Math.min(targetLeft, window.innerWidth - fabSize));

        // Apply final positions using CSS variables
        this.fabElement.style.setProperty('--fab-top', `${clampedTop}px`);
        this.fabElement.style.setProperty('--fab-left', `${clampedLeft}px`);
    }


    // --- Pointer Down Handler ---
    onPointerDown(event: MouseEvent | TouchEvent) {
        if (!this.fabElement || this.pointerDownHandled) return;
        this.pointerDownHandled = true;

        this.isDragging = false;
        if (this.longPressTimer) clearTimeout(this.longPressTimer);

        // Get initial position from computed style (which uses CSS vars)
        const computedStyle = window.getComputedStyle(this.fabElement);
        this.fabInitialX = parseFloat(computedStyle.left); // Pixels
        this.fabInitialY = parseFloat(computedStyle.top);  // Pixels

        if (event instanceof MouseEvent) {
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
            document.addEventListener('mousemove', this.onPointerMove);
            document.addEventListener('mouseup', this.onPointerUp);
        } else { // TouchEvent
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
                this.handleLongPress();
            }
            this.longPressTimer = null; // Mark timer as handled
        }, 1000);
    }

    // --- Pointer Move Handler ---
    onPointerMove = (event: MouseEvent | TouchEvent) => {
        if (!this.pointerDownHandled) return;

        let currentX: number, currentY: number;
        if (event instanceof MouseEvent) {
            currentX = event.clientX;
            currentY = event.clientY;
        } else {
            if (event.touches.length === 0) return; // Handle edge case where touch ends unexpectedly
            currentX = event.touches[0].clientX;
            currentY = event.touches[0].clientY;
        }

        if (!this.isDragging) { // Check if dragging threshold met
            const deltaX = Math.abs(currentX - this.dragStartX);
            const deltaY = Math.abs(currentY - this.dragStartY);
            const dragThreshold = 5;
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                if (this.longPressTimer) { // Cancel long press if dragging starts
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
                this.isDragging = true;
                this.fabElement?.classList.add('is-dragging'); // Add class to disable transitions etc.
            }
        }

        if (!this.isDragging || !this.fabElement) return; // Exit if not dragging

        if (event.type === 'touchmove') event.preventDefault();

        // Calculate and apply new position during drag
        const deltaX = currentX - this.dragStartX;
        const deltaY = currentY - this.dragStartY;
        const newX = this.fabInitialX + deltaX;
        const newY = this.fabInitialY + deltaY;
        const fabSize = this.settings.fabSize;

        // Clamp pixel values within viewport
        const clampedX = Math.max(0, Math.min(newX, window.innerWidth - fabSize));
        const clampedY = Math.max(0, Math.min(newY, window.innerHeight - fabSize));

        requestAnimationFrame(() => {
            if (this.fabElement && this.isDragging) {
                 // Use CSS variables for position updates during drag
                 this.fabElement.style.setProperty('--fab-top', `${clampedY}px`);
                 this.fabElement.style.setProperty('--fab-left', `${clampedX}px`);
            }
        });
    }

    // --- Pointer Up Handler ---
    onPointerUp = (event: MouseEvent | TouchEvent) => {
        if (!this.pointerDownHandled) return;

        const wasDragging = this.isDragging;
        const longPressTimerStillPending = !!this.longPressTimer;

        if (this.longPressTimer) { // Clear timer if it was pending (means it was a tap or short press ended by pointer up)
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // IMPORTANT: Remove dragging class *before* saving position if it was dragged,
        // so that any CSS transitions *don't* apply to the final placement adjustment.
        // However, the listener removal should happen after potential actions.
        if (wasDragging) {
            this.fabElement?.classList.remove('is-dragging');
        }

        // --- Decide action ---
        if (wasDragging) {
            // Drag completed: Save position (calculates final pixels and converts to % for storage)
            this.saveDraggedPosition();
        } else if (longPressTimerStillPending) {
            // Timer was cleared by this pointerUp -> TAP/Click action
            this.jumpToRecentTab();
        } else {
            // Timer was already null (fired or cancelled by drag) AND not dragging -> Long press completed action already happened in handleLongPress
            // No action needed here for the long press case itself.
        }

        this.removeGlobalListeners();
        // Reset state flags AFTER potential actions
        this.isDragging = false; // Reset dragging state
        this.pointerDownHandled = false;
    }

    // --- Save Dragged Position with Overlap Check ---
    saveDraggedPosition() {
        if (!this.fabElement) return;

        const landscape = this.isLandscape();
        const activeIndex = landscape ? this.settings.activeIndexLandscape : this.settings.activeIndexPortrait;
        const positionToUpdate = activeIndex === 0
            ? (landscape ? this.settings.posLandscapeLeft : this.settings.posPortraitLeft)
            : (landscape ? this.settings.posLandscapeRight : this.settings.posPortraitRight);
        const otherPosition = activeIndex === 1 // Get the *other* position for the current orientation
            ? (landscape ? this.settings.posLandscapeLeft : this.settings.posPortraitLeft)
            : (landscape ? this.settings.posLandscapeRight : this.settings.posPortraitRight);

        // Get final position from computed style (pixels) after drag ends
        const finalRect = this.fabElement.getBoundingClientRect();
        const finalTopPx = finalRect.top;
        const finalLeftPx = finalRect.left;

        const fabSize = this.settings.fabSize;
        const minSeparation = fabSize * 1.2; // Minimum distance between centers

        // Calculate final center position in pixels
        const finalCenterX = finalLeftPx + fabSize / 2;
        const finalCenterY = finalTopPx + fabSize / 2;

        // Calculate other position's center in pixels
        const otherTopPercent = parseFloat(otherPosition.top) || 0;
        const otherLeftPercent = parseFloat(otherPosition.left) || 0;
        const otherTargetTop = (otherTopPercent / 100) * window.innerHeight;
        const otherTargetLeft = (otherLeftPercent / 100) * window.innerWidth;
        // Clamp the *other* position's pixels for accurate comparison
        const otherClampedTopPx = Math.max(0, Math.min(otherTargetTop, window.innerHeight - fabSize));
        const otherClampedLeftPx = Math.max(0, Math.min(otherTargetLeft, window.innerWidth - fabSize));
        const otherCenterX = otherClampedLeftPx + fabSize / 2;
        const otherCenterY = otherClampedTopPx + fabSize / 2;

        // Calculate distance between centers
        const dx = finalCenterX - otherCenterX;
        const dy = finalCenterY - otherCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let finalTopPercent: number;
        let finalLeftPercent: number;
        let finalAdjustedTopPx = finalTopPx; // Start with dragged position
        let finalAdjustedLeftPx = finalLeftPx; // Start with dragged position

        if (distance < minSeparation && distance > 1) { // Check if too close (and not exactly the same spot)
            console.warn(`FAB positions too close (dist: ${distance.toFixed(1)}px). Adjusting.`);
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

            // Store the adjusted final pixel positions
            finalAdjustedTopPx = adjustedTopPx;
            finalAdjustedLeftPx = adjustedLeftPx;

             // Apply the adjusted position visually immediately using CSS variables
             // This happens *after* the is-dragging class is removed, so it might transition briefly.
             // This is generally acceptable for a final snap.
             this.fabElement.style.setProperty('--fab-top', `${finalAdjustedTopPx}px`);
             this.fabElement.style.setProperty('--fab-left', `${finalAdjustedLeftPx}px`);
        }

        // Convert final pixel positions (potentially adjusted) back to percentages for saving
        finalTopPercent = (finalAdjustedTopPx / window.innerHeight) * 100;
        finalLeftPercent = (finalAdjustedLeftPx / window.innerWidth) * 100;

        // Save the final calculated percentages
        positionToUpdate.top = `${finalTopPercent.toFixed(2)}%`;
        positionToUpdate.left = `${finalLeftPercent.toFixed(2)}%`;

        this.saveSettings(); // Save settings with the new percentage position
    }


    // --- Long Press Handler (Called ONLY by Timer) ---
    handleLongPress() {
        // Assumes !this.isDragging check was done by the timer callback
        // Timer is marked null by the callback that calls this

        const landscape = this.isLandscape();
        // Toggle the active index for the CURRENT orientation
        if (landscape) {
            this.settings.activeIndexLandscape = this.settings.activeIndexLandscape === 0 ? 1 : 0;
        } else {
            this.settings.activeIndexPortrait = this.settings.activeIndexPortrait === 0 ? 1 : 0;
        }

        // Apply the *other* position (for the current orientation) visually
        // This will now use the CSS transition defined in styles.css
        this.applyPosition();

        // Save the updated settings (saves the new active index)
        this.saveSettings();

        new Notice(`Switched button position!`);
        if (Platform.isMobile && navigator.vibrate) navigator.vibrate(50); // Shorter vibration

        // Let onPointerUp handle listener cleanup and state resets.
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
        // Re-apply position based on new orientation/index and dimensions
        // This will use transitions if defined in CSS
        this.applyPosition();
        // Re-apply styles like size/opacity (though usually not needed on resize)
        this.applyFabStyles();
    }

   // --- Tab History and Jumping Logic ---
   updateRecentLeaves(currentLeaf: WorkspaceLeaf) {
        if (!(currentLeaf.view instanceof MarkdownView)) return;

        // Check if the leaf's *view's* container element has zero dimensions
        // This is a more reliable check for hidden/collapsed states
        if (currentLeaf.view.containerEl.offsetWidth === 0 || currentLeaf.view.containerEl.offsetHeight === 0) return;

        const existingIndex = this.recentLeaves.findIndex(leaf => leaf === currentLeaf);
        if (existingIndex === 0) return;
        if (existingIndex > 0) this.recentLeaves.splice(existingIndex, 1);

        // Add the new leaf to the beginning
        this.recentLeaves.unshift(currentLeaf);

        // Keep only the last 2 unique leaves
        if (this.recentLeaves.length > 2) {
            this.recentLeaves = this.recentLeaves.slice(0, 2);
        }
    }

    jumpToRecentTab() {
        if (this.recentLeaves.length < 2) {
            new Notice('No previous tab available to switch to.');
            return;
        }

        // Get the currently active leaf IF it's a Markdown view
        const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;

        let targetLeaf: WorkspaceLeaf | null = null;

        // If no active markdown leaf, or active leaf is the *first* in history, jump to the *second*
        if (!activeLeaf || activeLeaf === this.recentLeaves[0]) {
            targetLeaf = this.recentLeaves[1];
        }
        // Otherwise (active leaf is likely the second, or something else), jump to the *first*
        else {
            targetLeaf = this.recentLeaves[0];
        }

        if (targetLeaf && targetLeaf !== activeLeaf) { // Ensure we have a target and it's not the current one
             try {
                this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
             } catch (error) {
                 console.error("Error switching tabs:", error);
                 new Notice('Error switching tabs. The tab might have been closed.');
                 // Clean up potentially closed leaves? Might be too complex.
             }
        } else if (targetLeaf === activeLeaf) {
            // This case should ideally not happen often with the logic above, but good to handle.
             new Notice('Already on the most recent tab.');
        } else {
            new Notice('Could not determine target tab.');
        }
        this.fabElement?.blur(); // Remove focus from FAB after action
    }
}


// --- Settings Tab Class --- (Updated for orientation-specific settings)
class RecentTabsSettingTab extends PluginSettingTab {
    plugin: RecentTabsPlugin;

    constructor(app: App, plugin: RecentTabsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Recent Tabs FAB Settings' });

        // Size and Opacity Sliders
        new Setting(containerEl)
            .setName('Button Size')
            .setDesc('Adjust the size of the floating button (in pixels).')
            .addSlider(slider => slider
                .setLimits(30, 100, 5)
                .setValue(this.plugin.settings.fabSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fabSize = value;
                    this.plugin.applyFabStyles(); // Updates CSS variable
                    // Position needs re-applying because size affects clamping
                    this.plugin.applyPosition();
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Button Opacity')
            .setDesc('Adjust the transparency of the floating button (0.1 = almost invisible, 1 = solid).')
            .addSlider(slider => slider
                .setLimits(0.1, 1, 0.05) // Finer steps for opacity
                .setValue(this.plugin.settings.fabOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fabOpacity = value;
                    this.plugin.applyFabStyles(); // Updates CSS variable
                    await this.plugin.saveSettings();
                }));

        // Reset Button - Resets ALL positions and indices
        new Setting(containerEl)
            .setName('Reset Positions')
            .setDesc('Reset all saved positions (Portrait & Landscape) and active sides to defaults.')
            .addButton(button => button
                .setButtonText('Reset All Positions')
                .setClass('mod-warning') // Add emphasis
                .onClick(async () => {
                    if (!confirm("Are you sure you want to reset all FAB positions to their defaults?")) {
                        return;
                    }
                    // Reset all position and index settings to defaults
                    this.plugin.settings.posPortraitLeft = { ...DEFAULT_SETTINGS.posPortraitLeft };
                    this.plugin.settings.posPortraitRight = { ...DEFAULT_SETTINGS.posPortraitRight };
                    this.plugin.settings.activeIndexPortrait = DEFAULT_SETTINGS.activeIndexPortrait;
                    this.plugin.settings.posLandscapeLeft = { ...DEFAULT_SETTINGS.posLandscapeLeft };
                    this.plugin.settings.posLandscapeRight = { ...DEFAULT_SETTINGS.posLandscapeRight };
                    this.plugin.settings.activeIndexLandscape = DEFAULT_SETTINGS.activeIndexLandscape;
                    await this.plugin.saveSettings(); // Save the reset values
                    // Apply the reset position and styles visually
                    this.plugin.applyPosition(); // Apply new position (will use defaults)
                    this.plugin.applyFabStyles(); // Ensure styles are correct
                    new Notice('All FAB positions reset to defaults.');
                    // No need to refresh display as positions are not shown here
                }));

         // Help text
         const helpEl = containerEl.createDiv({ cls: 'setting-item-description' }); // Use description class for spacing
         helpEl.createEl('p', { text: `Drag the button on screen to reposition it for the current screen orientation (Portrait or Landscape). The position is saved automatically.` });
         helpEl.createEl('p', { text: `Long press (hold for 1 second) the button to switch between its saved left/right positions for the current orientation.` });
         helpEl.createEl('p', { text: `Tap the button to jump to the previously active tab.` });

    }
}