import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { URDFRobot } from 'urdf-loader';
import type { ViewerHandle, JointInfo, FileMap } from '../types';

const ViewerCanvas = forwardRef<ViewerHandle>((_props, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const robotRef = useRef<URDFRobot | null>(null);
  const jointsRef = useRef<JointInfo[]>([]);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const animFrameRef = useRef<number>(0);
  const wireframeRef = useRef<boolean>(false);
  const fileMapRef = useRef<FileMap | null>(null);
  const workingDirRef = useRef<string>('');
  const xacroMapRef = useRef<Map<string, string>>(new Map());

  useImperativeHandle(ref, () => ({
    async loadURDF(fileOrUrl: string | File) {
      return loadURDFModel(fileOrUrl);
    },
    async loadMesh(fileOrUrl: string | File, name: string) {
      await loadMeshModel(fileOrUrl, name);
    },
    setJointAngles(angles: Record<string, number>) {
      applyJointAngles(angles);
    },
    getJointAngles() {
      return getCurrentJointAngles();
    },
    clearScene() {
      clearCurrentModel();
    },
    setAxesVisible(visible: boolean) {
      if (axesRef.current) axesRef.current.visible = visible;
    },
    setGridVisible(visible: boolean) {
      if (gridRef.current) gridRef.current.visible = visible;
    },
    setWireframe(enabled: boolean) {
      wireframeRef.current = enabled;
      applyWireframe(enabled);
    },
    resetCamera(position: [number, number, number]) {
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(...position);
        controlsRef.current.target.set(0, 0.5, 0);
        controlsRef.current.update();
      }
    },
    getModelInfo() {
      return {
        name: '',
        jointCount: jointsRef.current.length,
        linkCount: 0,
      };
    },
    setFileMap(fileMap: FileMap, workingDir: string) {
      fileMapRef.current = fileMap;
      workingDirRef.current = workingDir;
      xacroMapRef.current.clear();
    },
    setBackgroundColor(color: string) {
      if (sceneRef.current) {
        sceneRef.current.background = new THREE.Color(color);
      }
    },
  }));

  const clearCurrentModel = useCallback(() => {
    if (modelRef.current && sceneRef.current) {
      sceneRef.current.remove(modelRef.current);
      disposeObject(modelRef.current);
      modelRef.current = null;
    }
    robotRef.current = null;
    jointsRef.current = [];
  }, []);

  const applyJointAngles = useCallback((angles: Record<string, number>) => {
    const robot = robotRef.current;
    if (!robot) return;

    // Use URDFRobot.setJointValues which handles axis, limits, and mimic joints correctly
    robot.setJointValues(angles);

    // Sync jointRef values with the actual joint state
    jointsRef.current = jointsRef.current.map((j) => ({
      ...j,
      value: robot.joints[j.name]?.jointValue[0] ?? j.value,
    }));
  }, []);

  const getCurrentJointAngles = useCallback(() => {
    const angles: Record<string, number> = {};
    jointsRef.current.forEach((j) => {
      angles[j.name] = j.value;
    });
    return angles;
  }, []);

  const applyWireframe = useCallback((enabled: boolean) => {
    if (!modelRef.current) return;
    modelRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial) {
            m.wireframe = enabled;
          }
        });
      }
    });
  }, []);

  // Resolve a mesh path from the fileMap, handling package:// URIs and relative paths
  const resolveMeshFile = useCallback(
    (filePath: string): File | null => {
      const fileMap = fileMapRef.current;
      if (!fileMap) return null;

      // Normalize path separators
      const normalized = filePath.replaceAll('\\', '/');

      // Try exact match
      if (fileMap.has(normalized)) return fileMap.get(normalized)!;

      // Try matching by filename suffix (handle paths with different prefixes)
      for (const [key, file] of fileMap) {
        const normalizedKey = key.replaceAll('\\', '/');
        if (normalizedKey.endsWith('/' + normalized) || normalized === normalizedKey) {
          return file;
        }
        // Match just the filename at end
        const fileName = normalized.split('/').pop();
        if (fileName && normalizedKey.endsWith('/' + fileName)) {
          return file;
        }
      }

      return null;
    },
    [],
  );

  // Load a mesh file from the fileMap into a THREE.Object3D
  const loadSingleMesh = useCallback(
    async (file: File): Promise<THREE.Object3D> => {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'stl') {
        const loader = new STLLoader();
        const buffer = await file.arrayBuffer();
        const geo = loader.parse(buffer);
        const mat = new THREE.MeshPhongMaterial({ color: 0x888888 });
        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
      }

      if (ext === 'obj') {
        const loader = new OBJLoader();
        const text = await file.text();
        const obj = loader.parse(text);
        return obj;
      }

      if (ext === 'dae') {
        const loader = new ColladaLoader();
        const url = URL.createObjectURL(file);
        try {
          const dae = await loader.loadAsync(url);
          return dae.scene;
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      if (ext === 'glb' || ext === 'gltf') {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();
        const url = URL.createObjectURL(file);
        try {
          const gltf = await loader.loadAsync(url);
          return gltf.scene;
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      console.warn(`URDFLoader: Unsupported mesh format: ${file.name}`);
      return new THREE.Object3D();
    },
    [],
  );

  // Create a loadMeshCb that resolves meshes from the fileMap
  const createMeshLoader = useCallback(
    () => {
      return (
        filePath: string,
        _manager: THREE.LoadingManager,
        done: (mesh: THREE.Object3D, err?: Error) => void,
      ) => {
        const file = resolveMeshFile(filePath);
        if (!file) {
          console.warn(`URDFLoader: Mesh not found in directory: ${filePath}`);
          done(new THREE.Object3D());
          return;
        }

        loadSingleMesh(file)
          .then((mesh) => done(mesh))
          .catch((err) => done(new THREE.Object3D(), err));
      };
    },
    [resolveMeshFile, loadSingleMesh],
  );

  // Process xacro files using xacro-parser, resolving includes from fileMap
  const processXacro = useCallback(
    async (fileOrUrl: string | File): Promise<string> => {
      const { XacroLoader } = await import('xacro-parser');

      if (typeof fileOrUrl === 'string') {
        const loader = new XacroLoader();
        return new Promise((resolve, reject) => {
          loader.load(fileOrUrl, (xml) => resolve(new XMLSerializer().serializeToString(xml)), reject);
        });
      }

      // For File input, override getFileContents to resolve from fileMap
      const xacroLoader = new XacroLoader();
      const fileMap = fileMapRef.current;
      const workingDir = workingDirRef.current;

      // Build a map of xacro include contents to avoid re-parsing
      const xacroCache = xacroMapRef.current;

      if (fileMap && workingDir) {
        const origGetFileContents = (xacroLoader as any).getFileContents.bind(xacroLoader);
        (xacroLoader as any).getFileContents = async (includePath: string) => {
          // Check cache first
          if (xacroCache.has(includePath)) {
            return xacroCache.get(includePath)!;
          }

          // Resolve include path relative to the main xacro file
          const resolvedPath = includePath.replaceAll('\\', '/');
          let file = fileMap.get(resolvedPath);

          if (!file) {
            // Try matching by filename suffix
            for (const [key, value] of fileMap) {
              const normalizedKey = key.replaceAll('\\', '/');
              const fileName = resolvedPath.split('/').pop();
              if (fileName && normalizedKey.endsWith('/' + fileName)) {
                file = value;
                break;
              }
            }
          }

          if (file) {
            const text = await file.text();
            xacroCache.set(includePath, text);
            return text;
          }

          // Fallback to original fetch-based loader
          try {
            return await origGetFileContents(includePath);
          } catch {
            throw new Error(`XacroLoader: Could not load included file: ${includePath}`);
          }
        };
      }

      const text = await fileOrUrl.text();
      return new Promise((resolve, reject) => {
        xacroLoader.parse(text, (xml) => resolve(new XMLSerializer().serializeToString(xml)), reject);
      });
    },
    [],
  );

  const loadURDFModel = useCallback(
    async (fileOrUrl: string | File): Promise<{ joints: JointInfo[] } | null> => {
      const scene = sceneRef.current;
      if (!scene) return null;

      clearCurrentModel();

      try {
        const URDFLoader = (await import('urdf-loader')).default;
        const loader = new URDFLoader();

        const fileName = typeof fileOrUrl === 'string'
          ? fileOrUrl.split('/').pop() || ''
          : fileOrUrl.name;
        const isXacro = fileName.toLowerCase().endsWith('.xacro');
        const fileMap = fileMapRef.current;
        const workingDir = workingDirRef.current;

        // Determine if we have a file map for mesh resolution
        let urdfText: string;
        if (isXacro) {
          urdfText = await processXacro(fileOrUrl);
        } else {
          urdfText = typeof fileOrUrl === 'string'
            ? await (await fetch(fileOrUrl)).text()
            : await fileOrUrl.text();
        }

        if (fileMap && workingDir) {
          // Set up working path - the directory containing the URDF relative to the loaded root
          const urdfRelPath = typeof fileOrUrl === 'string'
            ? ''
            : fileOrUrl.webkitRelativePath || '';
          const urdfDir = urdfRelPath.substring(0, urdfRelPath.lastIndexOf('/') + 1);
          loader.workingPath = urdfDir;

          // Set up packages resolver to handle package:// URIs
          loader.packages = (pkg: string) => pkg + '/';

          // Use the fileMap-based mesh loader
          loader.loadMeshCb = createMeshLoader();
          loader.fetchOptions = {};
        } else {
          // No fileMap - stub mesh loading (URL or standalone file mode)
          loader.loadMeshCb = (_path: string, _manager: THREE.LoadingManager, done: (mesh: THREE.Object3D) => void) => {
            done(new THREE.Object3D());
          };
          loader.fetchOptions = {};
        }

        let robot: URDFRobot;
        if (typeof fileOrUrl === 'string') {
          robot = await new Promise<URDFRobot>((resolve, reject) => {
            loader.load(fileOrUrl, resolve, reject);
          });
        } else {
          robot = loader.parse(urdfText);
        }

        robot.userData = { isURDF: true };

        // Wrap robot in a group to rotate from URDF Z-up to Three.js Y-up,
        // so the robot stands vertically on the ground plane by default.
        const wrapper = new THREE.Group();
        wrapper.rotation.x = -Math.PI / 2;
        wrapper.add(robot);
        scene.add(wrapper);
        modelRef.current = wrapper;
        robotRef.current = robot;

        // Extract joint info from URDFRobot.joints for accurate limits
        const joints: JointInfo[] = [];
        for (const name in robot.joints) {
          const joint = robot.joints[name];
          joints.push({
            name,
            type: joint.jointType,
            min: joint.jointType === 'revolute' ? joint.limit.lower : -Math.PI,
            max: joint.jointType === 'revolute' ? joint.limit.upper : Math.PI,
            value: joint.jointValue[0] ?? 0,
          });
        }
        jointsRef.current = joints;

        if (wireframeRef.current) applyWireframe(true);

        return { joints };
      } catch (err) {
        console.error('URDF load error:', err);
        return null;
      }
    },
    [clearCurrentModel, applyWireframe, createMeshLoader, processXacro]
  );

  const loadMeshModel = useCallback(
    async (fileOrUrl: string | File, name: string): Promise<void> => {
      const scene = sceneRef.current;
      if (!scene) return;

      clearCurrentModel();

      const ext = typeof fileOrUrl === 'string' ? name.split('.').pop()?.toLowerCase() : fileOrUrl.name.split('.').pop()?.toLowerCase();
      let mesh: THREE.Object3D | null = null;

      try {
        if (ext === 'stl') {
          const loader = new STLLoader();
          if (typeof fileOrUrl === 'string') {
            const geo = await loader.loadAsync(fileOrUrl);
            const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
            mesh = new THREE.Mesh(geo, mat);
          } else {
            const buffer = await fileOrUrl.arrayBuffer();
            const geo = loader.parse(buffer);
            const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
            mesh = new THREE.Mesh(geo, mat);
          }
        } else if (ext === 'obj') {
          const loader = new OBJLoader();
          if (typeof fileOrUrl === 'string') {
            mesh = await loader.loadAsync(fileOrUrl);
          } else {
            const text = await fileOrUrl.text();
            mesh = loader.parse(text);
          }
        } else if (ext === 'glb' || ext === 'gltf') {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const loader = new GLTFLoader();
          if (typeof fileOrUrl === 'string') {
            const gltf = await loader.loadAsync(fileOrUrl);
            mesh = gltf.scene;
          } else {
            const url = URL.createObjectURL(fileOrUrl);
            const gltf = await loader.loadAsync(url);
            mesh = gltf.scene;
            URL.revokeObjectURL(url);
          }
        }

        if (mesh) {
          mesh.userData = { isMesh: true, name };
          scene.add(mesh);
          modelRef.current = mesh;
        }
      } catch (err) {
        console.error('Mesh load error:', err);
      }
    },
    [clearCurrentModel]
  );

  const disposeObject = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m.dispose());
        }
      }
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      1000
    );
    camera.position.set(3, 2, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.target.set(0, 0.5, 0);
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    grid.position.y = -0.01;
    scene.add(grid);
    gridRef.current = grid;

    const axes = new THREE.AxesHelper(1);
    axes.visible = false;
    scene.add(axes);
    axesRef.current = axes;

    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.02;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
          }
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0" />
  );
});

ViewerCanvas.displayName = 'ViewerCanvas';
export default ViewerCanvas;
