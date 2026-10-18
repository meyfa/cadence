export const TIMELINE_ZOOM_MIN = 4
export const TIMELINE_ZOOM_MAX = 64
export const TIMELINE_ZOOM_DEFAULT = 16

export const TIMELINE_ZOOM_STEP = 2

export const TIMELINE_TRANSITION_DURATION = '100ms'
export const TIMELINE_TRANSITION_EASING = 'ease'

// When one step is at least this wide, then selection works at step granularity.
// Otherwise, when one beat is at least this wide, selection works at beat granularity.
// Otherwise, selection works at bar granularity.
export const SELECTION_PIXELS_PER_NOTCH = 10

// When zoomed far out, minor ticks (non-bar) become noisy and expensive.
export const MINOR_TICKS_MIN_BEAT_WIDTH = 10

// When zoomed far out, bar labels are reduced to every N bars (stride).
export const SPARSE_BAR_LABELS_STRIDE_BARS = 4

// If this beat count is exceeded, then rendering will be limited to preserve performance.
export const RENDERING_LIMIT_BEATS = 4096
