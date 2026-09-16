import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';

const PARTICLE_COUNT = 131072;

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este proyecto requiere WebGPU para ejecutar compute shaders.');
  }

  const scene = new THREE.Scene();
  scene.background = null; 

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 11);

  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const params = createParameters();
  // Hacer las partículas por defecto más pequeñas
  params.particleSize.value = 0.015; 
  
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  // Fuerzas suavizadas para que sea elegante
  const applyPreset = (id) => {
    params.windEnabled.value = 0;
    params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0;
    params.dragEnabled.value = 0;
    params.wind.value.set(0, 0, 0);
    params.initialSpeed.value = 0;

    if (id === 'inertia') {
      params.initialSpeed.value = 0.2;
    } else if (id === 'wind') {
      params.windEnabled.value = 1;
      params.wind.value.set(0.5, 0, 0);
    } else if (id === 'attract') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 0.8;
    } else if (id === 'repel') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = -0.8;
    } else if (id === 'vortex') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 0.3;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 1.0;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.15;
    }
    simulation.reset();
  };

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  // BUCLE
  renderer.setAnimationLoop(() => {
    simulation.stepSimulation();
    renderer.render(scene, camera);
  });

  // ==========================================
  // LÓGICA DE LA PRESENTACIÓN (TEXTOS + FOTOS)
  // ==========================================
  let currentSlide = 0;
  const slides = document.querySelectorAll('.slide');
  const bgSlides = document.querySelectorAll('.bg-slide');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  function updateSlides() {
    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === currentSlide);
    });
    // Sincronizar las fotos de fondo
    bgSlides.forEach((bg, index) => {
      bg.classList.toggle('active', index === currentSlide);
    });

    // Cambiar las partículas dependiendo del slide
    switch(currentSlide) {
      case 0: applyPreset('vortex'); break; // Título
      case 1: applyPreset('inertia'); break; // Auditorio
      case 3: applyPreset('attract'); break; // Academia + Industria
      case 5: applyPreset('vortex'); break; // Comunidad
      case 9: 
        applyPreset('attract');
        params.radialStrength.value = 1.5; // Unión generaciones
        break; 
      case 11: applyPreset('repel'); break; // Futuro
      default: applyPreset('inertia'); break; // Modo relajado por defecto
    }
  }

  // Teclado para pasar diapositivas cómodamente
  addEventListener('keydown', (event) => {
    if (event.code === 'ArrowRight' || event.code === 'Space') nextBtn.click();
    if (event.code === 'ArrowLeft') prevBtn.click();
  });

  updateSlides(); // Estado inicial

  if(prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentSlide > 0) {
        currentSlide--;
        updateSlides();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        updateSlides();
      }
    });
  }
}

main().catch(console.error);