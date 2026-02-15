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

export async function openTextFile (options: {
  readonly accept: string
  readonly signal?: AbortSignal
}): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options.accept
    input.style.display = 'none'

    const onChange = () => {
      const file = input.files?.[0]
      if (file == null) {
        resolve(undefined)
        cleanup()
        return
      }

      readFileAsText(file).then(resolve, reject).finally(cleanup)
    }

    const onAbort = () => {
      cleanup()
      resolve(undefined)
    }

    const cleanup = () => {
      input.removeEventListener('change', onChange)
      options.signal?.removeEventListener('abort', onAbort)
      document.body.removeChild(input)
    }

    input.addEventListener('change', onChange)
    options.signal?.addEventListener('abort', onAbort)

    document.body.appendChild(input)
    input.click()
  })
}

function readFileAsText (file: File): Promise<string> {
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
