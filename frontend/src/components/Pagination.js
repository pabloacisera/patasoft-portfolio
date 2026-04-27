export function renderPagination(options) {
  const { total, page, limit, onPageChange, showInfo = true } = options;

  const totalPages = Math.ceil(total / limit);
  
  if (totalPages <= 1) {
    return '';
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  let pagesHTML = '';
  
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    pagesHTML += `<button class="pagination-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      pagesHTML += `<span class="pagination-ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const active = i === page ? 'active' : '';
    pagesHTML += `<button class="pagination-btn ${active}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pagesHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    pagesHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  const infoHTML = showInfo 
    ? `<span class="pagination-info">Mostrando ${start}-${end} de ${total}</span>`
    : '';

  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= totalPages ? 'disabled' : '';

  const container = document.createElement('div');
  container.className = 'pagination';
  container.innerHTML = `
    <button class="pagination-btn pagination-prev" data-page="prev" ${prevDisabled}>
      &lt; Anterior
    </button>
    <div class="pagination-pages">
      ${pagesHTML}
    </div>
    <button class="pagination-btn pagination-next" data-page="next" ${nextDisabled}>
      Siguiente &gt;
    </button>
    ${infoHTML}
  `;

  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetPage = e.target.dataset.page;
      
      if (targetPage === 'prev' && page > 1) {
        onPageChange(page - 1);
      } else if (targetPage === 'next' && page < totalPages) {
        onPageChange(page + 1);
      } else if (targetPage !== 'prev' && targetPage !== 'next') {
        const newPage = parseInt(targetPage, 10);
        if (newPage !== page && newPage >= 1 && newPage <= totalPages) {
          onPageChange(newPage);
        }
      }
    });
  });

  return container;
}

export function createPagination(options) {
  const container = document.createElement('div');
  const pagination = renderPagination({
    ...options,
    onPageChange: (newPage) => {
      options.onPageChange(newPage);
      const newPagination = renderPagination({
        ...options,
        page: newPage,
      });
      container.innerHTML = '';
      container.appendChild(newPagination);
    }
  });
  
  container.appendChild(pagination);
  return container;
}

export function updatePagination(container, options) {
  if (!container) return;
  
  const pagination = renderPagination(options);
  container.innerHTML = '';
  container.appendChild(pagination);
}

export default { renderPagination, createPagination, updatePagination };