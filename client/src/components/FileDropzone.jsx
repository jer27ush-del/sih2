import { useState } from 'react';
import { formatSize } from '../format.js';

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;

export default function FileDropzone({ files, onChange }) {
  const [error, setError] = useState('');

  function addFiles(incoming) {
    setError('');
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Only PDF, JPG and PNG files are allowed.');
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        setError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push(file);
    }
    onChange(next);
  }

  function removeFile(index) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-500"
      >
        <span className="font-medium">Drag and drop files here, or click to browse</span>
        <span className="mt-1 text-xs text-slate-500">PDF, JPG or PNG · up to 5 MB each · max {MAX_FILES} files</span>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-200 rounded-md bg-white ring-1 ring-slate-200">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {file.name} <span className="text-slate-500">({formatSize(file.size)})</span>
              </span>
              <button type="button" onClick={() => removeFile(index)} className="text-slate-500 hover:text-red-700">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
