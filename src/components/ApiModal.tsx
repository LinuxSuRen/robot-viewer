import React, { useState, useCallback } from 'react';

const endpoints = [
  {
    method: 'GET',
    path: '/v1/viewer/joints',
    desc: '获取所有关节角度（弧度）',
    curl: `curl -s ${location.origin}/v1/viewer/joints`,
    body: null,
    resp: '{"joint1":0.0,"joint2":0.0,...,"world_to_base_link":0.0}',
  },
  {
    method: 'POST',
    path: '/v1/viewer/joints',
    desc: '设置关节角度（弧度），返回更新后的全部关节',
    curl: `curl -s ${location.origin}/v1/viewer/joints -X POST -H 'Content-Type: application/json' -d '{"joint1":0.5,"joint2":-0.3}'`,
    body: '{"joint1": 0.5, "joint2": -0.3}',
    resp: '{"joint1":0.5,"joint2":-0.3,"joint3":0.0,...}',
  },
  {
    method: 'GET',
    path: '/v1/viewer/model',
    desc: '获取当前加载的模型信息',
    curl: `curl -s ${location.origin}/v1/viewer/model`,
    body: null,
    resp: '{"name":"robot.urdf","jointCount":6,"linkCount":7}',
  },
  {
    method: 'POST',
    path: '/v1/viewer/model',
    desc: '更新模型信息',
    curl: `curl -s ${location.origin}/v1/viewer/model -X POST -H 'Content-Type: application/json' -d '{"name":"robot.urdf","jointCount":6,"linkCount":7}'`,
    body: '{"name": "robot.urdf", "jointCount": 6, "linkCount": 7}',
    resp: '{"name":"robot.urdf","jointCount":6,"linkCount":7}',
  },
  {
    method: 'WS',
    path: '/ws/viewer',
    desc: 'WebSocket 实时推送关节角度（替代轮询），前端自动连接并同步 3D 模型',
    curl: `（浏览器自动连接，无需 curl。后端推送 JSON: {"joint1":0.5,...}）`,
    body: null,
    resp: '{"joint1":0.5,"joint2":-0.3,"joint3":0.0,...}',
  },
];

export default function ApiModal() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (!open) {
    return (
      <button
        onClick={toggle}
        className="rounded-md px-2 py-0.5 text-[11px] text-gray-400 transition hover:bg-gray-700/60 hover:text-white"
      >
        API
      </button>
    );
  }

  return (
    <>
      <button
        onClick={toggle}
        className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] text-white transition"
      >
        API
      </button>

      {/* overlay */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-8"
        onClick={toggle}
      >
        {/* modal — full height minus top/bottom margins */}
        <div
          className="flex h-[calc(100vh-5rem)] w-[720px] flex-col rounded-2xl border border-gray-700/60 bg-gray-900/95 p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">API Reference</h2>
            <span className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
              {location.origin}
            </span>
          </div>

          {/* scrollable body */}
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {endpoints.map((ep) => (
              <div
                key={ep.method + ep.path}
                className="rounded-xl border border-gray-800 bg-gray-950/60 p-3"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      ep.method === 'GET'
                        ? 'bg-green-700/70 text-green-100'
                        : 'bg-blue-700/70 text-blue-100'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <code className="text-xs text-gray-300">{ep.path}</code>
                </div>
                <p className="mb-2 text-[11px] text-gray-500">{ep.desc}</p>

                {/* curl */}
                <div className="relative mb-2">
                  <div className="mb-0.5 text-[10px] text-gray-600">curl</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-gray-800/70 p-2 text-[11px] leading-relaxed text-green-300">
                    {ep.curl}
                  </pre>
                  <CopyButton text={ep.curl} />
                </div>

                {/* body (POST only) */}
                {ep.body && (
                  <div className="relative mb-2">
                    <div className="mb-0.5 text-[10px] text-gray-600">Body</div>
                    <pre className="overflow-x-auto rounded-md bg-gray-800/70 p-2 text-[11px] leading-relaxed text-yellow-200">
                      {ep.body}
                    </pre>
                    <CopyButton text={ep.body} />
                  </div>
                )}

                {/* response */}
                <div className="relative">
                  <div className="mb-0.5 text-[10px] text-gray-600">Response</div>
                  <pre className="overflow-x-auto rounded-md bg-gray-800/70 p-2 text-[11px] leading-relaxed text-blue-200">
                    {ep.resp}
                  </pre>
                  <CopyButton text={ep.resp} />
                </div>
              </div>
            ))}
          </div>

          {/* close button */}
          <button
            onClick={toggle}
            className="mt-3 shrink-0 w-full rounded-lg bg-gray-800 py-2 text-[12px] text-gray-400 transition hover:bg-gray-700"
          >
            关闭
          </button>
        </div>
      </div>
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className="absolute right-1 top-1 rounded bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-400 transition hover:bg-gray-600"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
