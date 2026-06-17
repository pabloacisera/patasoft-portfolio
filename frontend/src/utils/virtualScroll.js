export class VirtualScroll {
  constructor(options) {
    this.container = options.container;
    this.fetchPage = options.fetchPage;
    this.renderRow = options.renderRow;
    this.tableHeadHtml = options.tableHeadHtml || '';
    this.getTbody = options.getTbody || null;
    this.afterRender = options.afterRender || (() => {});
    this.pageSize = options.pageSize || 20;
    this.accumulated = [];
    this.currentPage = 0;
    this.total = 0;
    this.hasMore = true;
    this.loading = false;
    this.tableBody = null;
    this.sentinel = null;
    this.observer = null;
  }

  async init(startPage = 1) {
    if (this.tableBody) {
      this.tableBody.replaceChildren();
    } else {
      this.container.replaceChildren();
    }
    this.accumulated = [];
    this.currentPage = startPage - 1;
    this.hasMore = true;
    this.total = 0;
    this.loading = false;
    if (this.observer) this.observer.disconnect();
    await this.loadMore();
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    if (this.sentinel) this.sentinel.remove();
    this.sentinel = null;
    this.container = null;
    this.tableBody = null;
  }

  async loadMore() {
    if (this.loading || !this.hasMore) return;
    this.loading = true;
    this.currentPage++;

    try {
      const result = await this.fetchPage(this.currentPage);
      const items = result.data || [];
      const meta = result.meta || {};

      if (!items.length) {
        this.hasMore = false;
        return;
      }

      this.accumulated.push(...items);
      this.total = meta.total || this.accumulated.length;

      if (!this.tableBody) {
        if (this.getTbody) {
          this.tableBody = this.getTbody();
        }
        if (!this.tableBody) {
          this.container.insertAdjacentHTML('beforeend', '<table class="data-table" id="vs-table"><thead id="vs-thead"></thead><tbody id="vs-tbody"></tbody></table>');
          this.tableBody = document.getElementById('vs-tbody');
          const thead = document.getElementById('vs-thead');
          thead.replaceChildren();
          thead.insertAdjacentHTML('beforeend', this.tableHeadHtml);
        }
      }

      this.tableBody.insertAdjacentHTML('beforeend', items.map((item, i) => this.renderRow(item, this.accumulated.length - items.length + i)).join(''));

      if (this.total <= this.accumulated.length) {
        this.hasMore = false;
      }

      this.afterRender(this.accumulated, this.container);
    } catch (e) {
      if (e.name !== 'AbortError') {
        this.hasMore = false;
      }
    } finally {
      this.loading = false;
      this.updateSentinel();
    }
  }

  updateSentinel() {
    if (this.sentinel) this.sentinel.remove();
    if (this.hasMore) {
      this.sentinel = document.createElement('div');
      this.sentinel.className = 'scroll-sentinel';
      this.sentinel.style.cssText = 'height:1px;width:100%';
      this.container.appendChild(this.sentinel);

      if (this.observer) this.observer.disconnect();
      this.observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) this.loadMore();
      }, { rootMargin: '300px' });
      this.observer.observe(this.sentinel);
    }
  }
}
