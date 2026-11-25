/*
 * ui.js — Construcción y vinculeación de la interfaz de RoboLab.
 *
 * Responsabilidades:
 *   - Crear el esqueleto HTML del panel, sliders, botones e información.
 *   - Vincular los controles con el Store (escribir estado).
 *   - Refrescar la UI cuando el Store cambia (leer estado).
 *
 * No contiene lógica 3D. Todo se construye con DOM para ser depurable.
 */

/**
 * Construye la interfaz completa y devuelve los handlers con el Store.
 * @param {import('../core/Store.js').Store} store
 * @param {object} deps
 * @param {(snap) => void} deps.onSimulate  → 'play' | 'pause' | 'reset'
 * @param {(snap) => void} deps.onCameraRotateToArm (opcional)
 */
export function buildUI(store, { onSimulate, onResetAll } = {}) {
  const app = document.getElementById('app')

  // ---------------------------------------------------------------------------
  //  ESQUELETO
  // ---------------------------------------------------------------------------
  app.innerHTML = `
    <div class="rb-app">
      <canvas id="robo-canvas" class="rb-canvas" aria-label="Vista 3D del brazo robótico"></canvas>

      <header class="rb-header">
        <div class="rb-header__brand">
          <span class="rb-logo" aria-hidden="true"></span>
          <div>
            <h1 class="rb-title">RoboLab</h1>
            <p class="rb-subtitle">Manipulador 3R · Plataforma de simulación</p>
          </div>
        </div>
        <div class="rb-header__status">
          <span class="rb-status-dot" id="rb-sim-dot"></span>
          <span class="rb-status-text" id="rb-sim-label">En reposo</span>
        </div>
      </header>

      <aside class="rb-panel" aria-label="Panel de control">
        <section class="rb-card">
          <h2 class="rb-card__title">Articulaciones</h2>

          <div class="rb-control" data-joint="shoulder">
            <div class="rb-control__head">
              <label for="rb-shoulder">Hombro</label>
              <output class="rb-value" id="rb-shoulder-val">0°</output>
            </div>
            <input type="range" id="rb-shoulder" class="rb-slider" min="-170" max="170" step="1" value="0">
            <div class="rb-control__scale"><span>-170°</span><span>170°</span></div>
          </div>

          <div class="rb-control" data-joint="elbow">
            <div class="rb-control__head">
              <label for="rb-elbow">Codo</label>
              <output class="rb-value" id="rb-elbow-val">0°</output>
            </div>
            <input type="range" id="rb-elbow" class="rb-slider" min="0" max="170" step="1" value="0">
            <div class="rb-control__scale"><span>0°</span><span>170°</span></div>
          </div>

          <div class="rb-control" data-joint="wrist">
            <div class="rb-control__head">
              <label for="rb-wrist">Muñeca</label>
              <output class="rb-value" id="rb-wrist-val">0°</output>
            </div>
            <input type="range" id="rb-wrist" class="rb-slider" min="-170" max="170" step="1" value="0">
            <div class="rb-control__scale"><span>-170°</span><span>170°</span></div>
          </div>
        </section>

        <section class="rb-card">
          <h2 class="rb-card__title">Pinza</h2>
          <div class="rb-control">
            <div class="rb-control__head">
              <label id="rb-jaw-label" for="rb-jaw">Apertura</label>
              <output class="rb-value" id="rb-jaw-val">Abrida</output>
            </div>
            <input type="range" id="rb-jaw" class="rb-slider rb-slider--amber" min="0" max="100" step="1" value="100">
            <div class="rb-jaw-indicator">
              <span class="rb-jaw-fill" id="rb-jaw-fill"></span>
              <span class="rb-jaw-state" id="rb-jaw-state">Abierta</span>
            </div>
          </div>
        </section>

        <section class="rb-card">
          <h2 class="rb-card__title">Simulación</h2>
          <div class="rb-buttons">
            <button type="button" class="rb-btn rb-btn--play" id="rb-play" title="Iniciar simulación">
              <span class="rb-btn__icon" aria-hidden="true">▶</span> Iniciar
            </button>
            <button type="button" class="rb-btn rb-btn--pause" id="rb-pause" title="Pausar simulación">
              <span class="rb-btn__icon" aria-hidden="true">❚❚</span> Pausar
            </button>
            <button type="button" class="rb-btn rb-btn--reset" id="rb-reset" title="Reiniciar">
              <span class="rb-btn__icon" aria-hidden="true">↺</span> Reiniciar
            </button>
          </div>
        </section>

        <section class="rb-card rb-card--info">
          <h2 class="rb-card__title">Estado actual</h2>
          <dl class="rb-readouts">
            <div><dt>Hombro</dt><dd id="rb-read-shoulder">0.0°</dd></div>
            <div><dt>Codo</dt><dd id="rb-read-elbow">0.0°</dd></div>
            <div><dt>Muñeca</dt><dd id="rb-read-wrist">0.0°</dd></div>
            <div><dt>Pinza</dt><dd id="rb-read-jaw">—</dd></div>
          </dl>
        </section>

        <section class="rb-card">
          <h2 class="rb-card__title">Consejos</h2>
          <ul class="rb-tips">
            <li>Arrastra en la escena: <strong>rotar cámara</strong></li>
            <li>Rueda del ratón: <strong>acercar / alejar</strong></li>
            <li>Clic derecho + arrastrar: <strong>desplazar</strong></li>
          </ul>
        </section>
      </aside>
    </div>
  `

  // ---------------------------------------------------------------------------
  //  DOM REFS
  // ---------------------------------------------------------------------------
  const $ = (sel) => app.querySelector(sel)
  const ui = {
    simDot: $('#rb-sim-dot'),
    simLabel: $('#rb-sim-label'),
    shoulder: $('#rb-shoulder'),
    elbow: $('#rb-elbow'),
    wrist: $('#rb-wrist'),
    jaw: $('#rb-jaw'),
    play: $('#rb-play'),
    pause: $('#rb-pause'),
    reset: $('#rb-reset'),
    readouts: {
      shoulder: $('#rb-read-shoulder'),
      elbow: $('#rb-read-elbow'),
      wrist: $('#rb-read-wrist'),
      jaw: $('#rb-read-jaw'),
    },
  }

  // ---------------------------------------------------------------------------
  //  HANDLERS (escritura → Store)
  // ---------------------------------------------------------------------------
  const onJointChange = (name, input) => {
    const deg = Number(input.value)
    store.setJoint(name, deg)
  }

  ui.shoulder.addEventListener('input', (e) => onJointChange('shoulder', e.target))
  ui.elbow.addEventListener('input', (e) => onJointChange('elbow', e.target))
  ui.wrist.addEventListener('input', (e) => onJointChange('wrist', e.target))

  ui.jaw.addEventListener('input', (e) => {
    const pct = Number(e.target.value) / 100
    const width = pct * 0.11
    store.setJawWidth(width)
    // Refresco inmediato del indicador para que la respuesta sea visualmente
    // instantánea (el `render` del Store también lo hará, pero al instante).
    const pctRound = Math.round(pct * 100)
    const state = pct < 0.25 ? 'Cerrada' : pct < 0.75 ? 'Parcial' : 'Abierta'
    const stateEl = app.querySelector('#rb-jaw-state')
    if (stateEl) {
      stateEl.textContent = state
      stateEl.className = `rb-jaw-state rb-jaw-state--${pct < 0.25 ? 'closed' : pct > 0.75 ? 'open' : 'mid'}`
    }
    const valOut = app.querySelector('#rb-jaw-val')
    if (valOut) valOut.textContent = state
  })

  ui.play.addEventListener('click', () => {
    store.play()
    if (onSimulate) onSimulate('play')
  })

  ui.pause.addEventListener('click', () => {
    store.pause()
    if (onSimulate) onSimulate('pause')
  })

  ui.reset.addEventListener('click', () => {
    store.reset()
    if (onSimulate) onSimulate('reset')
    if (onResetAll) onResetAll()
  })

  // ---------------------------------------------------------------------------
  //  REFRESH (lectura ← Store)
  // ---------------------------------------------------------------------------
  function render(snap) {
    const s = snap.joints
    // Sliders
    ui.shoulder.value = s.shoulder
    ui.elbow.value = s.elbow
    ui.wrist.value = s.wrist
    ui.jaw.value = Math.round((snap.jawOpen / 0.11) * 100)

    // Etiquetas
    ui.shoulder.nextElementSibling // scale, no-op por claridad
    const labels = app.querySelectorAll('.rb-control__head .rb-value')
    if (labels[0]) labels[0].textContent = `${s.shoulder}°`
    if (labels[1]) labels[1].textContent = `${s.elbow}°`
    if (labels[2]) labels[2].textContent = `${s.wrist}°`

    // Info actual
    const jawPct = Math.round((snap.jawOpen / 0.11) * 100)
    const jawState = snap.jawOpen < 0.04 ? 'Cerrada' : jawPct < 30 ? 'Cerrando' : jawPct > 75 ? 'Abierta' : 'Parcial'
    ui.readouts.shoulder.textContent = s.shoulder.toFixed(1) + '°'
    ui.readouts.elbow.textContent = s.elbow.toFixed(1) + '°'
    ui.readouts.wrist.textContent = s.wrist.toFixed(1) + '°'
    // La pinza se reporta como estado de apertura (no como valor numérico),
    // para que coincida con el indicador visual de la tarjeta de Pinza.
    if (ui.readouts.jaw) {
      ui.readouts.jaw.textContent = jawState
    }

    const jawVal = $('#rb-jaw-val')
    const jawStateEl = $('#rb-jaw-state')
    if (jawVal) jawVal.textContent = jawState
    if (jawStateEl) {
      jawStateEl.textContent = jawState
      jawStateEl.className = `rb-jaw-state rb-jaw-state--${jawPct < 15 ? 'closed' : jawPct > 75 ? 'open' : 'mid'}`
    }

    // Barra visual
    const fill = $('#rb-jaw-fill')
    if (fill) fill.style.width = `${jawPct}%`

    // Estado de simulación
    const statusLabel = { idle: 'En reposo', running: 'Simulación activa', paused: 'Pausado' }
    ui.simLabel.textContent = statusLabel[snap.simStatus] || snap.simStatus
    ui.simDot.className = `rb-status-dot rb-status-dot--${snap.simStatus}`

    // Botones (estados)
    ui.play.disabled = snap.isPlaying
    ui.pause.disabled = !snap.isPlaying
  }

  // Suscripción al Store
  store.subscribe(render)

  // Primera render (sincroniza UI con estado inicial)
  render(store.getSnapshot())

  // ---------------------------------------------------------------------------
  //  REFERENCIAS EXTERNAS
  // ---------------------------------------------------------------------------
  return {
    app,
    ui,
    store,
    render,
  }
}

export default buildUI