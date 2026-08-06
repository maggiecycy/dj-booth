import { useRef, useState } from 'react'

interface CustomAddProps {
  busy: boolean
  onAdd: (file: File, title: string, artist: string) => Promise<void>
  onRemoveCurrent?: () => void
  hasCurrentCustom?: boolean
}

export function CustomAdd({
  busy,
  onAdd,
  onRemoveCurrent,
  hasCurrentCustom,
}: CustomAddProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
      setError('请选择音频文件（mp3 / wav / ogg…）')
      return
    }
    setError(null)
    try {
      await onAdd(file, title, artist)
      setTitle('')
      setArtist('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败')
    }
  }

  return (
    <div className="custom-add">
      <div className="custom-add__fields">
        <input
          className="custom-add__input"
          placeholder="歌名（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Track title"
        />
        <input
          className="custom-add__input"
          placeholder="艺术家（可选）"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          aria-label="Artist"
        />
      </div>
      <div className="custom-add__actions">
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
          className="custom-add__file"
          id="custom-audio-file"
          disabled={busy}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <label htmlFor="custom-audio-file" className="btn btn--add">
          {busy ? '解码中…' : '+ 添加本地音频'}
        </label>
        {hasCurrentCustom && onRemoveCurrent && (
          <button
            type="button"
            className="btn btn--ghost-text"
            onClick={onRemoveCurrent}
          >
            移除当前
          </button>
        )}
      </div>
      {error && (
        <p className="custom-add__error" role="alert">
          {error}
        </p>
      )}
      <p className="custom-add__hint">
        文件存在本机 IndexedDB，刷新仍在；不会上传到服务器。
      </p>
    </div>
  )
}
