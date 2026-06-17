export function createSearchBar(options) {
  const { placeholder = 'Buscar...', onSearch, debounce = 300, initialValue = '', clearable = true, showButton = true } = options;
  let debounceTimer = null;

  const container = document.createElement('div');
  container.className = 'search-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = placeholder;
  input.value = initialValue;

  if (showButton) {
    const button = document.createElement('button');
    button.className = 'search-button';
    button.replaceChildren();
    button.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 2.5 9.5 2.5S3 5.91 3 9.5 6.91 16 10.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>');
    button.type = 'button';
    container.appendChild(button);

    button.addEventListener('click', () => {
      const value = input.value.trim();
      if (value || clearable) {
        handleSearch(value);
      }
    });
  }

  if (clearable && initialValue) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-clear';
    clearBtn.replaceChildren();
    clearBtn.insertAdjacentHTML('beforeend', '&times;');
    clearBtn.type = 'button';
    clearBtn.style.display = 'inline-flex';
    container.appendChild(clearBtn);

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      handleSearch('');
    });
  }

  container.appendChild(input);

  input.addEventListener('input', () => {
    if (clearable) {
      const clearBtn = container.querySelector('.search-clear');
      if (clearBtn) {
        clearBtn.style.display = input.value ? 'inline-flex' : 'none';
      }
    }
    if (onSearch) {
      handleSearch(input.value.trim());
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const value = input.value.trim();
      if (onSearch) {
        if (debounce > 0 && debounceTimer) {
          clearTimeout(debounceTimer);
        }
        onSearch(value);
      }
    }

    if (e.key === 'Escape') {
      input.value = '';
      if (onSearch) onSearch('');
    }
  });

  function handleSearch(value) {
    if (debounce > 0) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        if (onSearch) onSearch(value);
        debounceTimer = null;
      }, debounce);
    } else {
      if (onSearch) onSearch(value);
    }
  }

  if (initialValue && onSearch && debounce === 0) {
    onSearch(initialValue);
  }

  container.getValue = () => input.value.trim();
  container.setValue = (value) => {
    input.value = value || '';
    const clearBtn = container.querySelector('.search-clear');
    if (clearBtn) {
      clearBtn.style.display = value ? 'inline-flex' : 'none';
    }
  };
  container.clear = () => {
    input.value = '';
    const clearBtn = container.querySelector('.search-clear');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
    if (onSearch) onSearch('');
  };
  container.focus = () => input.focus();

  return container;
}

export function renderSearchBar(options) {
  return createSearchBar(options);
}

export default { createSearchBar, renderSearchBar };
