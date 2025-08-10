# Three.js + Next.js + TypeScript Website

A modern website built with Three.js for 3D graphics, Next.js for the framework, and TypeScript for type safety.

## Features

- 🎨 3D graphics with Three.js
- ⚡ Fast development with Next.js 14
- 🔒 Type safety with TypeScript
- 📱 Responsive design
- 🚀 App Router (experimental)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Run the development server:
```bash
npm run dev
# or
yarn dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/             # React components
│   └── ThreeScene.tsx     # Three.js scene component
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── next.config.js         # Next.js configuration
└── README.md              # This file
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Customization

The Three.js scene is located in `components/ThreeScene.tsx`. You can:

- Add more 3D objects
- Implement camera controls
- Add animations and interactions
- Import 3D models
- Add post-processing effects

## Technologies Used

- [Next.js 14](https://nextjs.org/) - React framework
- [Three.js](https://threejs.org/) - 3D graphics library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [React 18](https://reactjs.org/) - UI library

## License

MIT
