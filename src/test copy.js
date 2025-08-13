import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IK, IKChain, IKJoint, IKHelper, IKBallConstraint } from 'three-ik';

// Сцена, камера, рендер
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Свет
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

// IK система
const ik = new IK();
const chain = new IKChain();
const constraints = [new IKBallConstraint(90)];

// Цель, за которую будет тянуться последняя кость
const movingTarget = new THREE.Mesh(
    new THREE.SphereGeometry(0.05),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
scene.add(movingTarget);

// Загрузчик модели
const loader = new GLTFLoader();
let skinnedMesh, lastBone;

loader.load('models/model.glb', (gltf) => {
    scene.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true); // обновляем матрицы перед поиском костей

    // Находим первый SkinnedMesh
    skinnedMesh = gltf.scene.getObjectByProperty('type', 'SkinnedMesh');
    if (!skinnedMesh) {
        console.error('SkinnedMesh не найден!');
        return;
    }

    skinnedMesh.pose();
    const bones = skinnedMesh.skeleton.bones;

    bones.forEach((bone, i) => {
        if (i === bones.length - 1) {
            // Последняя кость — effector
            lastBone = bone;
            movingTarget.position.copy(bone.getWorldPosition(new THREE.Vector3()));
            chain.add(new IKJoint(bone, { constraints }), { target: movingTarget });
        } else {
            chain.add(new IKJoint(bone, { constraints }));
        }
    });

    ik.add(chain);
    scene.add(ik.getRootBone());

    const helper = new IKHelper(ik);
    scene.add(helper);
});

// Движение цели мышкой
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // плоскость Z=0
const intersectionPoint = new THREE.Vector3();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
        movingTarget.position.copy(intersectionPoint);
    }
});

// Анимация
function animate() {
    requestAnimationFrame(animate);

    if (ik) {
        ik.solve(); // сначала IK
    }
    if (skinnedMesh) {
        skinnedMesh.skeleton.update();
        skinnedMesh.updateMatrixWorld(true);
    }

    renderer.render(scene, camera);
}

animate();
