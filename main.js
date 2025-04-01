import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.136.0/build/three.module.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic camera positioning
camera.position.set(0, 50, 100);
camera.lookAt(0, 0, 0);

// Simplified U.S. map plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
scene.add(ground);

// Radar stations (Midwest + Southeast U.S.)
const radarStations = [
  { x: -20, z: 20 }, // Example: Midwest (e.g., Kansas City)
  { x: 20, z: -20 }, // Example: Southeast (e.g., Atlanta)
];
const pulses = [];
radarStations.forEach(pos => {
  // Radar station marker
  const radar = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  radar.position.set(pos.x, 1, pos.z);
  scene.add(radar);

  // Radar pulse
  const pulseGeometry = new THREE.SphereGeometry(1, 32, 32);
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 });
  const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
  pulse.position.set(pos.x, 1, pos.z);
  scene.add(pulse);
  pulses.push({ mesh: pulse, radius: 1, active: false });
});

// CAPE field (heatmap plane)
const capeGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
const capeMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, pulsePositions: { value: radarStations.map(p => new THREE.Vector3(p.x, 1, p.z)) } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 pulsePositions[2];
    varying vec2 vUv;
    void main() {
      float intensity = 0.0;
      for (int i = 0; i < 2; i++) {
        float dist = distance(vUv * 100.0 - 50.0, pulsePositions[i].xz);
        intensity += sin(dist * 0.1 - time) * 0.5 + 0.5;
      }
      vec3 color = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), clamp(intensity * 0.5, 0.0, 1.0));
      gl_FragColor = vec4(color, 0.5);
    }
  `,
  transparent: true
});
const capePlane = new THREE.Mesh(capeGeometry, capeMaterial);
capePlane.position.y = 5;
scene.add(capePlane);

// Station vectors
const vectors = [];
for (let x = -40; x <= 40; x += 10) {
  for (let z = -40; z <= 40; z += 10) {
    const geometry = new THREE.ConeGeometry(0.5, 2, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const arrow = new THREE.Mesh(geometry, material);
    arrow.position.set(x, 0.5, z);
    scene.add(arrow);
    vectors.push(arrow);
  }
}

// Animation
let time = 0;
function animate() {
  requestAnimationFrame(animate);

  time += 0.05;
  capeMaterial.uniforms.time.value = time;

  // Pulse animation
  pulses.forEach(pulse => {
    if (pulse.active) {
      pulse.radius += 0.2;
      pulse.mesh.scale.set(pulse.radius, pulse.radius, pulse.radius);
      if (pulse.radius > 50) {
        pulse.radius = 1;
        pulse.mesh.scale.set(1, 1, 1);
        pulse.active = false;
      }
    } else if (Math.random() < 0.02) {
      pulse.active = true;
    }
  });

  // Vector response
  vectors.forEach(arrow => {
    let closestPulse = null;
    let minDist = Infinity;
    pulses.forEach(pulse => {
      const dist = arrow.position.distanceTo(pulse.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        closestPulse = pulse;
      }
    });
    if (closestPulse && closestPulse.active) {
      const dir = closestPulse.mesh.position.clone().sub(arrow.position).normalize();
      const targetDir = minDist < closestPulse.radius ? dir : dir.negate(); // Attract before, repel after
      arrow.lookAt(arrow.position.clone().add(targetDir));
      arrow.rotateX(Math.PI / 2); // Adjust cone orientation
    }
  });

  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});