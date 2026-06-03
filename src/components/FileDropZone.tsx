import React, { useRef, useCallback, useState, type DragEvent } from 'react';

interface FileDropZoneProps {
  onFileLoad: (file: File) => void;
  onDirectoryLoad: (files: File[]) => void;
}

const ACCEPTED = ['.urdf', '.xacro', '.stl', '.obj', '.dae', '.glb', '.gltf'];

/** Recursively read all files from a FileSystemDirectoryEntry */
async function readDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const files: File[] = [];
  const reader = entry.createReader();

  const readBatch = async (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  };

  // readEntries may not return all entries in one call (spec allows partial reads)
  let entries: FileSystemEntry[];
  do {
    entries = await readBatch();
    for (const entry of entries) {
      if (entry.isFile) {
        files.push(await getFile(entry as FileSystemFileEntry));
      } else if (entry.isDirectory) {
        const subFiles = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
        files.push(...subFiles);
      }
    }
  } while (entries.length > 0);

  return files;
}

/** Get a File object from a FileSystemFileEntry */
async function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

export default function FileDropZone({ onFileLoad, onDirectoryLoad }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [isDirectoryDrag, setIsDirectoryDrag] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
    // Check if any entry is a directory
    const items = e.dataTransfer?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          setIsDirectoryDrag(true);
          return;
        }
      }
    }
    setIsDirectoryDrag(false);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
    setIsDirectoryDrag(false);
  }, []);

  const processFile = useCallback(
    (file: File) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (ACCEPTED.includes(ext)) {
        onFileLoad(file);
      }
    },
    [onFileLoad]
  );

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      setIsDirectoryDrag(false);

      const items = e.dataTransfer?.items;
      if (!items) return;

      // Check if it's a directory drop
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          const dirFiles = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
          if (dirFiles.length > 0) {
            onDirectoryLoad(dirFiles);
          }
          return;
        }
      }

      // Regular file drop
      const file = e.dataTransfer?.files?.[0];
      if (file) processFile(file);
    },
    [processFile, onDirectoryLoad]
  );

  const handleFileClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleDirClick = useCallback(() => dirInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFile]
  );

  const handleDirChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (fileList && fileList.length > 0) {
        const files: File[] = [];
        for (let i = 0; i < fileList.length; i++) {
          files.push(fileList[i]);
        }
        onDirectoryLoad(files);
      }
      if (dirInputRef.current) dirInputRef.current.value = '';
    },
    [onDirectoryLoad]
  );

  return (
    <>
      {dragOver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-blue-400 bg-blue-900/20 backdrop-blur-sm"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-300">
              {isDirectoryDrag ? 'Drop your model folder' : 'Drop your model file'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {isDirectoryDrag
                ? 'Folder containing URDF/Xacro + meshes'
                : 'URDF, Xacro, STL, OBJ, DAE, GLB, GLTF'}
            </p>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={dirInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
        onChange={handleDirChange}
        className="hidden"
      />
      <div className="fixed bottom-6 right-6 z-40 flex gap-2">
        <button
          onClick={handleDirClick}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-emerald-500"
        >
          Load Folder
        </button>
        <button
          onClick={handleFileClick}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-blue-500"
        >
          Load File
        </button>
      </div>
    </>
  );
}
