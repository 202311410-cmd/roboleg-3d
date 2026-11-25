/*
 * Store.js — Estado centralizado de RoboLab.
 *
 * Fuente de verdad única de:
 *   - ángulos de las 3 articulaciones (en grados)
 *   - apertura de la pinza
 *   - estado de simulación (idle | running | paused)
 *
 * La UI escribe `set*()`; el render escucha `subscribe(fn)`. Nunca escribe
 * directamente al modelo 3D. Los radianes se calculan en el borde.
 *
 * API pública
 *   getState()  → { joints: {shoulder, elbow, wrist}, jawOpen, simStatus, degrees }
 *   setJoint(name, deg)   → valida por rango y actualiza
 *   setJaw(bool)          → abre/cierra
 *   setJawWidth(meters)   → anchura exacta de la pinza
 *   reset()               → vuelve a posiciones iniciales
 *   play() / pause() / toggle()
 *   subscribe(fn)         → suscripción (devuelve unsubscribe)
 *   setRange(name, { min, max })
 *   ranges                → rangos configurables (con getters)
 */

const RANGES = {
  shoulder: { min: -170, max: 170, step: 1 },
  elbow: { min: 0, max: 170, step: 1 },
  wrist: { min: -170, max: 170, step: 1 },
}

const INITIAL_JOINTS = {
  shoulder: 0,
  elbow: 0,
  wrist: 0,
}

const INITIAL_JAW_OPEN = 0.11 // en metros (home: pinza abierta)
const JAW_CLOSED = 0.025

/**
 * Crea un Store.
 * @param {object} [options]
 * @param {object} [options.joints] Ángulos iniciales (grados).
 * @param {number} [options.jawOpen] Apertura inicial (m).
 * @param {string} [options.simStatus] Estado inicial.
 * @param {object} [options.ranges] Rangos personalizados por articulación.
 */
export function createStore(options = {}) {
  let state = {
    joints: { ...INITIAL_JOINTS, ...(options.joints || {}) },
    jawOpen: options.jawOpen ?? INITIAL_JAW_OPEN,
    simStatus: options.simStatus || 'idle', // 'idle' | 'running' | 'paused'
    isPlaying: options.simStatus === 'running',
  }

  const listeners = new Set()
  const localRanges = { ...RANGES }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

  function emit() {
    for (const fn of listeners) {
      try {
        fn(getSnapshot())
      } catch (err) {
        console.error('[RoboLab] Error en listener del store:', err)
      }
    }
  }

  function setJoint(name, deg) {
    if (!(name in localRanges)) {
      throw new Error(`[Store] Articulación desconocida: ${name}`)
    }
    const r = localRanges[name]
    const value = Math.round(clamp(deg, r.min, r.max) / r.step) * r.step
    const next = { ...state.joints, [name]: value }
    const changed = Object.keys(next).some((k) => next[k] !== state.joints[k])
    if (!changed) return
    state = { ...state, joints: next }
    emit()
  }

  function setJawWidth(meters) {
    const width = clamp(
      meters,
      JAW_CLOSED,
      RANGES.jawOpen ?? 0.11,
    )
    if (Math.abs(width - state.jawOpen) < 1e-6) return
    state = { ...state, jawOpen: width }
    emit()
  }

  function setJaw(open) {
    const target = open ? 0.11 : JAW_CLOSED
    return setJawWidth(target)
  }

  function setSimStatus(status) {
    const isRunning = status === 'running'
    if (state.simStatus === status && state.isPlaying === isRunning) return
    state = { ...state, simStatus: status, isPlaying }
    emit()
  }

  function play() {
    setSimStatus('running')
  }

  function pause() {
    setSimStatus('paused')
  }

  function toggle() {
    if (state.isPlaying) pause()
    else play()
  }

  function reset() {
    state = {
      joints: { ...INITIAL_JOINTS },
      jawOpen: INITIAL_JAW_OPEN,
      simStatus: 'idle',
      isPlaying: false,
    }
    emit()
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function getSnapshot() {
    return {
      joints: { ...state.joints },
      jawOpen: state.jawOpen,
      simStatus: state.simStatus,
      isPlaying: state.isPlaying,
      // Compatibilidad con la API anterior de Angle → rad en lector de UI.
      radians: toRadians(state.joints),
      degrees: { ...state.joints },
    }
  }

  function getJoint(name) {
    return state.joints[name]
  }

  function getJawOpen() {
    return state.jawOpen
  }

  function isPlaying() {
    return state.isPlaying
  }

  function ranges() {
    return { ...localRanges }
  }

  function setRange(name, { min, max, step }) {
    if (!(name in localRanges)) throw new Error(`[Store] Articulación desconocida: ${name}`)
    localRanges[name] = { min, max, step: step ?? 1 }
    // Recorta el valor actual al nuevo rango.
    const v = state.joints[name]
    const clamped = clamp(v, min, max)
    if (clamped !== v) {
      state = { ...state, joints: { ...state.joints, [name]: clamped } }
    }
  }

  return {
    getSnapshot,
    getState: getSnapshot,
    setJoint,
    setJaw,
    setJawWidth,
    play,
    pause,
    toggle,
    reset,
    subscribe,
    getJoint,
    getJawOpen,
    isPlaying,
    ranges,
    setRange,
  }
}

/** Grados → radianes. */
export function toRadians(deg) {
  const out = {}
  for (const [k, v] of Object.entries(deg)) out[k] = (v * Math.PI) / 180
  return out
}

/** Radianes → grados. */
export function toDegrees(rad) {
  const out = {}
  for (const [k, v] of Object.entries(rad)) out[k] = (v * 180) / Math.PI
  return out
}

export { RANGES as ANGLE_RANGES, INITIAL_JOINTS }