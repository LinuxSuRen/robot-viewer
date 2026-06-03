# Robot Viewer

基于 React + Three.js 的机器人模型查看器，支持 URDF/Xacro 和常见三维网格格式。该项目使用 Vite 构建，并采用 Tailwind CSS 进行界面样式。

## 功能

- 支持文件拖放和文件夹加载
- 支持 URDF、Xacro、STL、OBJ、DAE、GLB、GLTF
- URDF/Xacro 模型自动解析并展示关节面板
- 关节值变化会同步到后端接口
- 相机视角快捷切换（前后左右上下）
- 显示/隐藏坐标轴、网格、线框模式
- 多文件目录解析，支持 mesh 路径解析和包路径匹配

## 目录结构

- `src/App.tsx` - 应用入口，组织场景、UI 和事件逻辑
- `src/components` - 视图组件：`ViewerCanvas`、`FileDropZone`、`Toolbar`、`JointPanel`
- `src/hooks` - 自定义 Hooks：场景管理、关节控制
- `src/api/client.ts` - 后端请求封装
- `src/types/index.ts` - 类型定义

## 运行

```bash
npm install
npm run dev
```

然后在浏览器中访问 `http://localhost:5173`。

## 打包

```bash
npm run build
```

## 后端集成

当前项目通过以下 REST 接口与后端交互：

- `GET /v1/viewer/joints` - 获取当前关节角度
- `POST /v1/viewer/joints` - 更新关节角度
- `GET /v1/viewer/model` - 获取当前模型信息
- `POST /v1/viewer/model` - 更新模型信息

## 开发依赖

- React 19
- Vite
- TypeScript
- Tailwind CSS
- Three.js
- urdf-loader
- xacro-parser

## 使用说明

1. 使用“Load File”按钮或直接拖放单个模型文件。
2. 使用“Load Folder”加载带有 URDF/Xacro 和 Mesh 文件的目录。
3. 加载 URDF/Xacro 后，右侧将显示关节控制面板，可实时调整。
4. 使用顶部工具栏切换相机视角、坐标轴、网格和线框显示。
