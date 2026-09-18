import * as THREE from 'three/webgpu';
import {
  Fn, If, color, hash, instanceIndex, instancedArray, max, mix, mod, step, uint, uv, vec3, vec4, sin, cos
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // Grupo para los triángulos de la diapositiva 1
  const triangleGroup = new THREE.Group();
  scene.add(triangleGroup);
  triangleGroup.visible = false;

  const triangleCount = 140;
  const linePositions = [];
  for (let i = 0; i < triangleCount; i++) {
    const x = (Math.random() - 0.5) * 14;
    const y = (Math.random() - 0.5) * 9;
    const z = (Math.random() - 0.5) * 6;
    const s = 0.6 + Math.random() * 1.8;

    const p1 = [x, y, z];
    const p2 = [x + s, y + s * 0.7, z - s * 0.4];
    const p3 = [x - s * 0.5, y + s, z + s * 0.5];

    linePositions.push(...p1, ...p2);
    linePositions.push(...p2, ...p3);
    linePositions.push(...p3, ...p1);
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xff3300,
    transparent: true,
    opacity: 0.85
  });
  const wireframeTriangles = new THREE.LineSegments(lineGeo, lineMat);
  triangleGroup.add(wireframeTriangles);

  // NUEVO: Restauramos el grupo para la Diapositiva 5 (Planos isométricos apilados con gradientes y animaciones)
  const slide5Group = new THREE.Group();
  scene.add(slide5Group);
  slide5Group.visible = false;

  const planeCount = 14;
  const stackedPlanes = [];
  const planeGeo = new THREE.PlaneGeometry(3.5, 3.5);

  for (let i = 0; i < planeCount; i++) {
    const ratio = i / (planeCount - 1);
    const r = mix(0.12, 0.98, ratio);
    const g = mix(0.25, 0.25, ratio);
    const b = mix(0.55, 0.18, ratio);

    const planeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(r, g, b),
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.position.set((i - planeCount / 2) * 0.25, (i - planeCount / 2) * 0.25, (i - planeCount / 2) * 0.3);
    
    slide5Group.add(planeMesh);
    stackedPlanes.push({ mesh: planeMesh, material: planeMat, baseIndex: i });
  }

  // Grupo para la Diapositiva 4 (Entramado geométrico Verónica Presta)
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

  const slide4Mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    linewidth: 2,
    transparent: true,
    opacity: 0.95
  });
  const slide4Lines = new THREE.LineSegments(slide4Geo, slide4Mat);
  slide4Group.add(slide4Lines);

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));

    const normalPos = vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45));
    
    const phi = r1.mul(6.2831853); 
    const costheta = r2.mul(2.0).sub(1.0); 
    const sintheta = (max(0.0, vec3(1.0).x.sub(costheta.mul(costheta)))).sqrt();
    const radius = mix(3.2, 3.8, r3.sqrt());

    const sphereX = sintheta.mul(cos(phi)).mul(radius);
    const sphereY = sintheta.mul(sin(phi)).mul(radius);
    const sphereZ = costheta.mul(radius);
    const spherePos = vec3(sphereX, sphereY, sphereZ);

    p.assign(mix(normalPos, spherePos, params.sphereMode));
    v.assign(vec3(0.0));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    If(params.constellationMode.greaterThan(0.5), () => {
      const r1 = hash(instanceIndex.add(uint(11)));
      const r2 = hash(instanceIndex.add(uint(23)));
      const r3 = hash(instanceIndex.add(uint(37)));

      const angle = r1.mul(6.2831853).add(params.time.mul(0.15)); 
      const radius = r2.sqrt().mul(5.5);

      const internalWaveX = sin(params.time.mul(2.0).add(r1.mul(10.0))).mul(0.3);
      const internalWaveY = cos(params.time.mul(2.5).add(r2.mul(10.0))).mul(0.15);

      const orbitX = sin(angle).mul(radius).add(2.0).add(internalWaveX);
      const orbitY = cos(angle).mul(radius.mul(0.3)).sub(2.0).add(internalWaveY);
      const orbitZ = r3.sub(0.5).mul(1.5);

      p.assign(vec3(orbitX, orbitY, orbitZ));
      v.assign(vec3(0.0));
    })
    .ElseIf(params.sphereMode.greaterThan(0.5), () => {
      const r1 = hash(instanceIndex.add(uint(11)));
      const r2 = hash(instanceIndex.add(uint(23)));
      const r3 = hash(instanceIndex.add(uint(37)));

      const phi = r1.mul(6.2831853).add(params.time.mul(0.4)); 
      const costheta = r2.mul(2.0).sub(1.0);
      const sintheta = (max(0.0, vec3(1.0).x.sub(costheta.mul(costheta)))).sqrt();
      const breathing = sin(params.time.mul(2.2).add(r3.mul(12.0))).mul(0.25);
      const radius = mix(3.0, 4.0, r3.sqrt()).add(breathing);

      const sphereX = sintheta.mul(cos(phi)).mul(radius);
      const sphereY = sintheta.mul(sin(phi)).mul(radius);
      const sphereZ = costheta.mul(radius);

      p.assign(vec3(sphereX, sphereY, sphereZ));
      v.assign(vec3(0.0));
    })
    .Else(() => {
      const dt = params.dt.mul(params.timeScale);
      const force = vec3(0.0).toVar();

      force.addAssign(params.wind.mul(params.windEnabled));

      const toAttractor = params.attractor.sub(p);
      const distance = max(toAttractor.length(), params.softening);
      const radialDirection = toAttractor.div(distance);
      const radialForce = radialDirection
        .mul(params.radialStrength)
        .div(distance.pow(2))
        .mul(params.radialEnabled);
      force.addAssign(radialForce);

      const zAxis = vec3(0.0, 0.0, 1.0);
      const tangent = zAxis.cross(radialDirection);
      force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

      force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

      v.addAssign(force.mul(dt));

      const speed = v.length();
      If(speed.greaterThan(params.maxSpeed), () => {
        v.assign(v.normalize().mul(params.maxSpeed));
      });

      p.addAssign(v.mul(dt));

      const half = params.boundsSize.mul(0.5);
      p.assign(mod(p.add(half), params.boundsSize).sub(half));
    });

  })().compute(count).setName('Update Particles');

  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const baseSize = mix(params.particleSize, params.particleSize.mul(mix(0.4, 2.5, hash(instanceIndex.add(uint(7))))), params.constellationMode);
  const zDepthFactor = mix(1.0, positionBuffer.element(instanceIndex).z.add(4.0).mul(0.25), params.sphereMode);
  material.scaleNode = baseSize.mul(zDepthFactor);

  material.colorNode = Fn(() => {
    const h = hash(instanceIndex);
    const r1 = hash(instanceIndex.add(uint(11)));
    const r2 = hash(instanceIndex.add(uint(23)));
    const r3 = hash(instanceIndex.add(uint(37)));

    const deepBlue = color('#0f172a');
    const vibrantBlue = color('#3b82f6');
    const neonPurple = color('#8b5cf6');
    const pureWhite = color('#ffffff');

    let coldColor = mix(deepBlue, vibrantBlue, h);
    coldColor = mix(coldColor, neonPurple, step(0.4, h));
    coldColor = mix(coldColor, pureWhite, step(0.85, h));

    const vividRed = color('#ff0033');
    const brightRed = color('#ff3366');
    const deepBlack = color('#000000');

    const waveMotion = sin(params.time.mul(2.2).add(r3.mul(15.0)));
    const phi = r1.mul(6.2831853);
    const costheta = r2.mul(2.0).sub(1.0);
    
    const linePattern = sin(phi.mul(6.0).add(costheta.mul(10.0)).add(waveMotion)).abs();
    const isLine = step(0.76, linePattern);
    const blackLinePattern = cos(phi.mul(14.0).sub(costheta.mul(12.0)).sub(params.time.mul(1.2))).abs();
    const isBlackLine = step(0.91, blackLinePattern);
    const isCoreWhite = step(0.90, h);

    let planetColor = mix(vividRed, brightRed, h);
    planetColor = mix(planetColor, pureWhite, isLine);
    planetColor = mix(planetColor, deepBlack, isBlackLine);
    planetColor = mix(planetColor, pureWhite, isCoreWhite);

    return mix(planetColor, coldColor, params.constellationMode);
  })();

  const hParticle = hash(instanceIndex);
  const twinkle = sin(params.time.mul(9.0).add(hParticle.mul(40.0))).mul(0.5).add(0.5);
  const normalOpacity = step(uv().xy.sub(0.5).length(), 0.5).mul(0.7);
  const depthOpacity = mix(0.4, 1.3, positionBuffer.element(instanceIndex).z.add(4.0).mul(0.2));
  const starryOpacity = step(uv().xy.sub(0.5).length(), 0.5).mul(mix(0.2, 1.0, twinkle.pow(1.5))).mul(depthOpacity);

  material.opacityNode = starryOpacity;

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() { renderer.compute(initParticles); }
  function stepSimulation() { renderer.compute(updateParticles); }

  function setSlideMode(slideIndex) {
    triangleGroup.visible = (slideIndex === 0);
    slide5Group.visible = (slideIndex === 4); // Activo en la diapositiva 5
    slide4Group.visible = (slideIndex === 3);
    mesh.visible = (slideIndex !== 0 && slideIndex !== 1 && slideIndex !== 3 && slideIndex !== 4);
  }

  function updateVisualsAnimation(time) {
    if (triangleGroup.visible) {
      triangleGroup.rotation.y = time * 0.35;
      triangleGroup.rotation.x = Math.sin(time * 0.4) * 0.25;
      triangleGroup.rotation.z = Math.cos(time * 0.25) * 0.15;
      const scalePulse = 1.0 + Math.sin(time * 2.0) * 0.12;
      triangleGroup.scale.set(scalePulse, scalePulse, scalePulse);

      lineMat.opacity = 0.5 + 0.4 * Math.sin(time * 3.0);
      const greenChannel = 0.15 + 0.4 * Math.abs(Math.sin(time * 1.2));
      lineMat.color.setRGB(1.0, greenChannel, 0.05);
    }

    // Animación de los planos isométricos para la Diapositiva 5
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

    if (slide4Group.visible) {
      const posAttr = slide4Geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);

        x += slide4Velocities[i * 3];
        y += slide4Velocities[i * 3 + 1];

        if (x > 11 || x < -11) slide4Velocities[i * 3] *= -1;
        if (y > 7 || y < -7) slide4Velocities[i * 3 + 1] *= -1;

        posAttr.setXY(i, x, y);
      }
      posAttr.needsUpdate = true;
    }
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    lineGeo.dispose();
    lineMat.dispose();
    planeGeo.dispose();
    stackedPlanes.forEach(p => p.material.dispose());
    slide4Geo.dispose();
    slide4Mat.dispose();
    scene.remove(mesh);
    scene.remove(triangleGroup);
    scene.remove(slide5Group);
    scene.remove(slide4Group);
  }

  return { count, positionBuffer, velocityBuffer, reset, stepSimulation, dispose, setSlideMode, updateVisualsAnimation };
}