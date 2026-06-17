export function renderWithCleanup(container, html, setupListeners) {
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', html);
  if (setupListeners) {
    setupListeners();
  }
}
