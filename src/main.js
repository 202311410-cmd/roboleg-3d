import './styles/base.css'
import { Scene } from './core/Scene.js'
import { RobotArm } from './models/RobotArm.js'
import { createStore } from './core/Store.js'
import { Simulation } from './core/Simulation.js'
import { buildUI } from './ui.js'

/*
 * RoboLab — Arranque (Etapa 3: controles e interfaz).
 *
 * Flujo:
 *   Store (estado) → Simulation (interpola) → RobotArm (3D)
 *   UI construye DOM y escribe en el Store.
 *   OrbitControls se conserva para la cámara.
 */

function init() {
  // -------------------------------------------------------------------------
  //  Referencias (definidas abajo; se asignan en orden para evitar TDZ en
  //  callbacks de la UI que pueden ejecutarse antes de esta sección).
  // -------------------------------------------------------------------------
  let sim = null
  let arm = null

  const store = createStore()

  const { app, ui } = buildUI(store, {
    onSimulate: (cmd) => {
      if (!sim) return
      if (cmd === 'play') sim.play()
      else if (cmd === 'pause') sim.pause()
      else if (cmd === 'reset') sim.reset()
    },
    onResetAll: () => {
      arm.setJointAngle('shoulder', 0)
      arm.setJointAngle('elbow', 0)
      arm.setJointAngle('wrist', 0)
      arm.setJaw(true)
    },
  })

  const canvas = app.querySelector('#robo-canvas')

  // -------------------------------------------------------------------------
  //  2) Escena 3D
  // -------------------------------------------------------------------------
  const scene = new Scene(canvas)

  // -------------------------------------------------------------------------
  //  3) Brazo (movimiento y geometría)
  // -------------------------------------------------------------------------
  arm = new RobotArm()

  // Aplica primero una pose inicial legible (sujeción a 0/0/0)
  arm.setJointAngle('shoulder', 0)
  arm.setJointAngle('elbow', 0)
  arm.setJointAngle('wrist', 0)
  arm.setJaw(true)

  scene.add(arm.group)

  // -------------------------------------------------------------------------
  //  4) Simulación: interpola Store → brazo
  // -------------------------------------------------------------------------
  sim = new Simulation(store, (anglesDeg, jawOpenMeters) => {
    arm.setJointAngle('shoulder', anglesDeg.shoulder)
    arm.setJointAngle('elbow', anglesDeg.elbow)
    arm.setJointAngle('wrist', anglesDeg.wrist)
    arm.setJaw(jawOpenMeters)
  })

  // Aplica el estado inicial del Store al brazo (la primera pasada)
  sim._syncFromStore()

  // Bucle de render: pinta y actualiza OrbitControls
  scene.animate((dt) => {
    sim.update(dt)
    scene.keyLight.intensity = 2.2 + Math.sin(dt * 2.0) * 0.12
  })

  // API global para depuración en consola
  window.__robolab = { scene, arm, store, sim, controls: scene.controls }

  console.info(
    '[RoboLab] Escena lista. Arrastra para rotar | scroll para zoom | clic derecho para desplazar.',
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}