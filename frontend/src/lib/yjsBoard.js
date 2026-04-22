import { useCallback, useRef, useSyncExternalStore } from "react";

export const BOARD_COMMIT_ORIGIN = "fusionboard:board-commit";
export const BOARD_META_ORIGIN = "fusionboard:board-meta";
export const BOARD_BOOTSTRAP_ORIGIN = "fusionboard:board-bootstrap";
export const BOARD_CLEAR_ORIGIN = "fusionboard:board-clear";

const INTERACTIVE_ELEMENT_TYPES = new Set(["text", "code", "video", "graph", "sticky"]);

function cloneValue(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function isInteractiveElementType(type) {
    return INTERACTIVE_ELEMENT_TYPES.has(type);
}

function repairElementOrder(elementsById, elementOrder) {
    const seen = new Set();
    const nextOrder = [];

    elementOrder.toArray().forEach((id) => {
        if (!id || seen.has(id) || !elementsById.has(id)) return;
        seen.add(id);
        nextOrder.push(id);
    });

    elementsById.forEach((_, id) => {
        if (!seen.has(id)) {
            seen.add(id);
            nextOrder.push(id);
        }
    });

    const currentOrder = elementOrder.toArray();
    const needsRepair =
        currentOrder.length !== nextOrder.length ||
        currentOrder.some((id, index) => id !== nextOrder[index]);

    if (needsRepair) {
        elementOrder.delete(0, elementOrder.length);
        if (nextOrder.length > 0) {
            elementOrder.insert(0, nextOrder);
        }
    }

    return nextOrder;
}

function deriveOrderedIds(elementsById, elementOrder) {
    const seen = new Set();
    const nextOrder = [];

    elementOrder.toArray().forEach((id) => {
        if (!id || seen.has(id) || !elementsById.has(id)) return;
        seen.add(id);
        nextOrder.push(id);
    });

    elementsById.forEach((_, id) => {
        if (!seen.has(id)) {
            seen.add(id);
            nextOrder.push(id);
        }
    });

    return nextOrder;
}

export function ensureBoardSchema(doc) {
    const elementsById = doc.getMap("elementsById");
    const elementOrder = doc.getArray("elementOrder");
    const meta = doc.getMap("meta");
    const legacyElements = doc.getMap("elements");

    const needsLegacyMigration =
        elementsById.size === 0 &&
        elementOrder.length === 0 &&
        legacyElements.size > 0;

    if (needsLegacyMigration) {
        doc.transact(() => {
            legacyElements.forEach((value, id) => {
                if (!value?.id) return;
                elementsById.set(id, cloneValue(value));
            });
            repairElementOrder(elementsById, elementOrder);
            legacyElements.clear();
            meta.set("schemaVersion", 2);
            meta.set("bootstrappedAt", Date.now());
        }, BOARD_BOOTSTRAP_ORIGIN);
    } else if (elementOrder.length === 0 && elementsById.size > 0) {
        doc.transact(() => {
            repairElementOrder(elementsById, elementOrder);
            if (!meta.has("schemaVersion")) {
                meta.set("schemaVersion", 2);
            }
        }, BOARD_BOOTSTRAP_ORIGIN);
    } else if (!meta.has("schemaVersion")) {
        doc.transact(() => {
            meta.set("schemaVersion", 2);
        }, BOARD_BOOTSTRAP_ORIGIN);
    }

    return {
        doc,
        elementsById,
        elementOrder,
        meta,
    };
}

export function createBoardActions({ doc, elementsById, elementOrder, meta }) {
    function insertIntoOrder(id, index = null) {
        const currentOrder = elementOrder.toArray();
        if (currentOrder.includes(id)) return;

        const insertIndex =
            typeof index === "number"
                ? Math.max(0, Math.min(index, currentOrder.length))
                : currentOrder.length;
        elementOrder.insert(insertIndex, [id]);
    }

    function removeFromOrder(ids) {
        if (!ids.length || elementOrder.length === 0) return;
        const deleteSet = new Set(ids);
        const currentOrder = elementOrder.toArray();
        const nextOrder = currentOrder.filter((id) => !deleteSet.has(id));
        if (nextOrder.length === currentOrder.length) return;
        elementOrder.delete(0, elementOrder.length);
        if (nextOrder.length > 0) {
            elementOrder.insert(0, nextOrder);
        }
    }

    function normalizeElement(element) {
        const next = cloneValue(element);
        return next;
    }

    return {
        transact(callback, origin = BOARD_COMMIT_ORIGIN) {
            doc.transact(callback, origin);
        },
        getElement(id) {
            const value = elementsById.get(id);
            return value ? cloneValue(value) : null;
        },
        getOrderedIds() {
            return elementOrder.toArray();
        },
        createElement(element, { index = null, origin = BOARD_COMMIT_ORIGIN } = {}) {
            if (!element?.id) return;
            doc.transact(() => {
                elementsById.set(element.id, normalizeElement(element));
                insertIntoOrder(element.id, index);
            }, origin);
        },
        updateElement(id, updater, { origin = BOARD_COMMIT_ORIGIN } = {}) {
            if (!id) return null;
            let nextElement = null;
            doc.transact(() => {
                const current = elementsById.get(id);
                if (!current) return;
                const draft = cloneValue(current);
                const resolved =
                    typeof updater === "function"
                        ? updater(draft)
                        : { ...draft, ...cloneValue(updater) };
                if (!resolved?.id) {
                    resolved.id = id;
                }
                nextElement = normalizeElement(resolved);
                elementsById.set(id, nextElement);
                insertIntoOrder(id);
            }, origin);
            return nextElement ? cloneValue(nextElement) : null;
        },
        updateElements(entries, { origin = BOARD_COMMIT_ORIGIN } = {}) {
            if (!Array.isArray(entries) || entries.length === 0) return [];
            const nextElements = [];
            doc.transact(() => {
                entries.forEach((entry) => {
                    if (!entry?.id) return;
                    const next = normalizeElement(entry);
                    elementsById.set(entry.id, next);
                    insertIntoOrder(entry.id);
                    nextElements.push(next);
                });
            }, origin);
            return nextElements.map((entry) => cloneValue(entry));
        },
        deleteElement(id, { origin = BOARD_COMMIT_ORIGIN } = {}) {
            if (!id) return;
            doc.transact(() => {
                elementsById.delete(id);
                removeFromOrder([id]);
            }, origin);
        },
        deleteElements(ids, { origin = BOARD_COMMIT_ORIGIN } = {}) {
            const validIds = Array.from(new Set((ids || []).filter(Boolean)));
            if (validIds.length === 0) return;
            doc.transact(() => {
                validIds.forEach((id) => elementsById.delete(id));
                removeFromOrder(validIds);
            }, origin);
        },
        replaceAll(elements, { origin = BOARD_COMMIT_ORIGIN } = {}) {
            doc.transact(() => {
                elementsById.clear();
                elementOrder.delete(0, elementOrder.length);
                (elements || []).forEach((element) => {
                    if (!element?.id) return;
                    elementsById.set(element.id, normalizeElement(element));
                    elementOrder.push([element.id]);
                });
            }, origin);
        },
        clearBoard({ origin = BOARD_CLEAR_ORIGIN } = {}) {
            doc.transact(() => {
                elementsById.clear();
                if (elementOrder.length > 0) {
                    elementOrder.delete(0, elementOrder.length);
                }
            }, origin);
        },
        setMeta(key, value, { origin = BOARD_META_ORIGIN } = {}) {
            if (!key) return;
            doc.transact(() => {
                meta.set(key, cloneValue(value));
            }, origin);
        },
        deleteMeta(key, { origin = BOARD_META_ORIGIN } = {}) {
            if (!key) return;
            doc.transact(() => {
                meta.delete(key);
            }, origin);
        },
    };
}

export function createBoardStore({ elementsById, elementOrder, meta }) {
    const allListeners = new Set();
    const orderListeners = new Set();
    const interactiveListeners = new Set();
    const changeListeners = new Set();
    const metaListeners = new Map();
    const elementListeners = new Map();

    const elements = new Map();
    const metaState = new Map();

    let orderedIds = [];
    let interactiveIds = [];
    let version = 0;

    let pendingFlush = false;
    let orderChanged = false;
    let interactiveChanged = false;
    const changedElementIds = new Set();
    const changedMetaKeys = new Set();
    const pendingChanges = [];

    function notifySet(listeners) {
        listeners.forEach((listener) => listener());
    }

    function recalculateOrder() {
        const nextOrder = deriveOrderedIds(elementsById, elementOrder);
        const nextInteractive = nextOrder.filter((id) => isInteractiveElementType(elements.get(id)?.type));

        const orderDidChange =
            orderedIds.length !== nextOrder.length ||
            orderedIds.some((id, index) => id !== nextOrder[index]);
        const interactiveDidChange =
            interactiveIds.length !== nextInteractive.length ||
            interactiveIds.some((id, index) => id !== nextInteractive[index]);

        if (orderDidChange) {
            orderedIds = nextOrder;
            orderChanged = true;
        }
        if (interactiveDidChange) {
            interactiveIds = nextInteractive;
            interactiveChanged = true;
        }
    }

    function scheduleFlush() {
        if (pendingFlush) return;
        pendingFlush = true;
        queueMicrotask(() => {
            pendingFlush = false;
            if (
                !orderChanged &&
                !interactiveChanged &&
                changedElementIds.size === 0 &&
                changedMetaKeys.size === 0 &&
                pendingChanges.length === 0
            ) {
                return;
            }

            version += 1;

            if (orderChanged) {
                notifySet(orderListeners);
            }
            if (interactiveChanged) {
                notifySet(interactiveListeners);
            }
            changedElementIds.forEach((id) => {
                const listeners = elementListeners.get(id);
                if (listeners) {
                    notifySet(listeners);
                }
            });
            changedMetaKeys.forEach((key) => {
                const listeners = metaListeners.get(key);
                if (listeners) {
                    notifySet(listeners);
                }
            });

            notifySet(allListeners);

            if (pendingChanges.length > 0) {
                const batch = pendingChanges.splice(0, pendingChanges.length);
                changeListeners.forEach((listener) => listener(batch));
            }

            orderChanged = false;
            interactiveChanged = false;
            changedElementIds.clear();
            changedMetaKeys.clear();
        });
    }

    elementsById.forEach((value, id) => {
        elements.set(id, cloneValue(value));
    });
    meta.forEach((value, key) => {
        metaState.set(key, cloneValue(value));
    });
    orderedIds = deriveOrderedIds(elementsById, elementOrder);
    interactiveIds = orderedIds.filter((id) => isInteractiveElementType(elements.get(id)?.type));

    const handleElementsChange = (event) => {
        event.changes.keys.forEach((change, id) => {
            const previous = elements.get(id);
            if (change.action === "delete") {
                elements.delete(id);
                changedElementIds.add(id);
                pendingChanges.push({ type: "delete", id });
                if (previous && isInteractiveElementType(previous.type)) {
                    interactiveChanged = true;
                }
            } else {
                const next = cloneValue(elementsById.get(id));
                if (!next) return;
                elements.set(id, next);
                changedElementIds.add(id);
                pendingChanges.push({ type: "set", id, element: next });
                if (isInteractiveElementType(previous?.type) !== isInteractiveElementType(next.type)) {
                    interactiveChanged = true;
                }
            }
        });

        recalculateOrder();
        scheduleFlush();
    };

    const handleOrderChange = () => {
        recalculateOrder();
        scheduleFlush();
    };

    const handleMetaChange = (event) => {
        event.changes.keys.forEach((change, key) => {
            if (change.action === "delete") {
                metaState.delete(key);
            } else {
                metaState.set(key, cloneValue(meta.get(key)));
            }
            changedMetaKeys.add(key);
        });
        scheduleFlush();
    };

    elementsById.observe(handleElementsChange);
    elementOrder.observe(handleOrderChange);
    meta.observe(handleMetaChange);

    return {
        destroy() {
            elementsById.unobserve(handleElementsChange);
            elementOrder.unobserve(handleOrderChange);
            meta.unobserve(handleMetaChange);
            allListeners.clear();
            orderListeners.clear();
            interactiveListeners.clear();
            changeListeners.clear();
            metaListeners.clear();
            elementListeners.clear();
        },
        subscribe(listener) {
            allListeners.add(listener);
            return () => allListeners.delete(listener);
        },
        subscribeToOrder(listener) {
            orderListeners.add(listener);
            return () => orderListeners.delete(listener);
        },
        subscribeToInteractiveIds(listener) {
            interactiveListeners.add(listener);
            return () => interactiveListeners.delete(listener);
        },
        subscribeToChanges(listener) {
            changeListeners.add(listener);
            return () => changeListeners.delete(listener);
        },
        subscribeToElement(id, listener) {
            if (!elementListeners.has(id)) {
                elementListeners.set(id, new Set());
            }
            const listeners = elementListeners.get(id);
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    elementListeners.delete(id);
                }
            };
        },
        subscribeToElements(ids, listener) {
            const cleanIds = Array.from(new Set((ids || []).filter(Boolean)));
            const cleanups = cleanIds.map((id) => this.subscribeToElement(id, listener));
            return () => cleanups.forEach((cleanup) => cleanup());
        },
        subscribeToMeta(key, listener) {
            if (!metaListeners.has(key)) {
                metaListeners.set(key, new Set());
            }
            const listeners = metaListeners.get(key);
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    metaListeners.delete(key);
                }
            };
        },
        getVersion() {
            return version;
        },
        getElement(id) {
            return elements.get(id) || null;
        },
        hasElement(id) {
            return elements.has(id);
        },
        getElementsMap() {
            return elements;
        },
        getOrderedIds() {
            return orderedIds;
        },
        getOrderedElements() {
            return orderedIds
                .map((id) => elements.get(id))
                .filter(Boolean);
        },
        getInteractiveIds() {
            return interactiveIds;
        },
        getMeta(key) {
            return metaState.get(key);
        },
    };
}

export function useBoardVersion(boardStore) {
    const subscribe = useCallback(
        (listener) => (boardStore ? boardStore.subscribe(listener) : () => { }),
        [boardStore]
    );
    const getSnapshot = useCallback(
        () => (boardStore ? boardStore.getVersion() : 0),
        [boardStore]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const EMPTY_ARRAY = [];

export function useBoardInteractiveIds(boardStore) {
    const cacheRef = useRef(EMPTY_ARRAY);
    const subscribe = useCallback(
        (listener) => (boardStore ? boardStore.subscribeToInteractiveIds(listener) : () => { }),
        [boardStore]
    );
    const getSnapshot = useCallback(
        () => {
            if (!boardStore) return EMPTY_ARRAY;
            const next = boardStore.getInteractiveIds();
            const prev = cacheRef.current;
            // The store already swaps the interactiveIds reference only when content changes,
            // but queueMicrotask can cause the swap between React render and commit.
            // Use identity check first (fast path), then shallow compare.
            if (next === prev) return prev;
            if (
                prev.length === next.length &&
                prev.every((id, i) => id === next[i])
            ) {
                return prev;
            }
            cacheRef.current = next;
            return next;
        },
        [boardStore]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useBoardElement(boardStore, id) {
    const subscribe = useCallback(
        (listener) => (boardStore && id ? boardStore.subscribeToElement(id, listener) : () => { }),
        [boardStore, id]
    );
    const getSnapshot = useCallback(
        () => (boardStore && id ? boardStore.getElement(id) : null),
        [boardStore, id]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useBoardElementsByIds(boardStore, ids) {
    const cacheRef = useRef(EMPTY_ARRAY);
    const idsRef = useRef(ids);
    const storeRef = useRef(boardStore);
    idsRef.current = ids;
    storeRef.current = boardStore;

    const subscribe = useCallback(
        (listener) => {
            const store = storeRef.current;
            const currentIds = idsRef.current;
            if (!store) return () => { };
            return store.subscribeToElements(currentIds, listener);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [boardStore, ids]
    );

    const getSnapshot = useCallback(
        () => {
            const store = storeRef.current;
            const currentIds = idsRef.current;
            if (!store || !currentIds || currentIds.length === 0) return EMPTY_ARRAY;
            const next = currentIds.map((id) => store.getElement(id)).filter(Boolean);
            const prev = cacheRef.current;
            if (
                prev.length === next.length &&
                prev.every((el, i) => el === next[i])
            ) {
                return prev;
            }
            cacheRef.current = next;
            return next;
        },
        [boardStore]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useBoardMeta(boardStore, key) {
    const cacheRef = useRef(undefined);
    const subscribe = useCallback(
        (listener) => (boardStore && key ? boardStore.subscribeToMeta(key, listener) : () => { }),
        [boardStore, key]
    );
    const getSnapshot = useCallback(
        () => {
            if (!boardStore || !key) return undefined;
            const next = boardStore.getMeta(key);
            // For primitive values, Object.is works. For objects, compare by reference.
            if (Object.is(next, cacheRef.current)) return cacheRef.current;
            cacheRef.current = next;
            return next;
        },
        [boardStore, key]
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

