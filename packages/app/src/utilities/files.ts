interface SaveOptions<T> {
  readonly filename: string
  readonly content: T
}

export function saveFile (options: SaveOptions<Blob>): void {
  const url = URL.createObjectURL(options.content)

  const a = document.createElement('a')
  a.href = url
  a.download = options.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}

export function saveTextFile (options: SaveOptions<string>): void {
  saveFile({
    ...options,
    content: new Blob([options.content], { type: 'text/plain' })
  })
}

interface OpenFilePickerOptions {
  readonly excludeAcceptAllOption?: boolean
  readonly multiple?: boolean
  readonly types?: ReadonlyArray<{
    readonly description?: string
    readonly accept: Record<string, readonly string[]>
  }>
}

type ShowOpenFilePicker = (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>

export async function openFiles (options?: OpenFilePickerOptions): Promise<File[]> {
  try {
    if ('showOpenFilePicker' in window && typeof window.showOpenFilePicker === 'function') {
      const showOpenFilePicker = window.showOpenFilePicker as ShowOpenFilePicker
      const handles = await showOpenFilePicker(options)
      return await Promise.all(handles.map((handle) => handle.getFile()))
    }

    return await showOpenFilePickerFallback(options)
  } catch (error) {
    // "Thrown if the user dismisses the prompt without making a selection [...]."
    if (error instanceof DOMException && error.name === 'AbortError') {
      return []
    }

    throw error
  }
}

async function showOpenFilePickerFallback (options?: OpenFilePickerOptions): Promise<File[]> {
  const multiple = options?.multiple ?? false

  const accept = options?.types?.flatMap((type) => {
    // input accept attribute is a comma-separated list of both MIME types and file extensions.
    return Object.entries(type.accept).flat()
  }).join(',') ?? ''

  return new Promise<File[]>((resolve, reject) => {
    const input = document.createElement('input')

    input.type = 'file'
    input.style.display = 'none'

    input.multiple = multiple
    input.accept = accept

    let settled = false

    const cleanup = () => {
      input.removeEventListener('change', onChange)
      window.removeEventListener('focus', onFocusReturn)
      input.remove()

      setTimeout(() => {
        if (!settled) {
          reject(new DOMException('User cancelled file picker', 'AbortError'))
        }
      }, 0)
    }

    const onChange = () => {
      settled = true

      const files = Array.from(input.files ?? [])
      cleanup()

      if (files.length === 0) {
        reject(new DOMException('No file selected', 'AbortError'))
        return
      }

      resolve(files)
    }

    // Some browsers never fire change if user cancels.
    // Use focus return heuristic as fallback signal.
    const onFocusReturn = () => {
      setTimeout(() => {
        if (!settled && (input.files == null || input.files.length === 0)) {
          cleanup()
        }
      }, 500)
    }

    input.addEventListener('change', onChange, { once: true })
    window.addEventListener('focus', onFocusReturn, { once: true })

    document.body.appendChild(input)
    input.click()
  })
}

export async function readFileAsText (file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const text = reader.result
      if (typeof text !== 'string') {
        reject(new Error('Failed to read file as text'))
        return
      }

      resolve(text)
    }

    reader.onerror = () => {
      reject(reader.error instanceof Error ? reader.error : new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}
