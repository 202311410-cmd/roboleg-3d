import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Timer } from 'three/src/core/Timer.js'

/*
 * Escena 3D de RoboLab.
 *
 * Responsabilidades:
 *  - Crear renderer, escena, cámara y bucle de render.
 *  - Añadir suelo, iluminación y entorno (reflejos PBR).
 *  - OrbitControls interactiva (rotar / acercar / alejar / desplazar).
 *  - Adaptación automática a cambios de tamaño de ventana.
 *
 * La escena NO sabe nada de la UI ni del Store: solo expone el `sceneGraph`
 * para inyectar el brazo y un `animate()` reutilizable.
 */

const COLORS = {
  background: 0x0b0e11,
  ground: 0x11161c,
  grid: 0x1f2933,
  fog: 0x0b0e11,
}

export class Scene {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas
    this.clock = new Timer()
    this._disposed = false
    this._callback = null
    this._rafId = 0

    this._setupRenderer()
    this._setupScene()
    this._setupCamera()
    this._setupControls()
    this._setupLights()
    this._setupGround()
    this._loadEnvironment()

    this._onResize = this._onResize.bind(this)
    window.addEventListener('resize', this._onResize)

    // Primer fotograma de inmediato.
    this.render()
  }

  // ---------------------------------------------------------------------------
  //  SETUPS
  // ---------------------------------------------------------------------------

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
  }

  _setupScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(COLORS.background)
    this.scene.fog = new THREE.Fog(COLORS.fog, 14, 34)
  }

  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    )
    this.camera.position.set(3.2, 2.1, 3.8)
    this.camera.lookAt(0, 0.9, 0)
  }

  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.85, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 9.5
    this.controls.maxPolarAngle = Math.PI * 0.56
    this.controls.minPolarAngle = Math.PI * 0.12
    this.controls.enablePan = true
    this.controls.panSpeed = 0.7
    this.controls.zoomSpeed = 0.9
    this.controls.autoRotate = false
    this.controls.autoRotateSpeed = 0.8
    this.controls.update()
  }

  // ---------------------------------------------------------------------------
  //  ILUMINACIÓN
  // ---------------------------------------------------------------------------

  _setupLights() {
    const ambient = new THREE.AmbientLight(0x8fa3b8, 0.55)
    this.scene.add(ambient)

    // Key directional con sombras.
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(4, 6, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 20
    key.shadow.camera.left = -4
    key.shadow.camera.right = 4
    key.shadow.camera.top = 4
    key.shadow.camera.bottom = -4
    key.shadow.bias = -0.0008
    this.scene.add(key)
    this.keyLight = key

    // Relleno lateral cian (hardware).
    const fill = new THREE.DirectionalLight(0x22d3ee, 0.9)
    fill.position.set(-4, 2.5, -2)
    this.scene.add(fill)

    // Acento ámbar desde la parte trasera (apariencia de LED).
    const rim = new THREE.PointLight(0xf59e0b, 2.2, 8, 2)
    rim.position.set(-1.5, 3.4, -2.2)
    this.scene.add(rim)

    // Sutil fill superior.
    const top = new THREE.PointLight(0x93c5fd, 0.5, 12, 2)
    top.position.set(0, 6, 1)
    this.scene.add(top)

    this.ambient = ambient
  }

  // ---------------------------------------------------------------------------
  //  ENTORNO / SUELO
  // ---------------------------------------------------------------------------

  _setupGround() {
    const groundGroup = new THREE.Group()
    groundGroup.name = 'ground'

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshStandardMaterial({
        color: COLORS.ground,
        roughness: 0.9,
        metalness: 0.05,
      }),
    )
    board.rotation.x = -Math.PI / 2
    board.receiveShadow = true
    groundGroup.add(board)

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(7.6, 8, 64),
      new THREE.MeshBasicMaterial({
        color: 0x1f2933,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      }),
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.002
    groundGroup.add(rim)

    const grid = new THREE.GridHelper(16, 16, COLORS.grid, 0x171d24)
    grid.position.y = 0.001
    grid.material.transparent = true
    grid.material.opacity = 0.35
    groundGroup.add(grid)

    const floorEdge = new THREE.Mesh(
      new THREE.RingGeometry(7.8, 8.0, 96),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      }),
    )
    floorEdge.rotation.x = -Math.PI / 2
    floorEdge.position.y = 0.002
    groundGroup.add(floorEdge)

    this.scene.add(groundGroup)
  }

  /**
   * Entorno procedural (RoomEnvironment-ligero) para que los materiales PBR
   * tengan reflejos coherentes con la paleta cian/ámbar.
   */
  async _loadEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer)
      pmrem.compileEquirectangularShader()

      const envScene = new THREE.Scene()

      const key = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.BackSide }),
      )
      key.position.set(0, 8, 0)
      envScene.add(key)

      const amber = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.BackSide }),
      )
      amber.position.set(0, -6, 0)
      envScene.add(amber)

      const dim = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 12),
        new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.BackSide }),
      )
      dim.position.set(12, 2, 8)
      envScene.add(dim)

      const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100)
      this.scene.environment = rt.texture

      pmrem.dispose()
    } catch (err) {
      console.warn('[RoboLab] No se pudo generar el entorno PBR:', err)
    }
  }

  // ---------------------------------------------------------------------------
  //  API
  // ---------------------------------------------------------------------------

  add(object) {
    this.scene.add(object)
    return this
  }

  remove(object) {
    this.scene.remove(object)
    return this
  }

  /** Renderiza un fotograma. */
  render() {
    if (this._disposed) return
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Bucle principal. `callback(dt, elapsed)` puede devolver `false` para parar.
   */
  animate(callback = null) {
    if (this._disposed) return
    this._callback = callback
    // [RED de seguridad] Reanudar siempre: si ya hay un rAF pendiente, el
    // propio `_tick` lo reprograma, así que no duplicamos frames.
    if (this._rafId) return
    this._tick = this._tick.bind(this)
    this._rafId = requestAnimationFrame(this._tick)
  }

  _tick() {
    const dt = this.clock.getDelta()
    const elapsed = this.clock.getElapsed()

    if (this._callback) {
      const running = this._callback(dt, elapsed)
      if (running === false) {
        this.stop()
        return
      }
    }

    if (this.controls) this.controls.update()
    this.render()
    this._rafId = requestAnimationFrame(this._tick)
  }

  /** Detiene el bucle. */
  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._rafId = 0
  }

  /** Coloca la cámara en una posibilidad de cámara para pruebas. */
  setView(position, target) {
    this.camera.position.set(position[0], position[1], position[2])
    this.controls.target.set(target[0], target[1], target[2])
    this.controls.update()
  }

  /** Activa/desactiva rotación automática de cámara. */
  setAutoRotate(on, speed = 0.8) {
    if (!this.controls) return
    this.controls.autoRotate = !!on
    this.controls.autoRotateSpeed = speed
  }

  _onResize() {
    if (!this.renderer || !this.camera) return
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    this.stop()
    window.removeEventListener('resize', this._onResize)
    this.controls?.dispose()
    this.renderer?.dispose()
  }
}

export default Scene