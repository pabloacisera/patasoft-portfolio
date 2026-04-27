export function createFileUpload(options) {
  const { 
    accept = '*',
    maxSize = 10 * 1024 * 1024,
    maxFiles = 5,
    multiple = true,
    preview = true,
    onFilesSelected,
    onError,
    label = 'Arrastra archivos aquí o haz clic para seleccionar',
    disabled = false,
  } = options;

  let files = [];
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = multiple;
  input.style.display = 'none';
  if (disabled) input.disabled = true;

  const container = document.createElement('div');
  container.className = `file-upload ${disabled ? 'disabled' : ''}`;

  const dropZone = document.createElement('div');
  dropZone.className = 'file-upload-dropzone';
  dropZone.innerHTML = `
    <div class="file-upload-icon">
      <svg viewBox="0 0 24 24" width="48" height="48">
        <path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
      </svg>
    </div>
    <div class="file-upload-label">${label}</div>
  `;

  const previewContainer = document.createElement('div');
  previewContainer.className = 'file-upload-preview';
  container.appendChild(input);
  container.appendChild(dropZone);
  container.appendChild(previewContainer);

  if (!disabled) {
    dropZone.addEventListener('click', () => input.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    input.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      input.value = '';
    });
  }

  function handleFiles(newFiles) {
    const validFiles = [];
    const errors = [];

    Array.from(newFiles).forEach(file => {
      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`${file.name}: Máximo ${maxFiles} archivos`);
        return;
      }

      const ext = file.name.split('.').pop().toLowerCase();
      const allowedTypes = accept.split(',').map(t => t.trim().toLowerCase().replace('.', ''));
      
      if (accept !== '*' && !allowedTypes.some(allowed => allowed === ext || allowed === '*')) {
        errors.push(`${file.name}: Tipo no permitido`);
        return;
      }

      if (file.size > maxSize) {
        errors.push(`${file.name}: exceeds ${formatSize(maxSize)}`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0 && onError) {
      onError(errors);
    }

    if (validFiles.length > 0) {
      files = [...files, ...validFiles];
      renderPreviews();
      if (onFilesSelected) {
        onFilesSelected(files);
      }
    }
  }

  function renderPreviews() {
    previewContainer.innerHTML = '';

    if (preview && files.length > 0) {
      files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-upload-item';

        if (file.type.startsWith('image/') && preview) {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          img.className = 'file-upload-thumbnail';
          item.appendChild(img);
        } else {
          const icon = document.createElement('div');
          icon.className = 'file-upload-icon-small';
          icon.textContent = file.name.split('.').pop().toUpperCase();
          item.appendChild(icon);
        }

        const info = document.createElement('div');
        info.className = 'file-upload-info';
        info.innerHTML = `
          <div class="file-upload-name">${file.name}</div>
          <div class="file-upload-size">${formatSize(file.size)}</div>
        `;
        item.appendChild(info);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-upload-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeFile(index);
        });
        item.appendChild(removeBtn);

        previewContainer.appendChild(item);
      });
    }
  }

  function removeFile(index) {
    files.splice(index, 1);
    renderPreviews();
    if (onFilesSelected) {
      onFilesSelected(files);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  container.getFiles = () => [...files];
  container.setFiles = (newFiles) => {
    files = [...newFiles];
    renderPreviews();
  };
  container.clear = () => {
    files = [];
    renderPreviews();
  };
  container.addFiles = (newFiles) => handleFiles(newFiles);

  return container;
}

export function renderFileUpload(options) {
  return createFileUpload(options);
}

export default { createFileUpload, renderFileUpload };