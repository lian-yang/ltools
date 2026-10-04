import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Window } from '@wailsio/runtime';
import { Icon } from '../components/Icon';
import * as StickyService from '../../bindings/ltools/plugins/sticky/stickyservice';
import { StickyNote } from '../../bindings/ltools/plugins/sticky/models';
import { t } from '@/i18n';

interface ColorOption {
  name: string;
  bgClass: string;
  borderClass: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

const colorOptions: ColorOption[] = [
  {
    name: 'yellow',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-300',
    textColor: '#92400E',
    bgColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  {
    name: 'pink',
    bgClass: 'bg-pink-100',
    borderClass: 'border-pink-300',
    textColor: '#9D174D',
    bgColor: '#FCE7F3',
    borderColor: '#F9A8D4',
  },
  {
    name: 'green',
    bgClass: 'bg-emerald-100',
    borderClass: 'border-emerald-300',
    textColor: '#065F46',
    bgColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  {
    name: 'blue',
    bgClass: 'bg-sky-100',
    borderClass: 'border-sky-300',
    textColor: '#0C4A6E',
    bgColor: '#DBEAFE',
    borderColor: '#7DD3FC',
  },
  {
    name: 'purple',
    bgClass: 'bg-violet-100',
    borderClass: 'border-violet-300',
    textColor: '#5B21B6',
    bgColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
];

/**
 * StickyWindow component - A colored sticky note window with editable content
 */
const StickyWindow: React.FC = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const noteId = urlParams.get('id');

  const [note, setNote] = useState<StickyNote | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [initialContent, setInitialContent] = useState<string>('');

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastSavedContentRef = useRef<string>('');
  const isContentLoadedRef = useRef<boolean>(false);

  const getColorClasses = useCallback((color: string) => {
    return colorOptions.find(c => c.name === color) || colorOptions[0];
  }, []);

  // Update body background color
  useEffect(() => {
    const currentColor = note ? getColorClasses(note.color) : colorOptions[0];
    document.body.style.backgroundColor = currentColor.bgColor;
    document.documentElement.style.backgroundColor = currentColor.bgColor;

    return () => {
      document.body.style.backgroundColor = '';
      document.documentElement.style.backgroundColor = '';
    };
  }, [note?.color, getColorClasses]);

  // Reset content loaded flag when noteId changes (window reopened)
  useEffect(() => {
    isContentLoadedRef.current = false;
    setInitialContent('');
  }, [noteId]);

  // Load note data on mount
  useEffect(() => {
    const loadNote = async () => {
      if (!noteId) {
        console.error('[StickyWindow] No note ID provided');
        return;
      }

      try {
        const noteData = await StickyService.GetNote(noteId);
        if (noteData) {
          setNote(noteData);
          lastSavedContentRef.current = noteData.content || '';
          // Store content in state to be applied when DOM is ready
          setInitialContent(noteData.content || '');
          await Window.SetTitle(t('便利贴'));
          console.log('[StickyWindow] Loaded note from backend:', noteData.id, 'content length:', noteData.content?.length || 0);
        }
      } catch (error) {
        console.error('[StickyWindow] Failed to load note:', error);
      }
    };

    loadNote();
  }, [noteId]);

  // Apply initial content when contentRef is available and note is loaded
  useEffect(() => {
    if (note && contentRef.current && !isContentLoadedRef.current) {
      const contentToApply = initialContent || note.content || '';
      console.log('[StickyWindow] Applying content to editor:', {
        contentLength: contentToApply.length,
        initialContentLength: initialContent.length,
        noteContentLength: note.content?.length || 0,
        isLoaded: isContentLoadedRef.current
      });
      contentRef.current.innerHTML = contentToApply;
      lastSavedContentRef.current = contentToApply;
      isContentLoadedRef.current = true;
      console.log('[StickyWindow] Applied content to editor, length:', contentToApply.length);
    }
  }, [note, initialContent]);

  // Save content function
  const saveContent = useCallback(async (contentToSave: string) => {
    if (!note) return;

    // Skip if content hasn't changed
    if (contentToSave === lastSavedContentRef.current) {
      return;
    }

    // CRITICAL FIX: Prevent saving empty content if we previously had content
    // This prevents race conditions during window close/reopen
    if (contentToSave === '' && lastSavedContentRef.current.length > 0) {
      console.warn('[StickyWindow] Prevented saving empty content over existing content. Last saved length:', lastSavedContentRef.current.length);
      return;
    }

    setIsSaving(true);
    try {
      await StickyService.UpdateNote({
        ...note,
        content: contentToSave,
      });
      lastSavedContentRef.current = contentToSave;
      console.log('[StickyWindow] Saved content, length:', contentToSave.length);
    } catch (error) {
      console.error('[StickyWindow] Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  }, [note]);

  // Handle input change with debounce
  const handleInput = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (contentRef.current) {
        saveContent(contentRef.current.innerHTML);
      }
    }, 500);
  }, [saveContent]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save immediately on unmount, but NOT if content is empty and we had content before
      if (contentRef.current && note) {
        const content = contentRef.current.innerHTML;
        // Prevent saving empty content over existing content
        if (content === '' && lastSavedContentRef.current.length > 0) {
          console.warn('[StickyWindow] Unmount: Prevented saving empty content over existing content');
          return;
        }
        if (content !== lastSavedContentRef.current) {
          StickyService.UpdateNote({
            ...note,
            content,
          }).catch(err => console.error('[StickyWindow] Failed to save on unmount:', err));
        }
      }
    };
  }, [note]);

  // Listen for window close event from backend
  useEffect(() => {
    const saveBeforeClose = async () => {
      console.log('[StickyWindow] Window closing event received, saving content...');
      if (contentRef.current && note) {
        const content = contentRef.current.innerHTML;
        try {
          await StickyService.UpdateNote({
            ...note,
            content,
          });
          lastSavedContentRef.current = content;
          console.log('[StickyWindow] Saved content before window close event, length:', content.length);
        } catch (error) {
          console.error('[StickyWindow] Failed to save before window close event:', error);
        }
      }
    };

    // @ts-ignore - wails may emit this event
    if (window.wails?.Events?.On) {
      // @ts-ignore
      window.wails.Events.On('window:closing', saveBeforeClose);
    }

    // Also try to intercept beforeunload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('[StickyWindow] Before unload triggered');
      if (contentRef.current && note) {
        const content = contentRef.current.innerHTML;
        // CRITICAL FIX: Prevent saving empty content if we previously had content
        if (content === '' && lastSavedContentRef.current.length > 0) {
          console.warn('[StickyWindow] BeforeUnload: Prevented saving empty content over existing content');
          return;
        }
        if (content !== lastSavedContentRef.current) {
          // Try to save synchronously or at least trigger the save
          StickyService.UpdateNote({
            ...note,
            content,
          }).catch(err => console.error('[StickyWindow] Failed to save on beforeunload:', err));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [note]);

  // Handle color change
  const handleColorChange = useCallback(async (color: string) => {
    if (!note || color === note.color) return;

    try {
      const updatedNote = { ...note, color };
      await StickyService.UpdateNote(updatedNote);
      setNote(updatedNote);
    } catch (error) {
      console.error('[StickyWindow] Failed to change color:', error);
    }
  }, [note]);

  // Handle delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!note) return;

    try {
      await StickyService.DeleteNote(note.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('[StickyWindow] Failed to delete note:', error);
    }
  }, [note]);

  // Handle close - ensure content is saved before closing
  const handleClose = useCallback(async () => {
    if (!noteId) {
      console.error('[StickyWindow] Close called but no noteId');
      return;
    }

    console.log('[StickyWindow] Closing window, preparing to save...');

    // Clear any pending save timeout and save immediately
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      console.log('[StickyWindow] Cleared pending save timeout');
    }

    // Force save content before closing, regardless of whether it changed
    // This ensures the backend has in sync
    if (contentRef.current && note) {
      const content = contentRef.current.innerHTML;
      console.log('[StickyWindow] Content to save, length:', content.length, 'preview:', content.substring(0, 100));
      console.log('[StickyWindow] Current note state:', { id: note.id, color: note.color, lastContentLength: lastSavedContentRef.current.length });

      // CRITICAL FIX: Prevent saving empty content if we previously had content
      if (content === '' && lastSavedContentRef.current.length > 0) {
        console.warn('[StickyWindow] Close: Prevented saving empty content over existing content. Keeping last saved content.');
      } else {
        try {
          // Always save to ensure backend is in sync
          const noteToSave = {
            ...note,
            content,
          };
          console.log('[StickyWindow] Calling UpdateNote with content length:', noteToSave.content.length);
          await StickyService.UpdateNote(noteToSave);
          lastSavedContentRef.current = content;
          console.log('[StickyWindow] Saved content successfully before close, length:', content.length);
        } catch (error) {
          console.error('[StickyWindow] Failed to save before close:', error);
          // Still try to close even if save failed
        }
      }
    } else {
      console.warn('[StickyWindow] Cannot save: contentRef.current=', !!contentRef.current, ', note=', !!note);
    }

    // Small delay to ensure the save operation completes
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log('[StickyWindow] Calling CloseNoteWindow');
      await StickyService.CloseNoteWindow(noteId);
    } catch (error) {
      console.error('[StickyWindow] Failed to close window:', error);
    }
  }, [noteId, note]);

  // Handle paste for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const img = document.createElement('img');
            img.src = base64;
            img.style.maxWidth = '150px';
            img.style.maxHeight = '150px';
            img.style.borderRadius = '4px';
            img.style.margin = '4px';
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          handleInput();
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, [handleInput]);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle drop for images
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          if (contentRef.current) {
            const img = document.createElement('img');
            img.src = base64;
            img.style.maxWidth = '150px';
            img.style.maxHeight = '150px';
            img.style.borderRadius = '4px';
            img.style.margin = '4px';
            contentRef.current!.appendChild(img);
          }
          handleInput();
        };
        reader.readAsDataURL(file);
      }
    }
  }, [handleInput]);

  const currentColor = note ? getColorClasses(note.color) : colorOptions[0];

  if (!note) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#f3f4f6' }}>
        <div className="text-gray-500">{t('加载中...')}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: currentColor.bgColor,
        '--wails-draggable': 'drag'
      } as React.CSSProperties}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header bar */}
      <div
        className="h-8 flex items-center justify-between px-2 shrink-0"
        style={{
          borderBottom: `1px solid ${currentColor.borderColor}`,
          '--wails-draggable': 'drag'
        } as React.CSSProperties}
      >
        {/* Color picker */}
        <div
          className="flex items-center gap-1"
          style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        >
          {colorOptions.map((color) => (
            <button
              key={color.name}
              onClick={() => handleColorChange(color.name)}
              className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 cursor-pointer ${color.bgClass}`}
              style={{
                borderColor: color.borderColor,
                boxShadow: note.color === color.name ? `0 0 0 2px ${color.textColor}` : undefined,
              }}
              title={t('切换到{color}', { color: color.name === 'yellow' ? t('黄色') : color.name === 'pink' ? t('粉色') : color.name === 'green' ? t('绿色') : color.name === 'blue' ? t('蓝色') : t('紫色') })}
            />
          ))}
        </div>

        {/* Right side buttons */}
        <div
          className="flex items-center gap-1"
          style={{ '--wails-draggable': 'no-drag' } as React.CSSProperties}
        >
          {isSaving && (
            <span className="text-xs mr-1" style={{ color: currentColor.textColor, opacity: 0.6 }}>
              {t('保存中...')}
            </span>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 rounded transition-colors cursor-pointer hover:bg-black/10"
            style={{ color: currentColor.textColor }}
            title={t("删除")}
          >
            <Icon name="trash" size={14} />
          </button>

          <button
            onClick={handleClose}
            className="p-1 rounded transition-colors cursor-pointer hover:bg-black/10"
            style={{ color: currentColor.textColor }}
            title={t("关闭")}
          >
            <Icon name="x-mark" size={14} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        ref={contentRef}
        contentEditable={true}
        onInput={handleInput}
        onPaste={handlePaste}
        className="flex-1 p-3 outline-none overflow-auto"
        style={{
          color: currentColor.textColor,
          '--wails-draggable': 'no-drag',
        } as React.CSSProperties}
        data-placeholder={t("在此输入内容... (支持粘贴图片)")}
        spellCheck={false}
      />

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="p-4 rounded-lg shadow-lg max-w-xs"
            style={{ backgroundColor: currentColor.bgColor }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center" style={{ color: currentColor.textColor }}>
              {t('确定要删除这个便利贴吗？')}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  color: currentColor.textColor,
                }}
              >
                {t('取消')}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded transition-colors bg-red-500 text-white"
              >
                {t('删除')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        *:focus {
          outline: none !important;
        }
        *:focus-visible {
          outline: none !important;
        }
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: ${currentColor.textColor};
          opacity: 0.5;
          pointer-events: none;
        }
        [contenteditable] img {
          max-width: 150px;
          max-height: 150px;
          border-radius: 4px;
          margin: 4px;
          vertical-align: middle;
        }
        [contenteditable]:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
};

export default StickyWindow;
