import * as THREE from 'three'
import {
  armBody,
  armAccent,
  armLight,
  jointMetal,
  innerDark,
  accentCyan,
  accentAmber,
  rubber,
  jointHousing,
} from './materials.js'

/*
 * RoboLab — Modelo de manipulador 3R en plano vertical.
 *
 * Esquema de la jerarquía (grupos anidados = pivotes mecánicos):
 *
 *   group (RobotArm)                         → rotación X = +PI/2 a nivel raíz
 *   └─ base                                  → anclaje fijo
 *   └─ shoulder  (HOMBRO)                    → pivote en Y
 *      └─ upperArm                           → eslabón colimado sobre +Z
 *         └─ elbow  (CODO)                   → pivote en Y
 *            └─ forearm                      → eslabón colimado sobre +Z
 *               └─ wrist  (MUÑECA)           → pivote en Y
 *                  └─ hand                    → eslabón colimado sobre +Z
 *                     └─ jawPivot            → pivote de la pinza (eje X)
 *                        ├─ fingerR         → dedo derecho (rotación X)
 *                        └─ fingerL         → dedo izquierdo (rotación X)
 *
 * Convención de ejes
 *   - Cada eslabón se construye **colimado sobre +Z** de su grupo padre.
 *     El origen de `linkN` coincide con el pivote (articulación) anterior.
 *   - shoulder/elbow/wrist giran sobre el eje **Y** de su grupo, por lo que el
 *     conjunto se abre en el plano **XZ**. Al aplicar la raíz `group.rotation.x
 *     = Math.PI / 2`, la geometría que antes estaba sobre +Z del mundo se orienta
 *     hacia **+Y del mundo** (arriba), y los giros sobre Y local producen un
 *     desplazamiento en el **plano vertical X-Y** del mundo (el clásico brazo
 *     articulado tipo “artesial” posicionado sobre una pared).
 *   - La pinza abre/cierra sobre el eje **X** de `jawPivot`, que corresponde a
 *     la **horizontal (Z) del mundo** tras la rotación: los dedos se separan
 *     lateralmente (garra vertical clásica).
 *
 * API pública
 *   setJointAngle('shoulder'|'elbow'|'wrist', grados)
 *   getJointAngle(name) → grados
 *   setJaw(true|false) / setJawOpen / setJawClosed / getJawOpen()
 *   joints → { shoulder, elbow, wrist }
 */

export const RIG = {
  link1: 1.15,
  link2: 0.95,
  link3: 0.72,
  shoulderY: 0.95,
  radius1: 0.16,
  radius2: 0.125,
  radius3: 0.1,
  baseRadius: 0.3,
  baseHeight: 0.45,
  jawOpen: 0.11, // separación entre dedos abiertos (m)
  jawClosed: 0.025,
  fingerLength: 0.3,
}

/** Construye geometrías reutilizables. */
function createGeometryCache() {
  return {
    cyl: (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg, 1, false),
    disc: (r, seg = 28) => new THREE.CylinderGeometry(r, r, 0.012, seg, 1, false),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    sphere: (r, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h),
    torus: (r, tube, w = 24, h = 12) => new THREE.TorusGeometry(r, tube, w, h),
  }
}

/**
 * Eslabón colimado sobre +Z. Su origen queda en la articulación anterior.
 */
function createLink(length, radius, g) {
  const link = new THREE.Group()

  const body = new THREE.Mesh(g.cyl(radius, length), armBody)
  body.position.z = length / 2
  link.add(body)

  const baseRing = new THREE.Mesh(g.cyl(radius * 1.18, 0.04), armAccent)
  baseRing.position.z = 0.02
  link.add(baseRing)

  const topRing = new THREE.Mesh(g.cyl(radius * 1.1, 0.03), armLight)
  topRing.position.z = length - 0.015
  link.add(topRing)

  for (const side of [-1, 1]) {
    const tab = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.055, length * 0.78),
      jointMetal,
    )
    tab.position.set(side * radius * 1.14, 0, length / 2)
    link.add(tab)
  }

  const cap = new THREE.Mesh(g.disc(radius * 0.82), innerDark)
  cap.position.z = length - 0.012
  link.add(cap)

  const stripe = new THREE.Mesh(g.disc(radius * 0.48), accentCyan)
  stripe.rotation.x = Math.PI / 2
  stripe.position.z = length - 0.018
  link.add(stripe)

  return link
}

/** Motor/junta tipo cubo + cara + eje (con nombre para identidad visual). */
function createMotor(size, g) {
  const motor = new THREE.Group()

  const housing = new THREE.Mesh(g.box(size * 0.72, size * 0.72, 0.13), jointHousing)
  housing.position.z = 0.05
  motor.add(housing)

  const face = new THREE.Mesh(g.box(size * 0.55, size * 0.55, 0.03), accentCyan)
  face.position.z = 0.13
  motor.add(face)

  const collar = new THREE.Mesh(g.cyl(size * 0.26, 0.06), jointMetal)
  collar.position.z = 0.21
  motor.add(collar)

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const nut = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), jointMetal)
      nut.position.set(sx * size * 0.2, 0, 0.09 + sz * size * 0.2)
      motor.add(nut)
    }
  }

  return motor
}

/** Base anclada (patas, cuerpo, tapa, tablero y columna de montaje). */
function buildBase(r, g) {
  const base = new THREE.Group()
  base.name = 'base'

  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const pad = new THREE.Mesh(g.sphere(0.045, 20, 12), rubber)
    pad.position.set(sx * (r.baseRadius - 0.08), -0.005, sz * (r.baseRadius - 0.08))
    base.add(pad)
  }

  const skirt = new THREE.Mesh(g.cyl(r.baseRadius, r.baseHeight, 48), armBody)
  skirt.position.y = r.baseHeight / 2
  base.add(skirt)

  const cap = new THREE.Mesh(g.cyl(r.baseRadius * 0.9, 0.055, 48), armAccent)
  cap.position.y = r.baseHeight - 0.0275
  base.add(cap)

  const deck = new THREE.Mesh(g.box(r.baseRadius * 1.5, 0.02, 0.85), armLight)
  deck.position.y = r.baseHeight - 0.001
  base.add(deck)

  for (let i = 0; i < 7; i++) {
    const slot = new THREE.Mesh(g.box(0.012, 0.006, 0.05), innerDark)
    slot.position.set(-r.baseRadius * 0.5 + i * 0.1, 0.011, 0.15)
    base.add(slot)
  }

  const tower = new THREE.Mesh(g.cyl(0.11, 0.2, 32, 4, false), armAccent)
  tower.position.y = r.baseHeight + 0.05
  base.add(tower)

  const towerCap = new THREE.Mesh(g.cyl(0.12, 0.03, 32), jointMetal)
  towerCap.position.y = r.baseHeight + 0.19
  base.add(towerCap)

  return base
}

/**
 * Manipulador 3R sobre un enraizamiento en `group`.
 * La rotación raíz X = +PI/2 orienta la cadena hacia arriba (+Y mundo).
 */
class RobotArm {
  /**
   * @param {object} [overrides] Parámetros que se fusionan con RIG.
   */
  constructor(overrides = {}) {
    this.rig = { ...RIG, ...overrides }
    this.geometries = createGeometryCache()

    this.group = new THREE.Group()
    this.group.name = 'RobotArm'
    // La cadena se construye sobre +Z. Rotar la raíz X = -PI/2 orienta la
    // geometría hacia +Y (arriba). Los giros de las 3 articulaciones son Y y
    // por tanto mantienen el movimiento en el plano vertical X-Y del mundo.
    this.group.rotation.x = -Math.PI / 2

    this.shoulder = new THREE.Group()
    this.shoulder.name = 'shoulder'
    this.elbow = new THREE.Group()
    this.elbow.name = 'elbow'
    this.wrist = new THREE.Group()
    this.wrist.name = 'wrist'

    this._build()
  }

  _build() {
    const r = this.rig
    const g = this.geometries

    // Base (fija)
    this.base = buildBase(r, g)
    this.group.add(this.base)

    // Hombro
    this.shoulder.position.y = r.shoulderY
    this.group.add(this.shoulder)
    this.shoulder.add(createMotor(0.36, g))
    this.shoulder.add(createLink(r.link1, r.radius1, g))

    // Codo
    this.elbow.position.z = r.link1
    this.shoulder.add(this.elbow)
    this.elbow.add(createMotor(0.28, g))
    this.elbow.add(createLink(r.link2, r.radius2, g))

    // Muñeca
    this.wrist.position.z = r.link2
    this.elbow.add(this.wrist)
    this.wrist.add(createMotor(0.24, g))
    this.wrist.add(createLink(r.link3, r.radius3, g))

    // Pinza
    this.jawPivot = new THREE.Group()
    this.jawPivot.name = 'jaw'
    this.jawPivot.position.z = r.link3
    this.wrist.add(this.jawPivot)
    this._buildJaw()

    this.jawClosed = true
    this.setJaw(true)

    // Ancla la base sobre y = 0 (el suelo). Con la rotación de raíz
    // `group.rotation.x = -PI/2` se cumple que el eje Y mundial recibe el eze Z
    // local: y_mundo = group.y + z_local. Así que basta con
    // group.y = -min(z_local de la base).
    this._groundOffsetY = this._computeBaseLowestZ()
    this.group.position.y = -this._groundOffsetY
  }

  /**
   * Devuelve la menor coordenada Z (en el espacio local de la base) que alcanza
   * cualquier vértice. Es la que, tras la rotación X=-90°, define el punto más
   * bajo en Y mundial.
   */
  _computeBaseLowestZ() {
    let minZ = 0
    this.base.traverse((o) => {
      if (!o.isMesh || !o.geometry) return
      const p = o.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i)
        if (z < minZ) minZ = z
      }
    })
    return minZ
  }

  /**
   * Construye los dedos y el anclaje de la pinza.
   * Los dedos crecen en +X local (ancho del plano XZ después de la rotación).
   */
  _buildJaw() {
    const r = this.rig
    const g = this.geometries

    const housing = new THREE.Mesh(g.cyl(0.14, 0.3, 32, 4, false), armAccent)
    housing.position.z = 0.1
    this.jawPivot.add(housing)

    const cap = new THREE.Mesh(g.cyl(0.1, 0.04, 32), innerDark)
    cap.position.z = 0.25
    this.jawPivot.add(cap)

    const piston = new THREE.Mesh(g.cyl(0.045, 0.16, 18), accentCyan)
    piston.position.set(0, 0, -0.2)
    this.jawPivot.add(piston)

    this.fingerR = this._buildFinger(+1, g)
    this.fingerL = this._buildFinger(-1, g)
    this.fingers = [this.fingerR, this.fingerL]
  }

  /**
   * Dedo individual. Crece en la dirección `side` sobre el eje +X del grupo
   * `jawPivot`. El movimiento de apertura se aplica sobre `rotation.x`.
   */
  _buildFinger(side, g) {
    const r = this.rig
    const L = r.fingerLength

    const finger = new THREE.Group()
    finger.name = side > 0 ? 'fingerR' : 'fingerL'
    finger.position.z = 0.16

    const bar = new THREE.Mesh(g.cyl(0.028, L, 18), rubber)
    bar.rotation.z = Math.PI / 2
    bar.position.x = side * (L / 2)
    finger.add(bar)

    const grip = new THREE.Mesh(g.cyl(0.018, L * 0.5, 16), accentCyan)
    grip.rotation.z = Math.PI / 2
    grip.position.x = side * (L * 0.33)
    finger.add(grip)

    const claw = new THREE.Mesh(g.cyl(0.02, 0.12, 16), accentAmber)
    claw.rotation.z = Math.PI / 2
    claw.position.x = side * (L + 0.02)
    finger.add(claw)

    const ring = new THREE.Mesh(g.torus(0.05, 0.014), jointMetal)
    ring.rotation.y = Math.PI / 2
    finger.add(ring)

    const mount = new THREE.Mesh(g.disc(0.07, 24), accentCyan)
    finger.add(mount)

    this.jawPivot.add(finger)
    return finger
  }

  // ---------------------------------------------------------------------------
  //  API pública
  // ---------------------------------------------------------------------------

  setJointAngle(name, deg) {
    const piv = this[name]
    if (!piv) throw new Error(`[RobotArm] Articulación desconocida: ${name}`)
    piv.rotation.y = THREE.MathUtils.degToRad(deg)
  }

  getJointAngle(name) {
    const piv = this[name]
    if (!piv) throw new Error(`[RobotArm] Articulación desconocida: ${name}`)
    return THREE.MathUtils.radToDeg(piv.rotation.y)
  }

  setJaw(open) {
    const r = this.rig
    const spread =
      typeof open === 'number' ? open : open ? r.jawOpen : r.jawClosed
    const clamped = THREE.MathUtils.clamp(spread, r.jawClosed, r.jawOpen)
    // `clamped` es una separación en METROS. Se convierte a grados de giro con
    // una palanca (rad/m) para que abrir/cerrar la pinza sea visible; la
    // conversión lineal por separación no debe usarse directamente en radianes
    // (0.0425 rad ≈ 2.4° es imperceptible).
    const METERS_TO_RAD = 60
    const angle = ((clamped - r.jawClosed) * METERS_TO_RAD) / 2
    // [TEMPORAL] Diagnóstico: imprimir el ángulo aplicado a los dedos
    console.log(
      '[Arm] setJaw →',
      'spread=',
      +spread.toFixed(4),
      'clamped=',
      +clamped.toFixed(4),
      'angle(rad)=',
      +angle.toFixed(4),
      '| fingerR.rotation.x →',
      +this.fingerR.rotation.x.toFixed(4),
    )
    this.fingerR.rotation.x = angle
    this.fingerL.rotation.x = -angle
    this.jawClosed = clamped < 0.08
    return clamped
  }

  setJawOpen(open) {
    return this.setJaw(open)
  }

  setJawClosed() {
    return this.setJaw(false)
  }

  getJawOpen() {
    return THREE.MathUtils.radToDeg(this.fingerR.rotation.x)
  }

  get joints() {
    return { shoulder: this.shoulder, elbow: this.elbow, wrist: this.wrist }
  }

  /**
   * Aplica una pose de prueba temporaria (Etapa 2, para validar el brazo).
   */
  applyTestPose() {
    this.setJointAngle('shoulder', 35)
    this.setJointAngle('elbow', 55)
    this.setJointAngle('wrist', -30)
    this.setJaw(true)
  }

  /** Nombre de la articulación. */
  getJointConfig() {
    return {
      shoulder: this.shoulder,
      elbow: this.elbow,
      wrist: this.wrist,
    }
  }
}

export default RobotArm
export { RobotArm }