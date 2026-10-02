import * as THREE from 'three/webgpu';
import {
  Fn, If, color, hash, instanceIndex, instancedArray, max, mix, mod, step, uint, uv, vec3, vec4, sin, cos
} from 'three/tsl';
import { createExtraVisuals } from './slideVisuals.js';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // ========================================================
  // DIAPOSITIVA 1 (Índice 0) - Onda Topográfica Fluida
  // ========================================================
  const slide0Group = new THREE.Group();
  scene.add(slide0Group);
  slide0Group.visible = false;
  
  const waveGeo = new THREE.PlaneGeometry(45, 25, 60, 40);
  const waveMat = new THREE.MeshBasicMaterial({ 
    color: 0xff5500, wireframe: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending 
  });
  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.rotation.x = -Math.PI / 2.2;
  waveMesh.position.y = -5;
  slide0Group.add(waveMesh);
  
  const origWaveZ = new Float32Array(waveGeo.attributes.position.count);
  for(let i=0; i < origWaveZ.length; i++) origWaveZ[i] = waveGeo.attributes.position.getZ(i);

  // ========================================================
  // DIAPOSITIVA 2 (Índice 1) - Enjambre de Osciladores (Mejorado: más visible y brillante)
  // ========================================================
  const slide1Group = new THREE.Group();
  scene.add(slide1Group);
  slide1Group.visible = false;
  
  const swarmCount = 800; // Más partículas
  const swarmGeo = new THREE.BufferGeometry();
  const swarmPos = new Float32Array(swarmCount * 3);
  const swarmPhases = new Float32Array(swarmCount);
  for(let i=0; i < swarmCount; i++) {
    swarmPhases[i] = Math.random() * Math.PI * 2;
    swarmPos[i*3] = (Math.random() - 0.5) * 30;
    swarmPos[i*3+1] = (Math.random() - 0.5) * 18;
    swarmPos[i*3+2] = (Math.random() - 0.5) * 12;
  }
  swarmGeo.setAttribute('position', new THREE.BufferAttribute(swarmPos, 3));
  // Puntos más grandes (size: 0.35) y opacidad total para máxima visibilidad sobre la foto
  const swarmMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 0.35, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
  const swarmMesh = new THREE.Points(swarmGeo, swarmMat);
  slide1Group.add(swarmMesh);

  // ========================================================
  // DIAPOSITIVA 3 (Índice 2) - Túnel con Colores UPB (Oro, Rojo, Negro/Gris puro)
  // ========================================================
  const slide2Group = new THREE.Group();
  scene.add(slide2Group);
  slide2Group.visible = false;
  
  const tunnelFrames = [];
  // Colores institucionales UPB: Rojo caridad/valor, Oro fe/constancia, Blanco/Gris ciencia/modestia
  const upbColors = [0xdc2626, 0xf59e0b, 0xffffff, 0xb91c1c, 0xfbbf24]; 
  for(let i=0; i < 28; i++) {
    const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(16, 9));
    const frameMat = new THREE.LineBasicMaterial({ 
      color: upbColors[i % upbColors.length], 
      transparent: true, 
      opacity: 0,
      linewidth: 2 
    });
    const frame = new THREE.LineSegments(frameGeo, frameMat);
    frame.position.z = -i * 1.5;
    slide2Group.add(frame);
    tunnelFrames.push(frame);
  }

  // ========================================================
  // DIAPOSITIVA 4 (Índice 3) - Entramado Geométrico
  // ========================================================
  const slide4Group = new THREE.Group();
  scene.add(slide4Group);
  slide4Group.visible = false;

  const numGeoLines = 60;
  const slide4Positions = [];
  const slide4Velocities = [];
  const slide4Colors = [];

  for (let i = 0; i < numGeoLines; i++) {
    const x1 = (Math.random() - 0.5) * 22;
    const y1 = (Math.random() - 0.5) * 13;
    const x2 = (Math.random() - 0.5) * 22;
    const y2 = (Math.random() - 0.5) * 13;

    slide4Positions.push(x1, y1, 0, x2, y2, 0);
    slide4Velocities.push(
      (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0,
      (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0
    );

    const isBlack = Math.random() > 0.5;
    const colVal = isBlack ? 0x111111 : 0xffffff;
    slide4Colors.push(colVal, colVal);
  }

  const slide4Geo = new THREE.BufferGeometry();
  slide4Geo.setAttribute('position', new THREE.Float32BufferAttribute(slide4Positions, 3));
  slide4Geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(slide4Colors.flatMap(c => [((c >> 16) & 255)/255, ((c >> 8) & 255)/255, (c & 255)/255])), 3));

  const slide4Mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2, transparent: true, opacity: 0.95 });
  const slide4Lines = new THREE.LineSegments(slide4Geo, slide4Mat);
  slide4Group.add(slide4Lines);

  // ========================================================
  // DIAPOSITIVA 5 (Índice 4) - Planos isométricos
  // ========================================================
  const slide5Group = new THREE.Group();
  scene.add(slide5Group);
  slide5Group.visible = false;

  const planeCount = 14;
  const stackedPlanes = [];
  const planeGeo = new THREE.PlaneGeometry(3.5, 3.5);

  const mix = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < planeCount; i++) {
    const ratio = i / (planeCount - 1);
    const r = mix(0.12, 0.98, ratio);
    const g = mix(0.25, 0.25, ratio);
    const b = mix(0.55, 0.18, ratio);

    const planeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b), transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });

    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.position.set((i - planeCount / 2) * 0.25, (i - planeCount / 2) * 0.25, (i - planeCount / 2) * 0.3);
    
    slide5Group.add(planeMesh);
    stackedPlanes.push({ mesh: planeMesh, material: planeMat, baseIndex: i });
  }

  // DIAPOSITIVAS 6 a 13
  const extraVisuals = createExtraVisuals(scene);

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    p.assign(vec3(0.0));
    v.assign(vec3(0.0));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    p.addAssign(vec3(0.0));
  })().compute(count).setName('Update Particles');

  const material = new THREE.SpriteNodeMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  material.positionNode = positionBuffer.toAttribute();
  
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() { renderer.compute(initParticles); }
  function stepSimulation() { renderer.compute(updateParticles); }

  function setSlideMode(slideIndex) {
    slide0Group.visible = (slideIndex === 0);
    slide1Group.visible = (slideIndex === 1);
    slide2Group.visible = (slideIndex === 2);
    slide4Group.visible = (slideIndex === 3);
    slide5Group.visible = (slideIndex === 4);
    mesh.visible = false; 
    extraVisuals.setActive(slideIndex);
  }

  function updateVisualsAnimation(time) {
    // Slide 1: Onda Topográfica
    if (slide0Group.visible) {
      const posAttr = waveGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = origWaveZ[i] + Math.sin(time * 1.5 + x * 0.2) * 1.2 + Math.cos(time * 1.2 + y * 0.2) * 1.2;
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;
      const hue = (0.04 + Math.sin(time * 0.2) * 0.04) % 1.0; 
      waveMat.color.setHSL(hue, 0.9, 0.5); 
    }

    // Slide 2: Enjambre brillante
    if (slide1Group.visible) {
      const posAttr = swarmGeo.attributes.position;
      for (let i = 0; i < swarmCount; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        const phase = swarmPhases[i];
        x += Math.sin(time * 0.6 + phase) * 0.03;
        y += Math.cos(time * 0.7 + phase) * 0.03;
        posAttr.setX(i, x);
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      slide1Group.rotation.y = Math.sin(time * 0.2) * 0.12;
      slide1Group.rotation.x = Math.cos(time * 0.15) * 0.12;
    }

    // Slide 3: Túnel UPB
    if (slide2Group.visible) {
      tunnelFrames.forEach((frame) => {
        frame.position.z += 0.18;
        if (frame.position.z > 2) frame.position.z -= 28 * 1.5;
        const dist = Math.abs(frame.position.z - 2);
        frame.material.opacity = Math.max(0, 1.1 - (dist / (28 * 1.3)));
      });
      slide2Group.rotation.z = Math.sin(time * 0.25) * 0.12;
    }

    // Slide 4: Entramado
    if (slide4Group.visible) {
      const posAttr = slide4Geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        x += slide4Velocities[i * 3];
        y += slide4Velocities[i * 3 + 1];
        if (x > 11 || x < -11) slide4Velocities[i * 3] *= -1;
        if (y > 7 || y < -7) slide4Velocities[i * 3] *= -1;
        posAttr.setXY(i, x, y);
      }
      posAttr.needsUpdate = true;
    }

    // Slide 5: Planos
    if (slide5Group.visible) {
      slide5Group.rotation.y = Math.sin(time * 0.5) * 0.4 + 0.2;
      slide5Group.rotation.x = Math.cos(time * 0.4) * 0.25;
      slide5Group.rotation.z = Math.sin(time * 0.25) * 0.1;
      stackedPlanes.forEach((item, idx) => {
        const breathe = Math.sin(time * 2.0 + idx * 0.35) * 0.12;
        item.mesh.position.z = (item.baseIndex - planeCount / 2) * 0.32 + breathe;
        const pulse = 0.3 + 0.25 * Math.sin(time * 3.0 + idx * 0.4);
        item.material.opacity = pulse;
        const scaleWave = 1.0 + Math.sin(time * 1.5 + idx * 0.2) * 0.04;
        item.mesh.scale.set(scaleWave, scaleWave, 1.0);
      });
    }

    extraVisuals.update(time);
  }

  function dispose() {
    waveGeo.dispose(); waveMat.dispose();
    swarmGeo.dispose(); swarmMat.dispose();
    tunnelFrames.forEach(f => { f.geometry.dispose(); f.material.dispose(); });
    geometry.dispose(); material.dispose();
    planeGeo.dispose(); stackedPlanes.forEach(p => p.material.dispose());
    slide4Geo.dispose(); slide4Mat.dispose();
    extraVisuals.dispose();
    scene.remove(mesh);
    scene.remove(slide0Group);
    scene.remove(slide1Group);
    scene.remove(slide2Group);
    scene.remove(slide5Group);
    scene.remove(slide4Group);
  }

  return { count, positionBuffer, velocityBuffer, reset, stepSimulation, dispose, setSlideMode, updateVisualsAnimation };
}