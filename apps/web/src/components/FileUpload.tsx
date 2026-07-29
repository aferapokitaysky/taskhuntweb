'use client';

import { useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import { PaperclipIcon } from './icons/PaperclipIcon';

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  kind: string;
}

interface FileUploadProps {
  onUploaded: (file: UploadedFile) => void;
  multiple?: boolean;
  label?: string;
}

/** Кнопка "Прикрепить файл" — используется и в чате заказа, и в форме сдачи работы. */
export function FileUpload({ onUploaded, multiple = false, label = 'Прикрепить файл' }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(fileList)) {
        const asset = await uploadFile(file);
        onUploaded({ id: asset.id, originalName: file.name, mimeType: asset.mimeType, kind: asset.kind });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium
          text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
      >
        <PaperclipIcon />
        {uploading ? 'Загрузка…' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
