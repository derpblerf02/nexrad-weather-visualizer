import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.136.0/build/three.module.js';
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera position for CONUS view
camera.position.set(0, 100, 150);
camera.lookAt(0, 0, 0);

// Ground plane (CONUS map)
const groundGeometry = new THREE.PlaneGeometry(200, 150); // Scaled for CONUS (approx. 4000km x 3000km)
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
scene.add(ground);

// Radar stations (approximate CONUS locations)
const radarStations = [
  { x: -80, z: 40 },  // Northwest (e.g., Seattle)
  { x: -40, z: 50 },  // Northern Plains (e.g., Minneapolis)
  { x: 0, z: 30 },    // Midwest (e.g., Chicago)
  { x: 40, z: 20 },   // Southeast (e.g., Atlanta)
  { x: -60, z: -20 }, // Southwest (e.g., Phoenix)
  { x: 60, z: -30 },  // Northeast (e.g., New York)
];
const pulses = [];
radarStations.forEach(pos => {
  const radar = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  radar.position.set(pos.x, 0.5, pos.z);
  scene.add(radar);

  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 })
  );
  pulse.position.set(pos.x, 0.5, pos.z);
  scene.add(pulse);
  pulses.push({ mesh: pulse, radius: 1, active: false });
});

// Mock CAPE data (simplified for CONUS)
const mockCapeData = [
  { x: -80, z: 40, cape: 1500 },  // Northwest
  { x: -40, z: 50, cape: 2000 },  // Northern Plains
  { x: 0, z: 30, cape: 3000 },    // Midwest
  { x: 40, z: 20, cape: 2500 },   // Southeast
  { x: -60, z: -20, cape: 1000 }, // Southwest
  { x: 60, z: -30, cape: 1800 },  // Northeast
];

// CAPE field (blue → red heatmap)
const capeGeometry = new THREE.PlaneGeometry(200, 150, 100, 100);
const capeMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, capeData: { value: [] } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 capeData[6]; // [x, z, cape]
    varying vec2 vUv;
    void main() {
      float intensity = 0.0;
      for (int i = 0; i < 6; i++) {
        float dist = distance(vUv * vec2(200.0, 150.0) - vec2(100.0, 75.0), capeData[i].xy);
        intensity += capeData[i].z / 5000.0 * exp(-dist * 0.05);
      }
      vec3 color = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), clamp(intensity, 0.0, 1.0));
      gl_FragColor = vec4(color, 0.5);
    }
  `,
  transparent: true
});
const capePlane = new THREE.Mesh(capeGeometry, capeMaterial);
capePlane.position.y = 2;
scene.add(capePlane);

// Update CAPE field with mock data
capeMaterial.uniforms.capeData.value = mockCapeData.map(d => new THREE.Vector3(d.x, d.z, d.cape));

// Station vectors
const vectors = [];
for (let x = -90; x <= 90; x += 20) {
  for (let z = -60; z <= 60; z += 20) {
    const geometry = new THREE.ConeGeometry(0.5, 2, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const arrow = new THREE.Mesh(geometry, material);
    arrow.position.set(x, 0.5, z);
    scene.add(arrow);
    vectors.push(arrow);
  }
}

// Station plots (bloom effect)
const stations = [];
const stationData = [
  { x: -70, z: 30 },  // West
  { x: -20, z: 40 },  // North
  { x: 20, z: 10 },   // Central
  { x: 50, z: -10 },  // East
];
stationData.forEach(pos => {
  const station = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  station.position.set(pos.x, 0.5, pos.z);
  scene.add(station);
  stations.push({ mesh: station, active: false, scale: 1 });
});

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
      if (pulse.radius > 40) {
        pulse.radius = 1;
        pulse.mesh.scale.set(1, 1, 1);
        pulse.active = false;
      }
    } else if (Math.random() < 0.01) {
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
      const targetDir = minDist < closestPulse.radius ? dir : dir.negate();
      arrow.lookAt(arrow.position.clone().add(targetDir));
      arrow.rotateX(Math.PI / 2);
    }
  });

  // Station bloom
  stations.forEach(station => {
    let activated = false;
    pulses.forEach(pulse => {
      const dist = station.mesh.position.distanceTo(pulse.mesh.position);
      if (dist < pulse.radius && pulse.active) activated = true;
    });
    station.active = activated;
    station.scale = station.active ? Math.min(station.scale + 0.1, 2) : Math.max(station.scale - 0.1, 1);
    station.mesh.scale.set(station.scale, station.scale, station.scale);
  });

  renderer.render(scene, camera);
}
animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
