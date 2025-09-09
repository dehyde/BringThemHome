/**
 * StateManager System
 * Centralized state management for the application
 * Provides single source of truth with reactive updates
 */

class StateManager {
    constructor(initialState = {}, eventBus = null) {
        this.state = { ...initialState };
        this.previousState = {};
        this.subscribers = new Map();
        this.eventBus = eventBus;
        this.isDebugMode = false;
        this.stateHistory = []; // Optional state history for debugging
        this.maxHistorySize = 20;
    }

    /**
     * Get current state (returns a copy to prevent mutations)
     * @param {string} path - Optional dot-notation path to specific state property
     * @returns {*} Current state or specific property
     */
    getState(path = null) {
        if (!path) {
            return JSON.parse(JSON.stringify(this.state)); // Deep copy
        }

        // Navigate to nested property using dot notation
        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current !== undefined ? JSON.parse(JSON.stringify(current)) : undefined;
    }

    /**
     * Update state and notify subscribers
     * @param {Object|Function} updates - Object with updates or function that receives current state
     * @param {string} source - Optional source identifier for debugging
     */
    setState(updates, source = 'unknown') {
        // Store previous state for comparison
        this.previousState = JSON.parse(JSON.stringify(this.state));
        
        // Handle function updates
        if (typeof updates === 'function') {
            updates = updates(this.state);
        }
        
        if (!updates || typeof updates !== 'object') {
            console.warn('🔧 STATE-MANAGER: setState called with invalid updates:', updates);
            return;
        }

        // Apply updates (shallow merge for now, could be enhanced for deep merge)
        const newState = { ...this.state, ...updates };
        
        // Check if state actually changed
        const hasChanged = this.hasStateChanged(this.state, newState);
        
        if (!hasChanged) {
            if (this.isDebugMode) {
                console.log('🔧 STATE-MANAGER: setState called but no changes detected, skipping update');
            }
            return;
        }
        
        this.state = newState;
        
        // Add to history for debugging
        if (this.stateHistory.length >= this.maxHistorySize) {
            this.stateHistory.shift();
        }
        this.stateHistory.push({
            timestamp: Date.now(),
            source,
            changes: this.getStateChanges(this.previousState, newState),
            state: JSON.parse(JSON.stringify(newState))
        });
        
        if (this.isDebugMode) {
            console.log(`🔧 STATE-MANAGER: State updated by '${source}':`, {
                previous: this.previousState,
                current: newState,
                changes: this.getStateChanges(this.previousState, newState)
            });
        }
        
        // Notify all subscribers
        this.notifySubscribers(this.previousState, newState);
        
        // Emit state change event if EventBus is available
        if (this.eventBus) {
            this.eventBus.emit('stateChanged', {
                previous: this.previousState,
                current: newState,
                source,
                changes: this.getStateChanges(this.previousState, newState)
            });
        }
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Function called when state changes
     * @param {string|Array} watchPaths - Optional specific paths to watch
     * @param {string} subscriberId - Optional unique identifier for this subscriber
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback, watchPaths = null, subscriberId = null) {
        if (typeof callback !== 'function') {
            throw new Error('StateManager.subscribe: Callback must be a function');
        }

        const id = subscriberId || Symbol('subscriber');
        const subscription = {
            callback,
            watchPaths: Array.isArray(watchPaths) ? watchPaths : (watchPaths ? [watchPaths] : null),
            id,
            createdAt: Date.now()
        };

        this.subscribers.set(id, subscription);

        if (this.isDebugMode) {
            console.log(`🔧 STATE-MANAGER: New subscriber '${id.toString()}', total: ${this.subscribers.size}`, {
                watchPaths: subscription.watchPaths
            });
        }

        // Return unsubscribe function
        return () => this.unsubscribe(id);
    }

    /**
     * Unsubscribe from state changes
     * @param {string|Symbol} subscriberId - Subscriber ID
     */
    unsubscribe(subscriberId) {
        const removed = this.subscribers.delete(subscriberId);
        
        if (this.isDebugMode) {
            console.log(`🔧 STATE-MANAGER: Unsubscribed '${subscriberId.toString()}', success: ${removed}, remaining: ${this.subscribers.size}`);
        }
    }

    /**
     * Notify all subscribers of state changes
     * @param {Object} previousState - Previous state
     * @param {Object} newState - New state
     */
    notifySubscribers(previousState, newState) {
        const changes = this.getStateChanges(previousState, newState);
        let notifiedCount = 0;

        this.subscribers.forEach((subscription, id) => {
            try {
                // Check if subscriber is watching specific paths
                if (subscription.watchPaths) {
                    const hasRelevantChanges = subscription.watchPaths.some(path => 
                        changes.some(change => change.path.startsWith(path))
                    );
                    
                    if (!hasRelevantChanges) {
                        return; // Skip this subscriber
                    }
                }

                subscription.callback(newState, previousState, changes);
                notifiedCount++;
            } catch (error) {
                console.error(`🔧 STATE-MANAGER: Error notifying subscriber '${id.toString()}':`, error);
            }
        });

        if (this.isDebugMode) {
            console.log(`🔧 STATE-MANAGER: Notified ${notifiedCount}/${this.subscribers.size} subscribers`);
        }
    }

    /**
     * Check if state has actually changed
     * @param {Object} oldState - Previous state
     * @param {Object} newState - New state
     * @returns {boolean} True if state changed
     */
    hasStateChanged(oldState, newState) {
        return JSON.stringify(oldState) !== JSON.stringify(newState);
    }

    /**
     * Get detailed changes between two states
     * @param {Object} oldState - Previous state
     * @param {Object} newState - New state
     * @returns {Array} Array of change objects
     */
    getStateChanges(oldState, newState) {
        const changes = [];
        
        // Check for new/changed properties
        Object.keys(newState).forEach(key => {
            const oldValue = oldState[key];
            const newValue = newState[key];
            
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push({
                    path: key,
                    type: oldValue === undefined ? 'added' : 'changed',
                    oldValue: oldValue,
                    newValue: newValue
                });
            }
        });
        
        // Check for removed properties
        Object.keys(oldState).forEach(key => {
            if (!(key in newState)) {
                changes.push({
                    path: key,
                    type: 'removed',
                    oldValue: oldState[key],
                    newValue: undefined
                });
            }
        });
        
        return changes;
    }

    /**
     * Reset state to initial value
     * @param {Object} newInitialState - Optional new initial state
     * @param {string} source - Source of the reset
     */
    reset(newInitialState = {}, source = 'reset') {
        this.setState(newInitialState, source);
        this.stateHistory = [];
        
        if (this.isDebugMode) {
            console.log(`🔧 STATE-MANAGER: State reset by '${source}'`);
        }
    }

    /**
     * Get state history for debugging
     * @returns {Array} State history
     */
    getHistory() {
        return [...this.stateHistory];
    }

    /**
     * Get current subscriber count
     * @returns {number} Number of active subscribers
     */
    getSubscriberCount() {
        return this.subscribers.size;
    }

    /**
     * Get subscriber information for debugging
     * @returns {Array} Array of subscriber info
     */
    getSubscriberInfo() {
        const info = [];
        this.subscribers.forEach((subscription, id) => {
            info.push({
                id: id.toString(),
                watchPaths: subscription.watchPaths,
                createdAt: subscription.createdAt
            });
        });
        return info;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Enable debug logging
     */
    setDebugMode(enabled) {
        this.isDebugMode = enabled;
        console.log(`🔧 STATE-MANAGER: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set the EventBus instance for cross-system communication
     * @param {EventBus} eventBus - EventBus instance
     */
    setEventBus(eventBus) {
        this.eventBus = eventBus;
        if (this.isDebugMode) {
            console.log('🔧 STATE-MANAGER: EventBus connected');
        }
    }

    /**
     * Get current debug mode status
     * @returns {boolean} Debug mode status
     */
    isDebugModeEnabled() {
        return this.isDebugMode;
    }

    /**
     * Batch multiple state updates to prevent multiple notifications
     * @param {Function} updateFn - Function that performs multiple setState calls
     * @param {string} source - Source identifier
     */
    batch(updateFn, source = 'batch') {
        const originalNotify = this.notifySubscribers;
        const updates = [];
        
        // Temporarily override notifySubscribers to collect updates
        this.notifySubscribers = (prev, next) => {
            updates.push({ prev, next });
        };
        
        try {
            updateFn();
        } finally {
            // Restore original notify function
            this.notifySubscribers = originalNotify;
        }
        
        // Send single notification with all updates
        if (updates.length > 0) {
            const finalUpdate = updates[updates.length - 1];
            this.notifySubscribers(finalUpdate.prev, finalUpdate.next);
        }
        
        if (this.isDebugMode) {
            console.log(`🔧 STATE-MANAGER: Batched ${updates.length} updates from '${source}'`);
        }
    }
}

// Export for use in modules
if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}