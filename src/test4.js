import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import { FABRIKSolver } from './lib/IK-threejs/js/IKSolver.js';
import Stats from 'stats.js'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

const stats = new Stats()
// Панель 0 = FPS, 1 = MS, 2 = MB
stats.showPanel(0); 
document.body.appendChild(stats.dom);

// Стили — делаем крупнее
stats.dom.style.position = 'fixed';
stats.dom.style.left = '10px';
stats.dom.style.top = '10px';
stats.dom.style.transform = 'scale(2)';  // увеличиваем панель
stats.dom.style.transformOrigin = 'top left';
stats.dom.style.zIndex = '9999';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-2, 4, 12);
camera.lookAt(5, 4, 0)
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.localClippingEnabled = false;
document.body.appendChild(renderer.domElement);
scene.background = new THREE.Color(0x283f5d); // тёмно-фиолетовый, например







// ---------- СВЕТ ----------
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputEncoding = THREE.sRGBEncoding;

// Убираем твой старый directional и ambient, ставим красивую схему
scene.children = scene.children.filter(obj => !(obj.isLight)); // чистим старые источники

const keyLight = new THREE.DirectionalLight(0xfff2e6, 2);
keyLight.position.set(5, 10, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xff6699, 1);
rimLight.position.set(-5, 10, 5);
scene.add(rimLight);

const ambient = new THREE.AmbientLight(0x444466, 0.6);
scene.add(ambient);



// ---------- ПОСТОБРАБОТКА ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// SSAO — лёгкий объём и глубина
const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 8;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

// Bloom — свечение светлых участков
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.2, // интенсивность
    0.8, // радиус
    0.0 // порог
);
composer.addPass(bloomPass);

// Радиальный градиентный фон (шейдер)
const GradientShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        "color1": { value: new THREE.Color(0x1e1e2e) },
        "color2": { value: new THREE.Color(0x4b4b6a) },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec2 vUv;
        void main() {
            vec2 pos = (gl_FragCoord.xy / resolution.xy) - 0.5;
            float dist = length(pos) * 1.4;
            vec3 grad = mix(color1, color2, dist);
            vec4 sceneColor = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(sceneColor.rgb + grad * 0.2, 1.0);
        }
    `
};

const gradientPass = new ShaderPass(GradientShader);
composer.addPass(gradientPass);

composer.addPass(new OutputPass());

// ---------- РЕСАЙЗ ----------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});




// // Light
// const light = new THREE.DirectionalLight(0x9bb7fb, 5);
// light.position.set(5, 10, 5);
// scene.add(light);

// const amLight = new THREE.AmbientLight(0xfff7cc, 1);
// amLight.position.set(-5, 8, -5);
// scene.add(amLight);

// Создаём "точку" — можно сделать маленькую сферу
const sphereGeometry = new THREE.SphereGeometry(.1, 16, 16);
const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

// --- Physics world setup (basic plane) ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
const groundBody = new CANNON.Body({ mass: 0 });
const groundShape = new CANNON.Plane();
groundBody.addShape(groundShape);
// Повернём плоскость, чтобы она была горизонтальной
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// // Куб
// const normalMaterial = new THREE.MeshNormalMaterial();
// const cubeMesh = new THREE.Mesh(cubeGeometry, normalMaterial);
// cubeMesh.position.set(5, 2, 1);
// cubeMesh.castShadow = true;
// scene.add(cubeMesh);
// // Физика куба
// const cubeShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
// const cubeBody = new CANNON.Body({ mass: 1, position: new CANNON.Vec3(5, 5, 1) });
// cubeBody.addShape(cubeShape);
// world.addBody(cubeBody);

// Коллайдер на последнюю кость
const boneShape = new CANNON.Sphere( 1 );
const boneBody = new CANNON.Body({ mass: 0,});
boneBody.addShape(boneShape);
boneBody.position.set(0, 0, 0);
world.addBody(boneBody);

// Create a target that the IK's effector will reach
// for.
const movingTarget = new THREE.Mesh(new THREE.SphereGeometry(0), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
movingTarget.position.set = (0, 8, 2);
scene.add(movingTarget);

// // ----- THREE.js объект стола -----
// const tableGeometry = new THREE.BoxGeometry(5, 0.5, 3); // длина 5, высота 0.5, ширина 3
// const tableMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
// const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
// tableMesh.position.set(5, 0, 1); // поднимем на высоту 1
// tableMesh.receiveShadow = true;
// scene.add(tableMesh);

// // ----- Cannon.js физическое тело стола -----
// const tableShape = new CANNON.Box(new CANNON.Vec3(2.5, 0.25, 1.5)); // половина размеров THREE-геометрии
// const tableBody = new CANNON.Body({
//     mass: 0, // статический объект
//     shape: tableShape,
//     position: new CANNON.Vec3(5, 0, 1)
// });
// world.addBody(tableBody);

// Definitions
const cannonDebugger = CannonDebugger(scene, world, {color: 0xff0000});
const loader = new GLTFLoader();

let skinnedMesh;
let lastBone;
let ikSolver;
let mixer;
let isFinished = false;
let isMouse = false;
let box;
let box2;
let box3;
let cubeBody;
let cubeBody2;
let cubeBody3;

loader.load('models/model.glb', (gltf) =>
{
    scene.add(gltf.scene);
    // Ищем SkinnedMesh
    skinnedMesh = gltf.scene.getObjectByProperty('type', 'SkinnedMesh');
    // skinnedMesh.pose();
    if (!skinnedMesh) {
        console.error('SkinnedMesh не найден!');
        return;
    }

    mixer = new THREE.AnimationMixer( gltf.scene );
    const clips = gltf.animations;

    //claw 
    lastBone = skinnedMesh.skeleton.bones[10];
    lastBone.add(sphere);
    sphere.position.set(0, lastBone.length || 1, 0);
    const light = new THREE.PointLight(0xf82d57, 3, 1);
    sphere.add(light);
    sphere.position.set(0, .7, 0);

    // Box
    box = scene.getObjectByName("box");
    box2 = box.clone();
    box3 = box.clone();
    scene.add(box2, box3);
    // Физика куба
    const cubeShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    cubeBody = new CANNON.Body({ mass: 1, position: new CANNON.Vec3(5.4, 1.2, 0) });
    cubeBody.addShape(cubeShape);
    world.addBody(cubeBody);
    box.position.copy(cubeBody.position);
    box.quaternion.copy(cubeBody.quaternion);

    const cubeShape2 = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    cubeBody2 = new CANNON.Body({ mass: 1, position: new CANNON.Vec3(6.5, 4, 0) });
    cubeBody2.addShape(cubeShape);
    world.addBody(cubeBody2);
    box2.position.copy(cubeBody2.position);
    box2.quaternion.copy(cubeBody2.quaternion);

    const cubeShape3 = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    cubeBody3 = new CANNON.Body({ mass: 1, position: new CANNON.Vec3(7.6, 1.2, 0) });
    cubeBody3.addShape(cubeShape);
    world.addBody(cubeBody3);
    box3.position.copy(cubeBody3.position);
    box3.quaternion.copy(cubeBody3.quaternion);

    // skinnedMesh.skeleton.bones.forEach(b => console.log(b.name));
    // gltf.animations[0].tracks.forEach(track => console.log(track.name));

    ikSolver = new FABRIKSolver(skinnedMesh.skeleton);
    ikSolver.setIterations( 1 );
    ikSolver.setSquaredDistanceThreshold( 0.0001 );
    ikSolver.createChain(
        [10,9,8,7,6,5,4,3,2,1,0],
        [
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, polar: [0, Math.PI / 2]},
            // {
            //     type: FABRIKSolver.JOINTTYPES.BALLSOCKET,
            //     twist: [0, 0], // без кручения или почти 0
            //     polar: [0, Math.PI / 2], // 0° до 90°
            //     azimuth: [-Math.PI / 2, Math.PI / 2] // -90° до +90°
            // }
        ],
        movingTarget,
        "MyChain"
    );

    const clip = THREE.AnimationClip.findByName( clips, 'ArmatureAction.003' );
    const action = mixer.clipAction( clip );
    action.setLoop(THREE.LoopOnce); // один раз
    action.clampWhenFinished = true; // зафиксировать последнюю позу
    action.play();

    mixer.addEventListener('finished', (e) => {
        isFinished = true;
    });

    // boneBody = new CANNON.Body({ mass: 1 });
    // boneBody.addShape(cubeShape);
    boneBody.position.copy(lastBone.position);
    gltf.scene.traverse(obj => obj.frustumCulled = false);

}, undefined, (err) =>{
    console.error(err);
});


// Raycaster and mouse setup to drag targetBone
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
const intersectionPoint = new THREE.Vector3();

window.addEventListener('mousemove', (event) => {
    isMouse = true;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(plane, intersectionPoint))
    {
        movingTarget.position.copy(intersectionPoint);
    }
});

function animate()
{
    stats.begin()
    world.step(1 / 60);

    if (ikSolver && isFinished && isMouse) ikSolver.update();

    if (lastBone && boneBody)
    {
        const boneWorldPos = new THREE.Vector3();
        lastBone.getWorldPosition(boneWorldPos);

        boneBody.position.copy(boneWorldPos);
        // boneBody.position.y += 1;
    }

    if (box)
    {
        box.position.copy(cubeBody.position);
        box.quaternion.copy(cubeBody.quaternion);
        box2.position.copy(cubeBody2.position);
        box2.quaternion.copy(cubeBody2.quaternion);
        box3.position.copy(cubeBody3.position);
        box3.quaternion.copy(cubeBody3.quaternion);
    }

    if (skinnedMesh)
    {
        skinnedMesh.skeleton.update();
        // skinnedMesh.updateMatrixWorld(true);
        mixer.update( 1 / 60 );
    }

    // cannonDebugger.update();
    // renderer.render(scene, camera);
    composer.render();

    requestAnimationFrame(animate);
    // back.material.uniforms.time.value = performance.now() / 1000;

    stats.end()
}

animate();
