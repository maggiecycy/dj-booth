import { useRef, useState } from 'react'

interface CustomAddProps {
  busy: boolean
  onAdd: (file: File, title: string, artist: string) => Promise<void>
  embedded?: boolean
}

export function CustomAdd({ busy, onAdd, embedded }: CustomAddProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
      setError('Pick an audio file (mp3 / wav / ogg…)')
      return
    }
    setError(null)
    try {
      await onAdd(file, title, artist)
      setTitle('')
      setArtist('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <div className={`custom-add${embedded ? ' custom-add--embedded' : ''}`}>
      <p className="custom-add__heading">Add local track</p>
      <div className="custom-add__fields">
        <input
          className="custom-add__input"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Track title"
        />
        <input
          className="custom-add__input"
          placeholder="Artist (optional)"
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
          {busy ? 'Decoding…' : '+ Add track'}
        </label>
      </div>
      {error && (
        <p className="custom-add__error" role="alert">
          {error}
        </p>
      )}
      <p className="custom-add__hint">
        Stored locally in IndexedDB · delete or reorder in track list
      </p>
    </div>
  )
}
