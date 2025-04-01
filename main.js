
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.136.0/build/three.module.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
camera.position.set(0, 50, 100);
camera.lookAt(0, 0, 0);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
scene.add(ground);

// Radar stations
const radarStations = [{ x: -20, z: 20 }, { x: 20, z: -20 }];
const pulses = [];
radarStations.forEach(pos => {
  const radar = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  radar.position.set(pos.x, 1, pos.z);
  scene.add(radar);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 }));
  pulse.position.set(pos.x, 1, pos.z);
  scene.add(pulse);
  pulses.push({ mesh: pulse, radius: 1, active: false });
});

// CAPE field
let weatherData = [];
fetch('http://localhost:5000/weather') // Update to your server URL
  .then(response => response.json())
  .then(data => {
    weatherData = data;
    updateWeatherFields();
  })
  .catch(() => {
    console.log("Using mock data");
    weatherData = [{ lat: 35, lon: -90, cape: 2000, scp: 5 }];
    updateWeatherFields();
  });

const capeGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
const capeMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, weatherData: { value: [] } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec4 weatherData[100]; // [x, z, cape, scp]
    varying vec2 vUv;
    void main() {
      float intensity = 0.0;
      for (int i = 0; i < 100; i++) {
        if (weatherData[i].z > 0.0) {
          float dist = distance(vUv * 100.0 - 50.0, weatherData[i].xy);
          intensity += weatherData[i].z / 5000.0 * exp(-dist * 0.05);
        }
      }
      vec3 color = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), clamp(intensity, 0.0, 1.0));
      gl_FragColor = vec4(color, 0.5);
    }
  `,
  transparent: true
});
const capePlane = new THREE.Mesh(capeGeometry, capeMaterial);
capePlane.position.y = 5;
scene.add(capePlane);

// SCP field
const scpGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
const scpMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, weatherData: { value: [] } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec4 weatherData[100];
    varying vec2 vUv;
    void main() {
      float intensity = 0.0;
      for (int i = 0; i < 100; i++) {
        if (weatherData[i].w > 0.0) {
          float dist = distance(vUv * 100.0 - 50.0, weatherData[i].xy);
          intensity += weatherData[i].w / 10.0 * exp(-dist * 0.05);
        }
      }
      vec3 color = mix(vec3(0.5, 0.5, 0.5), vec3(1.0, 0.0, 1.0), clamp(intensity, 0.0, 1.0));
      gl_FragColor = vec4(color, 0.3);
    }
  `,
  transparent: true
});
const scpPlane = new THREE.Mesh(scpGeometry, scpMaterial);
scpPlane.position.y = 6;
scene.add(scpPlane);

function updateWeatherFields() {
  const mappedData = weatherData.map(d => new THREE.Vector4(d.lon + 50, d.lat + 50, d.cape, d.scp));
  capeMaterial.uniforms.weatherData.value = mappedData;
  scpMaterial.uniforms.weatherData.value = mappedData;
}

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

// Station plots (bloom)
const stations = [];
const stationData = [{ x: -30, z: 30 }, { x: 30, z: -30 }];
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
  scpMaterial.uniforms.time.value = time;

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

});