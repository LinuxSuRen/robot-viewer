import type { JointAngles, ModelInfo } from '../types';

const BASE_URL = '';

async function request<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchJoints(): Promise<JointAngles | null> {
  return request<JointAngles>('/v1/viewer/joints');
}

export async function updateJoints(angles: JointAngles): Promise<JointAngles | null> {
  return request<JointAngles>('/v1/viewer/joints', {
    method: 'POST',
    body: JSON.stringify(angles),
  });
}

export async function fetchModelInfo(): Promise<ModelInfo | null> {
  return request<ModelInfo>('/v1/viewer/model');
}

export async function updateModelInfo(info: ModelInfo): Promise<ModelInfo | null> {
  return request<ModelInfo>('/v1/viewer/model', {
    method: 'POST',
    body: JSON.stringify(info),
  });
}
