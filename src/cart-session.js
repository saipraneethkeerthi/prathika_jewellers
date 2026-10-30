// One instance per authenticated owner. Guest bags exist only in memory.
export function createCartSession(request, ownerId) {
  let snapshot = { items: [], loading: ownerId !== null, saving: false, error: "" };
  let committed = [];
  let revision = 0;
  let generation = 0;
  let disposed = false;
  let tail = Promise.resolve();
  const listeners = new Set();
  const publish = (patch) => { snapshot = { ...snapshot, ...patch }; listeners.forEach((listener) => listener()); };
  const change = (update) => {
    if (disposed || snapshot.loading) return Promise.resolve();
    const items = update(snapshot.items);
    if (items === snapshot.items) return Promise.resolve();
    if (items.length > 30) { publish({ error: "Your bag can contain up to 30 different products." }); return Promise.resolve(); }
    const current = ++revision;
    publish({ items, saving: Boolean(ownerId), error: "" });
    if (!ownerId) return Promise.resolve();
    tail = tail.then(async () => {
      if (disposed) return;
      try {
        await request("/cart", { method: "PUT", headers: { "X-Cart-Owner": ownerId }, body: JSON.stringify({ items: items.map((item) => ({ productId: item._id, quantity: item.quantity })) }) });
        committed = items;
        if (!disposed && revision === current) publish({ saving: false });
      } catch (error) {
        if (!disposed && revision === current) publish({ items: committed, saving: false, error: `Your bag could not be saved. ${error.message}` });
      }
    });
    return tail;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    async load() {
      disposed = false;
      const current = ++generation;
      if (ownerId === undefined) return;
      if (ownerId === null) { publish({ loading: false }); return; }
      try {
        const data = await request("/cart");
        if (!disposed && current === generation) { committed = data.items; publish({ items: committed, loading: false, error: "" }); }
      } catch (error) {
        if (!disposed && current === generation) publish({ loading: true, error: `Your bag could not be loaded. ${error.message}` });
      }
    },
    dispose() { disposed = true; ++generation; },
    add(product, quantity = 1) {
      if (product.stock <= 0) return;
      change((items) => {
        const found = items.find((item) => item._id === product._id);
        return found ? items.map((item) => item._id === product._id ? { ...product, quantity: Math.min(20, product.stock, item.quantity + quantity) } : item) : [...items, { ...product, quantity: Math.min(20, product.stock, quantity) }];
      });
    },
    setQuantity(id, quantity) { change((items) => items.map((item) => item._id === id ? { ...item, quantity: Math.min(20, item.stock, Math.max(1, quantity)) } : item)); },
    remove(id) { change((items) => items.filter((item) => item._id !== id)); },
    clear() { return change(() => []); },
    // Useful for checkout and for testing ordered persistence.
    settled: () => tail
  };
}
