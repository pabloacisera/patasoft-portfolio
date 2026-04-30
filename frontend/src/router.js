export const router = {
  routes: {},

  navigate(path, push = true) {
    if (push) history.pushState(null, '', path);
    return this.handle(path);
  },

  async handle(path) {
    let route = this.routes[path];

    if (!route) {
      const prefix = Object.keys(this.routes).find(r => path.startsWith(r) && r !== '/');
      route = prefix ? this.routes[prefix] : this.routes['/404'];
    }

    if (!route) return;

    const app = document.getElementById('app');
    if (!app) {
      await new Promise(r => setTimeout(r, 0));
      return this.handle(path);
    }

    app.innerHTML = '';
    await route.render();
  },

  register(path, route) {
    this.routes[path] = route;
  }
};