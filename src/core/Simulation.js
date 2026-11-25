/*
 * Simulation.js — Motor de reproducción de RoboLab.
 *
 * Interpola los ángulos (grados) entre el valor actual y el objetivo del Store
 * para que los sliders producean un movimiento suave, y expone play/pause/reset.
 * No conoce del DOM: recibe una función `apply(anglesDeg, jawOpen)` para que
 * main.js se encargue de inyectar en el modelo 3D.
 *
 * Estados:
 *   idle    → no se reproduce, los sliders mueven el brazo directamente
 *   running → la animación (play/pausa) funciona
 *   paused  → se detuvo y puede reanudarse
 */

const TAU = 12 // constante de tiempo en segundos (1/e de la distancia por tau)
const MAX_STEP = 0.1 // s — evita saltos tras pausas largas / pestañas inactivas
const MIN_STEP = 1e-4 // s — evita dt casi cero

/**
 * Delta reducido: si el tiempo entre frames es anómalo (pestaña inactiva,
 * pausa larga del navegador), se limita para que la interpelación no salte.
 */
function normalizeDelta(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return MIN_STEP
  return Math.min(dt, MAX_STEP)
}

/**
 * Calcula el coeficiente de interpelación para un dt dado (segundos).
 * k = 1 - exp(-tau * dt)  → independiente del framerate.
 */
function computeK(dt) {
  return 1 - Math.exp(-TAU * dt)
}

function shortestDelta(a, b) {
  let d = (b - a) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export class Simulation {
  /**
   * @param {import('./Store.js').Store} store
   * @param {(angles: {shoulder:number, elbow:number, wrist:number}, jawOpen:number) => void} apply
   */
  constructor(store, apply) {
    this.store = store
    this.apply = apply
    this.running = false
    this._rafId = 0
    this._lastTs = 0

    // Posición actual de brazo (grados).
    this._cur = { shoulder: 0, elbow: 0, wrist: 0 }
    this._jaw = 0.11
    // Objetivo interno (se mantiene al cambiar estado para no resetear la anim).
    this._target = { shoulder: 0, elbow: 0, wrist: 0 }
    this._targetJaw = 0.11

    this._onStoreChange = () => {
      // Actualiza el objetivo del Store, pero NO pisa la posición animada
      // (`_cur`), porque `_syncFromStore` se dispara en cambios de estado
      // (incluido play/pause/reset) que no deberían resetear la interpolación.
      this._target = { ...this.store.getSnapshot().joints }
      this._targetJaw = this.store.getSnapshot().jawOpen
    }
    this.store.subscribe(this._onStoreChange)
    this._target = { ...this.store.getSnapshot().joints }
    this._targetJaw = this.store.getSnapshot().jawOpen
    this._syncFromStore()
  }

  /** Detiene el bucle. */
  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._rafId = 0
    this.running = false
  }

  /** Arranca (o reanuda) la animación. */
  play() {
    if (this.running) return
    this.running = true
    this._lastTs = 0
    this._tick = this._tick.bind(this)
    this._rafId = requestAnimationFrame(this._tick)
  }

  /** Detiene la animación sin cambiar el estado objetivo. */
  pause() {
    this.running = false
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._rafId = 0
  }

  toggle() {
    if (this.running) this.pause()
    else this.play()
  }

  _tick(ts) {
    if (!this.running) return
    const raw = ts - this._lastTs
    // En el primer frame ts = performance.now() con _lastTs = 0 → dt enorme.
    // Se detecta y se ignora ese paso (el estado se sincroniza aparte).
    const dt = this._lastTs === 0 ? MIN_STEP : normalizeDelta(raw)
    this._lastTs = ts
    this.update(dt)
    this._rafId = requestAnimationFrame(this._tick)
  }

  /**
   * Paso de integración: interpola desde `_cur` hacia `_target` (objetivo).
   * @param {number} dt Segundos desde el último paso.
   */
  update(dt) {
    const t = this._target
    // Sustituir un dt inválido o nulo por un paso por defecto (1/60 s) para
    // que la animación no quede bloqueada si el timer de la escena devuelve 0.
    const step = Number.isFinite(dt) && dt > 0 ? dt : 1 / 60
    const k = computeK(normalizeDelta(step))

    this._cur.shoulder += shortestDelta(this._cur.shoulder, t.shoulder) * k
    this._cur.elbow += shortestDelta(this._cur.elbow, t.elbow) * k
    this._cur.wrist += shortestDelta(this._cur.wrist, t.wrist) * k
    this._jaw += (this._targetJaw - this._jaw) * k

    // [TEMPORAL] Diagnóstico: ¿se envía el valor de pinza al modelo?
    if (this._jaw !== this._lastLoggedJaw) {
      console.log(
        '[Sim] update() jaw →',
        +this._jaw.toFixed(6),
        '| targetJaw →',
        +this._targetJaw.toFixed(6),
        '| dt(raw) →',
        dt,
        '| dt(norm) →',
        normalizeDelta(dt),
        '| k →',
        k,
        '| running →',
        this.running,
      )
      this._lastLoggedJaw = this._jaw
    }

    this.apply(
      {
        shoulder: this._cur.shoulder,
        elbow: this._cur.elbow,
        wrist: this._cur.wrist,
      },
      this._jaw,
    )
  }

  /**
   * Alias de retrocompatibilidad: pasa `dt` igual que `update()`.
   * Si no se recibe dt, usa el paso por defecto (1/60 s) para no saltar.
   */
  _step(dt) {
    this.update(dt ?? 1 / 60)
  }

  /** Reaplica el estado actual del Store sin animar (inicio / reset). */
  _syncFromStore() {
    const s = this.store.getSnapshot()
    this._cur = { ...s.joints }
    this._jaw = s.jawOpen
    this.apply({ ...s.joints }, s.jawOpen)
  }

  /** Resetea la animación al estado inicial del Store. */
  reset() {
    this.pause()
    this._syncFromStore()
  }

  /** Valor actual de la animación (para UI / depuración). */
  get current() {
    return { ...this._cur, jawOpen: this._jaw }
  }
}

export default Simulation