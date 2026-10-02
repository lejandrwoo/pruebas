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
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  const applyPreset = (id) => {
    params.windEnabled.value = 0;
    params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0;
    params.dragEnabled.value = 0;
    params.wind.value.set(0, 0, 0);
    params.initialSpeed.value = 0;
    params.particleSize.value = 0.015; 
    
    params.colorSlow.value.set('#46a6ff'); 
    params.colorFast.value.set('#ffb35a'); 
    params.attractor.value.set(0, 0, 0); 
    
    params.ecosystemMode.value = 0.0;
    params.constellationMode.value = 0.0;
    params.sphereMode.value = 0.0;
    simulation.setSlideMode(-1);

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
      params.radialStrength.value = 0.5;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 1.5;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.15;
    }
  };

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  let currentSlide = 0;
  const slides = document.querySelectorAll('.slide');
  const bgSlides = document.querySelectorAll('.bg-slide');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  function updateSlides() {
    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === currentSlide);
    });
    bgSlides.forEach((bg, index) => {
      bg.classList.toggle('active', index === currentSlide);
    });

    // Envía el número de slide actual al gestor de visuales en createSimulation.js
    simulation.setSlideMode(currentSlide);

    switch(currentSlide) {
      case 0: // Diapositiva 1
        break;
      
      case 1: // Diapositiva 2
        applyPreset('inertia'); 
        params.constellationMode.value = 1.0;
        params.particleSize.value = 0.014; 
        simulation.reset();
        // Reimponemos el slide mode después del preset
        simulation.setSlideMode(currentSlide); 
        break;

      case 2: // Diapositiva 3
        applyPreset('inertia');
        params.sphereMode.value = 1.0; 
        params.particleSize.value = 0.015;
        simulation.reset();
        // Reimponemos el slide mode después del preset
        simulation.setSlideMode(currentSlide); 
        break;

      case 3: // Diapositiva 4
      case 4: // Diapositiva 5
        break;
        
      default: 
        // A partir de la diapositiva 6 en adelante (índices 5 al 12)
        // Dejamos que 'slideVisuals.js' trabaje sin que 'applyPreset' sobrescriba
        simulation.setSlideMode(currentSlide);
        break;
    }
  }

  renderer.setAnimationLoop(() => {
    const time = performance.now() * 0.001; 
    params.time.value = time; 

    simulation.updateVisualsAnimation(time);

    if (currentSlide === 0) {
      params.attractor.value.set(
        Math.sin(time * 0.8) * 8.0, 
        -2.0,                       
        Math.cos(time * 0.5) * 4.0  
      );
    }

    simulation.stepSimulation();
    renderer.render(scene, camera);
  });

  addEventListener('keydown', (event) => {
    if (event.code === 'ArrowRight' || event.code === 'Space') nextBtn.click();
    if (event.code === 'ArrowLeft') prevBtn.click();
  });

  updateSlides(); 

  if (prevBtn && nextBtn) {
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

// --- SELECTOR DE IDIOMA (ES / PORT) ---
const TITLES = {
  es: 'Presentación - Relevo Generacional',
  pt: 'Apresentação - Renovação Geracional'
};

function setupLanguage() {
  const toggle = document.getElementById('lang-toggle');
  if (!toggle) return;

  function setLang(lang) {
    document.documentElement.lang = lang;
    document.title = TITLES[lang];

    document.querySelectorAll(`#presentation [data-${lang}]`).forEach((el) => {
      el.innerHTML = el.dataset[lang];
    });

    toggle.querySelectorAll('span').forEach((s) => {
      s.classList.toggle('active', s.dataset.lang === lang);
    });

    try { localStorage.setItem('lang', lang); } catch {}
  }

  toggle.addEventListener('click', () => {
    setLang(document.documentElement.lang === 'pt' ? 'es' : 'pt');
    toggle.blur(); // evita que la barra espaciadora vuelva a activar el botón
  });

  let saved = 'pt';
  try { saved = localStorage.getItem('lang') || 'pt'; } catch {}
  setLang(saved);
}

setupLanguage();
main().catch(console.error);