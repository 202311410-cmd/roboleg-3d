import { MeshStandardMaterial, MeshPhysicalMaterial } from 'three'

/*
 * Materiales del manipulador RoboLab.
 *
 * Estética industrial: cuerpos en gris acerado oscuro con acabado metálico,
 * recubrimientos cian (hardware / protección) y detalles ámbar (LEDs / mecanismos).
 * Todos usan MeshStandardMaterial/Physical (PBR) para que el iluminado de la
 * escena (luces + env map) se refleje correctamente.
 */

export const palette = {
  bodyDark: 0x2a2f36, // gris acerado oscuro
  bodyMid: 0x3a4048, // gris medio
  bodyLight: 0x4a5158, // gris claro
  accentCyan: 0x22d3ee,
  accentAmber: 0xf59e0b,
  innerDark: 0x14181d, // caras internas / juntas
  jointMetal: 0x59606a, // piñas y ejes
  rubber: 0x1b1f24, // dedos de la pinza
  rubberAccent: 0x2a2f36,
  glass: 0x0b0e11, // paneles del cuerpo
}

/** Cuerpo principal del brazo (eslabones): metal anodizado oscuro. */
export const armBody = new MeshPhysicalMaterial({
  color: palette.bodyDark,
  metalness: 0.55,
  roughness: 0.42,
  clearcoat: 0.25,
  clearcoatRoughness: 0.6,
})

/** Segmentos secundarios / soportes: gris algo más claro. */
export const armAccent = new MeshPhysicalMaterial({
  color: palette.bodyMid,
  metalness: 0.6,
  roughness: 0.38,
  clearcoat: 0.2,
})

/** Tiras laterales y barras: gris claro iluminado. */
export const armLight = new MeshStandardMaterial({
  color: palette.bodyLight,
  metalness: 0.7,
  roughness: 0.3,
})

/** Juntas (piñas, tuercas, ejes). */
export const jointMetal = new MeshStandardMaterial({
  color: palette.jointMetal,
  metalness: 0.85,
  roughness: 0.3,
})

/** Caras internas de las articulaciones. */
export const innerDark = new MeshStandardMaterial({
  color: palette.innerDark,
  metalness: 0.4,
  roughness: 0.6,
})

/** Encapsulation cian de la pinza y juntas. */
export const accentCyan = new MeshPhysicalMaterial({
  color: palette.accentCyan,
  metalness: 0.35,
  roughness: 0.28,
  clearcoat: 0.6,
  clearcoatRoughness: 0.35,
})

/** LED / accesorio ámbar. */
export const accentAmber = new MeshStandardMaterial({
  color: palette.accentAmber,
  metalness: 0.2,
  roughness: 0.35,
  emissive: palette.accentAmber,
  emissiveIntensity: 0.35,
})

/** Patas de los dedos de la pinza (goma negra). */
export const rubber = new MeshPhysicalMaterial({
  color: palette.rubber,
  metalness: 0.0,
  roughness: 0.75,
})

/** Vaina del brazo (translúcida), útil para ver estructura interna. */
export const armGlass = new MeshPhysicalMaterial({
  color: palette.glass,
  metalness: 0.6,
  roughness: 0.2,
  transparent: true,
  opacity: 0.12,
  side: 0,
  depthWrite: false,
})

/** Cuerpo exterior del motor de la articulación (cubo dentado). */
export const jointHousing = new MeshStandardMaterial({
  color: palette.bodyDark,
  metalness: 0.5,
  roughness: 0.5,
})

/** Lista de referencia para depuración / uso en otros módulos. */
export const materials = {
  armBody,
  armAccent,
  armLight,
  jointMetal,
  innerDark,
  accentCyan,
  accentAmber,
  rubber,
  armGlass,
  jointHousing,
}

/**
 * Devuelve una copia profunda de un material con color personalizado.
 * Se usa para piezas pequeñas (tornillos, cubos) sin mutar materiales compartidos.
 */
export function tinted(material, color) {
  const m = material.clone()
  m.color.set(color)
  return m
}