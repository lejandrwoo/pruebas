import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.35),
    maxSpeed: uniform(5.0),
    boundsSize: uniform(35.0), 
    particleSize: uniform(0.015),

    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    radialEnabled: uniform(1.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.2),
    softening: uniform(0.35),

    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(1.4),

    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.12),

    colorSlow: uniform(new THREE.Color('#46a6ff')),
    colorFast: uniform(new THREE.Color('#ffb35a')),

    time: uniform(0.0),
    ecosystemMode: uniform(0.0),
    constellationMode: uniform(0.0),
    sphereMode: uniform(0.0) // NUEVO: Modo esfera / planeta
  };
}