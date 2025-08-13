import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { IK, IKChain, IKJoint, IKHelper, IKBallConstraint } from 'three-ik';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3, 2, 25);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

// --- Physics world setup (basic plane) ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
const groundBody = new CANNON.Body({ mass: 0 });
const groundShape = new CANNON.Plane();
groundBody.addShape(groundShape);
world.addBody(groundBody);

const normalMaterial = new THREE.MeshNormalMaterial()
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
const cubeMesh = new THREE.Mesh(cubeGeometry, normalMaterial)
cubeMesh.position.x = 5
cubeMesh.position.y = 3
cubeMesh.castShadow = true
scene.add(cubeMesh)
const cubeShape = new CANNON.Box(new CANNON.Vec3(.1, .1, .1))
const cubeBody = new CANNON.Body({ mass: 1 })
cubeBody.addShape(cubeShape)
cubeBody.position.x = cubeMesh.position.x
cubeBody.position.y = cubeMesh.position.y
cubeBody.position.z = cubeMesh.position.z
world.addBody(cubeBody)

const cannonDebugger = CannonDebugger(scene, world, {color: 0xff0000});

const loader = new GLTFLoader();
const ik = new IK();
const chain = new IKChain();
const constraints = [new IKBallConstraint(90)];
let bones = [];

// Create a target that the IK's effector will reach
// for.
const movingTarget = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
movingTarget.position.z = 2;
scene.add(movingTarget);

// ----- THREE.js объект стола -----
const tableGeometry = new THREE.BoxGeometry(5, 0.5, 3); // длина 5, высота 0.5, ширина 3
const tableMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
tableMesh.position.set(5, 0, 0); // поднимем на высоту 1
tableMesh.receiveShadow = true;
scene.add(tableMesh);

// ----- Cannon.js физическое тело стола -----
const tableShape = new CANNON.Box(new CANNON.Vec3(2.5, 0.25, 1.5)); // половина размеров THREE-геометрии
const tableBody = new CANNON.Body({
    mass: 0, // статический объект
    shape: tableShape,
    position: new CANNON.Vec3(2, 1, 0)
});
world.addBody(tableBody);

let skinnedMesh;
let lastBone;
let boneBody;

loader.load('models/model.glb', (gltf) => {
    scene.add(gltf.scene);
    // Ищем SkinnedMesh
    skinnedMesh = gltf.scene.getObjectByProperty('type', 'SkinnedMesh');
    // skinnedMesh.pose();
    if (!skinnedMesh) {
        console.error('SkinnedMesh не найден!');
        return;
    }
    bones = skinnedMesh.skeleton.bones;
    bones.forEach((bone, i) =>
    {
        const target = (i === bones.length - 1) ? movingTarget : null;
        if (target)
        {
            target.position.copy(bone.getWorldPosition(new THREE.Vector3()));
            // Cannon.js физика для последней кости
            const cubeShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
            const cubeBody = new CANNON.Body({ mass: 1 });
            cubeBody.addShape(cubeShape);
            cubeBody.position.copy(bone.getWorldPosition(new THREE.Vector3()));
            // world.addBody(cubeBody);
            lastBone = bone;
            const boneShape = new CANNON.Sphere(0.3);
            boneBody = new CANNON.Body({ mass: 0 });
            boneBody.addShape(boneShape);
            boneBody.position.copy(lastBone.getWorldPosition(new THREE.Vector3()));
            world.addBody(boneBody);

            chain.add(new IKJoint(bone, { constraints }), { target: movingTarget });
        }
        // chain.add(new IKJoint(bone, { constraints }), { target });
        else
        {
            chain.add(new IKJoint(bone, { constraints }));
        }
    });
    // Add the chain to the IK system
    ik.add(chain);
    // Create a helper and add to the scene so we can visualize
    // the bones
    // Ensure the root bone is added somewhere in the scene
    // scene.add(ik.getRootBone());
    const helper = new IKHelper(ik);
    scene.add(helper);

    }, undefined, (err) =>{
        console.error(err);
});

// Raycaster and mouse setup to drag targetBone
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
const intersectionPoint = new THREE.Vector3();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(plane, intersectionPoint))
    {
        movingTarget.position.copy(intersectionPoint);
    }
});

function animate() {
    world.step(1 / 60);
    ik.solve();

    if (lastBone && boneBody)
    {
        const bonePos = lastBone.getWorldPosition(new THREE.Vector3());
        boneBody.position.copy(bonePos);
        cubeMesh.position.copy(lastBone);
        cubeMesh.quaternion.copy(cubeBody.quaternion);
    }

    if (skinnedMesh)
    {
        skinnedMesh.skeleton.update();
        skinnedMesh.updateMatrixWorld(true);
    }

    cannonDebugger.update();
    renderer.render(scene, camera);


    requestAnimationFrame(animate);
}

animate();
