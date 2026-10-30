// A request started before login or logout must not overwrite the newer session.
export function createAuthSession(request) {
  let user;
  let generation = 0;
  const listeners = new Set();
  const publish = (next) => { user = next; listeners.forEach((listener) => listener()); };
  return {
    getSnapshot: () => user,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    async refresh() {
      const current = ++generation;
      try { const data = await request("/auth/me"); if (current === generation) publish(data.user); }
      catch { if (current === generation) publish(null); }
    },
    async signIn(mode, form) {
      const current = ++generation;
      const data = await request(`/auth/${mode}`, { method: "POST", body: JSON.stringify(form) });
      if (current === generation) publish(data.user);
      return data.user;
    },
    async signOut() {
      const current = ++generation;
      await request("/auth/logout", { method: "POST" });
      if (current === generation) publish(null);
    },
    clear() { ++generation; publish(null); }
  };
}
