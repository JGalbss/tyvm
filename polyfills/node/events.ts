// ==========================================================================
// Node.js EventEmitter polyfill for tyvm
// ==========================================================================
//
// Implements the core EventEmitter API using Java collections as the
// backing store. Each event name maps to a java.util.ArrayList of listener
// functions, stored inside a java.util.HashMap.
//
// Since tyvm has no event loop or microtask queue, emit() invokes
// listeners synchronously in registration order — the same semantics
// Node.js uses for EventEmitter (which is also synchronous).
//
// Java backing classes:
//   java.util.HashMap  — maps event names to listener lists
//   java.util.ArrayList — ordered collection of listener functions
// ==========================================================================

import { HashMap } from "java:java.util.HashMap";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// Internal wrapper to track one-time listeners
// ---------------------------------------------------------------------------
// We cannot use a WeakSet or Symbol to tag once-listeners, so we wrap
// them in a small object that carries a flag.

class ListenerWrapper {
  fn: any;
  once: boolean;

  constructor(fn: any, once: boolean) {
    this.fn = fn;
    this.once = once;
  }
}

// ---------------------------------------------------------------------------
// EventEmitter
// ---------------------------------------------------------------------------

export class EventEmitter {
  // HashMap<string, ArrayList<ListenerWrapper>>
  // Each key is an event name; the value is an ordered list of wrappers.
  _events: HashMap;

  constructor() {
    this._events = new HashMap();
  }

  // ---- helpers ----------------------------------------------------------

  // Return the ArrayList for a given event, creating it if absent.
  _getOrCreate(event: string): ArrayList {
    let list: ArrayList = this._events.get(event);
    if (list === null) {
      list = new ArrayList();
      this._events.put(event, list);
    }
    return list;
  }

  // ---- public API -------------------------------------------------------

  // Register a persistent listener for `event`.
  on(event: string, listener: any): EventEmitter {
    const list: ArrayList = this._getOrCreate(event);
    const wrapper: ListenerWrapper = new ListenerWrapper(listener, false);
    list.add(wrapper);
    return this;
  }

  // Alias for on().
  addListener(event: string, listener: any): EventEmitter {
    return this.on(event, listener);
  }

  // Register a listener that fires at most once.
  once(event: string, listener: any): EventEmitter {
    const list: ArrayList = this._getOrCreate(event);
    const wrapper: ListenerWrapper = new ListenerWrapper(listener, true);
    list.add(wrapper);
    return this;
  }

  // Emit an event, calling every registered listener synchronously.
  // Accepts up to three arguments (arg1, arg2, arg3) because tyvm does
  // not support rest parameters.  Most Node.js events pass 0-3 args.
  emit(event: string, arg1: any, arg2: any, arg3: any): boolean {
    const list: ArrayList = this._events.get(event);
    if (list === null) {
      return false;
    }
    if (list.size() === 0) {
      return false;
    }

    // Snapshot the size before iterating so that listeners added during
    // emission do not fire in this round, matching Node.js behaviour.
    const size: number = list.size();

    // Collect indices of once-listeners to remove after the loop.
    // We store them in a separate ArrayList (indices in reverse order)
    // so we can remove without shifting earlier indices.
    const toRemove: ArrayList = new ArrayList();

    let i = 0;
    while (i < size) {
      const wrapper: ListenerWrapper = list.get(i);
      const fn: any = wrapper.fn;

      // Invoke the listener. Because we cannot spread args, we always
      // pass three positional arguments. Listeners that expect fewer
      // will simply ignore the extras.
      fn(arg1, arg2, arg3);

      if (wrapper.once) {
        toRemove.add(i);
      }
      i = i + 1;
    }

    // Remove once-listeners in reverse index order to keep indices stable.
    let r: number = toRemove.size() - 1;
    while (r >= 0) {
      const idx: number = toRemove.get(r);
      list.remove(idx);
      r = r - 1;
    }

    return true;
  }

  // Convenience overloads for fewer arguments.
  emitNoArgs(event: string): boolean {
    return this.emit(event, null, null, null);
  }

  emitOne(event: string, arg1: any): boolean {
    return this.emit(event, arg1, null, null);
  }

  emitTwo(event: string, arg1: any, arg2: any): boolean {
    return this.emit(event, arg1, arg2, null);
  }

  // Remove the first occurrence of `listener` for `event`.
  removeListener(event: string, listener: any): EventEmitter {
    const list: ArrayList = this._events.get(event);
    if (list === null) {
      return this;
    }

    let i = 0;
    while (i < list.size()) {
      const wrapper: ListenerWrapper = list.get(i);
      if (wrapper.fn === listener) {
        list.remove(i);
        return this;
      }
      i = i + 1;
    }
    return this;
  }

  // Alias for removeListener().
  off(event: string, listener: any): EventEmitter {
    return this.removeListener(event, listener);
  }

  // Remove all listeners for `event`, or all listeners entirely when
  // `event` is null.
  removeAllListeners(event: string): EventEmitter {
    if (event === null) {
      this._events = new HashMap();
    } else {
      this._events.remove(event);
    }
    return this;
  }

  // Return the number of listeners registered for `event`.
  listenerCount(event: string): number {
    const list: ArrayList = this._events.get(event);
    if (list === null) {
      return 0;
    }
    return list.size();
  }

  // Return a new ArrayList containing the raw listener functions (not
  // the internal wrappers) for `event`.
  listeners(event: string): ArrayList {
    const result: ArrayList = new ArrayList();
    const list: ArrayList = this._events.get(event);
    if (list === null) {
      return result;
    }

    let i = 0;
    while (i < list.size()) {
      const wrapper: ListenerWrapper = list.get(i);
      result.add(wrapper.fn);
      i = i + 1;
    }
    return result;
  }

  // Return a new ArrayList of event names that have at least one listener.
  // Note: HashMap iteration is not yet available in tyvm, so callers that
  // need this should track event names externally. This is a best-effort
  // placeholder that returns an empty list.
  eventNames(): ArrayList {
    return new ArrayList();
  }
}
