# 3D Wall Scene Application

A modern 3D web application built with Next.js and Three.js that allows users to visualize and edit a 3D wall scene with multiple view perspectives.

## Features

### 🏗️ **Wall Scene**
- **Default Dimensions**: 4000mm × 2700mm × 90mm (Length × Height × Thickness)
- **Realistic Rendering**: High-quality materials with subtle textures and shadows
- **Dynamic Scaling**: Wall automatically adjusts based on user input
- **Grid Reference**: Visual grid system for better spatial understanding

### 📐 **Dimension Editing**
- **Edit Button**: Floating edit icon in the top center of the screen
- **Modal Interface**: Clean, user-friendly form for dimension input
- **Validation**: Min/max constraints for length and height
- **Fixed Thickness**: Wall thickness remains constant at 90mm
- **Real-time Updates**: Changes apply immediately to the 3D scene

### 🎥 **View Management**
- **4 View Modes**: 3D, X (Side), Y (Top), Z (Front)
- **Smooth Transitions**: Animated camera movements between views
- **Bottom Controls**: Intuitive icon-based navigation at screen bottom
- **Active View Display**: Current view shown in top-right corner

### 🎨 **Visual Features**
- **Professional Lighting**: Multi-source lighting with shadows
- **High-Quality Materials**: PBR materials with realistic properties
- **Responsive Design**: Adapts to different screen sizes
- **Smooth Animations**: 60fps rendering with optimized performance

## Camera System

- **Default Position**: 3D perspective view with slight elevation
- **Dynamic Distance**: Camera automatically positions at 2× wall length from center
- **Smart Positioning**: Adjusts based on wall dimensions and selected view
- **Smooth Transitions**: 1-second easing animations between view changes

## Technical Details

### **Built With**
- **Frontend**: Next.js 14, React 18, TypeScript
- **3D Engine**: Three.js 0.158
- **Styling**: Tailwind CSS
- **Build Tool**: Next.js built-in bundler

### **Performance Features**
- **Shadow Mapping**: High-resolution shadows (4096×4096)
- **Tone Mapping**: ACES Filmic for realistic color reproduction
- **Memory Management**: Proper disposal of 3D resources
- **Responsive Rendering**: Automatic resize handling

## Getting Started

### **Prerequisites**
- Node.js 18+ 
- npm or yarn

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd ThreeJs-New

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Usage**
1. **View the Scene**: The 3D wall scene loads automatically
2. **Edit Dimensions**: Click the edit button (pencil icon) in the top center
3. **Change Views**: Use the 4 view buttons at the bottom center
4. **Monitor Changes**: Watch the dimensions panel in the top left

### **Controls**
- **Edit Button**: Top center - Opens dimension editing modal
- **3D View**: Default perspective view
- **X View**: Side view (looking at YZ plane from the right)
- **Y View**: Front view (looking at XY plane from the front)
- **Z View**: Top view (looking at XZ plane from above)

## Development

### **Project Structure**
```
ThreeJs-New/
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main page with UI controls
│   ├── layout.tsx      # App layout
│   └── globals.css     # Global styles
├── components/          # React components
│   └── ThreeScene.tsx  # 3D scene component
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

### **Key Components**
- **ThreeScene**: Main 3D rendering component with Three.js
- **Wall Management**: State management for wall dimensions
- **View Controls**: Camera positioning and view switching
- **Edit Modal**: Form interface for dimension editing

### **Customization**
- **Wall Material**: Modify `createWallTexture()` in ThreeScene.tsx
- **Camera Behavior**: Adjust `updateCameraPosition()` function
- **UI Styling**: Update Tailwind classes in page.tsx
- **Lighting**: Modify light setup in ThreeScene.tsx

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **WebGL Required**: 3D rendering requires WebGL support
- **Mobile**: Responsive design works on mobile devices

## Performance Tips

- **High-End Devices**: Full quality with shadows and high-resolution textures
- **Mid-Range Devices**: Automatic quality adjustments
- **Mobile Devices**: Optimized rendering for touch interfaces

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

---

**Built with ❤️ using Next.js and Three.js**