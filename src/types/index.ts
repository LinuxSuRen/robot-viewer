export interface JointInfo {
  name: string;
  type: string;
  min: number;
  max: number;
  value: number;
}

export interface ModelInfo {
  name: string;
  jointCount: number;
  linkCount: number;
}

export interface JointAngles {
  [jointName: string]: number;
}

export type FileMap = Map<string, File>;

export interface DirectoryLoadResult {
  joints: JointInfo[];
  fileName: string;
}

export interface ViewerHandle {
  loadURDF: (url: string | File) => Promise<{ joints: JointInfo[] } | null>;
  loadMesh: (url: string | File, name: string) => Promise<void>;
  setJointAngles: (angles: JointAngles) => void;
  getJointAngles: () => JointAngles;
  clearScene: () => void;
  setAxesVisible: (visible: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setWireframe: (enabled: boolean) => void;
  resetCamera: (position: [number, number, number]) => void;
  getModelInfo: () => ModelInfo;
  setFileMap: (fileMap: FileMap, workingDir: string) => void;
  setBackgroundColor: (color: string) => void;
}

export type CameraPreset = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';
