/**
 * EventBus System
 * Provides decoupled communication between components
 * Eliminates tight coupling and direct property access
 */

class EventBus {
    constructor() {
        this.events = new Map();
        this.isDebugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function
     * @param {Object} context - Optional context for callback
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('EventBus.on: Callback must be a function');
        }

        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        const subscription = {
            callback,
            context,
            id: Symbol(eventName) // Unique identifier for this subscription
        };

        this.events.get(eventName).push(subscription);

        if (this.isDebugMode) {
            console.log(`🎯 EVENT-BUS: Subscribed to '${eventName}', total listeners: ${this.events.get(eventName).length}`);
        }

        // Return unsubscribe function
        return () => this.off(eventName, subscription.id);
    }

    /**
     * Subscribe to an event that auto-unsubscribes after first trigger
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback function
     * @param {Object} context - Optional context for callback
     * @returns {Function} Unsubscribe function
     */
    once(eventName, callback, context = null) {
        const unsubscribe = this.on(eventName, (data) => {
            unsubscribe(); // Auto unsubscribe
            if (context) {
                callback.call(context, data);
            } else {
                callback(data);
            }
        }, context);

        return unsubscribe;
    }

    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Name of the event
     * @param {*} data - Data to pass to subscribers
     * @returns {boolean} True if event had listeners
     */
    emit(eventName, data = null) {
        if (!this.events.has(eventName)) {
            if (this.isDebugMode) {
                console.warn(`🎯 EVENT-BUS: No listeners for '${eventName}'`);
            }
            return false;
        }

        const subscribers = this.events.get(eventName);
        let successCount = 0;

        if (this.isDebugMode) {
            console.log(`🎯 EVENT-BUS: Emitting '${eventName}' to ${subscribers.length} listeners`, data);
        }

        // Call each subscriber
        subscribers.forEach((subscription, index) => {
            try {
                if (subscription.context) {
                    subscription.callback.call(subscription.context, data);
                } else {
                    subscription.callback(data);
                }
                successCount++;
            } catch (error) {
                console.error(`🎯 EVENT-BUS: Error in listener ${index} for '${eventName}':`, error);
            }
        });

        if (this.isDebugMode) {
            console.log(`🎯 EVENT-BUS: Successfully called ${successCount}/${subscribers.length} listeners for '${eventName}'`);
        }

        return successCount > 0;
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {Symbol|Function} identifier - Subscription ID or callback function
     */
    off(eventName, identifier) {
        if (!this.events.has(eventName)) {
            return;
        }

        const subscribers = this.events.get(eventName);
        let removedCount = 0;

        // Remove by Symbol ID or by callback function
        for (let i = subscribers.length - 1; i >= 0; i--) {
            const subscription = subscribers[i];
            if (subscription.id === identifier || subscription.callback === identifier) {
                subscribers.splice(i, 1);
                removedCount++;
                break; // Only remove first match for callback functions
            }
        }

        // Clean up empty event arrays
        if (subscribers.length === 0) {
            this.events.delete(eventName);
        }

        if (this.isDebugMode) {
            console.log(`🎯 EVENT-BUS: Removed ${removedCount} listener(s) from '${eventName}', remaining: ${subscribers.length}`);
        }
    }

    /**
     * Remove all listeners for an event, or all events if no event specified
     * @param {string} eventName - Optional event name, if not provided clears all
     */
    clear(eventName = null) {
        if (eventName) {
            this.events.delete(eventName);
            if (this.isDebugMode) {
                console.log(`🎯 EVENT-BUS: Cleared all listeners for '${eventName}'`);
            }
        } else {
            const eventCount = this.events.size;
            this.events.clear();
            if (this.isDebugMode) {
                console.log(`🎯 EVENT-BUS: Cleared all ${eventCount} events`);
            }
        }
    }

    /**
     * Get list of events and their listener counts
     * @returns {Object} Object with event names and listener counts
     */
    getEventStats() {
        const stats = {};
        this.events.forEach((subscribers, eventName) => {
            stats[eventName] = subscribers.length;
        });
        return stats;
    }

    /**
     * Check if an event has listeners
     * @param {string} eventName - Name of the event
     * @returns {boolean} True if event has listeners
     */
    hasListeners(eventName) {
        return this.events.has(eventName) && this.events.get(eventName).length > 0;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Enable debug logging
     */
    setDebugMode(enabled) {
        this.isDebugMode = enabled;
        console.log(`🎯 EVENT-BUS: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get current debug mode status
     * @returns {boolean} Debug mode status
     */
    isDebugModeEnabled() {
        return this.isDebugMode;
    }
}

// Export for use in modules
if (typeof window !== 'undefined') {
    window.EventBus = EventBus;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
}