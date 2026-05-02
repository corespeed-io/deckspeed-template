# CoreSpeed Deck Template

A slide deck template that provides a controlled environment for AI coding
agents (like Cursor) to generate beautiful, web-based slide decks. Built with
real-time preview capabilities and precise formatting controls, this template
serves as the development foundation for DeckSpeed - the AI-powered presentation
generator by CoreSpeed.

## Purpose

This template provides a structured environment where AI coding agents can
develop slide decks with immediate visual feedback:

- Real-time preview of slides as they're generated
- Precise paper format controls with multiple size options
- Clean, predictable architecture for AI-driven development
- Standardized component patterns for consistent results

## Features

- **Multiple Paper Formats**: Supports various standard sizes:
  - ISO (A3, A4, A5)
  - US (Letter, Legal, Tabloid)
  - Presentation (4:3)
  - Wide (16:9)
- **Orientation Control**: Switch between portrait and landscape
- **Responsive Scaling**: Automatically scales to fit any container while
  maintaining aspect ratio
- **AI-Friendly Architecture**:
  - Clean, predictable structure for AI code generation
  - Standardized component patterns
  - Clear separation of concerns
  - Consistent styling approach
  - Real-time preview via iframe
  - Well-defined boundaries for AI modifications

## Development

### Prerequisites

- Node.js 22.14 or later
- bun

### Installation

1. Clone the template repository:

```bash
git clone https://github.com/CoreSpeed-io/deckspeed-template.git
cd deckspeed-template
```

2. Install dependencies:

```bash
bun install
```

3. Start the development server:

```bash
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Slide Management

### Slide Naming Convention

- Slides are named using descriptive keywords and a random number
- Format: `{descriptive-name}-{random-number}.tsx`
- The filename without the `.tsx` extension serves as the slide's ID
- Example: File `introduction-to-deckspeed-1123.tsx` has ID
  `introduction-to-deckspeed-1123`

### Preview Access

The deck can be previewed through two endpoints:

- `/by-id/{slide-id}` - Access slide directly by its ID (e.g.,
  `/by-id/introduction-to-deckspeed-1123`)
- `/by-index/{number}` - Access slide by its position in the deck (e.g.,
  `/by-index/1`)

### Development Pattern

```tsx
// src/slides/introduction-to-deckspeed-1123.tsx
export default function Slide() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-800">Your Beautiful Slide</h1>
    </div>
  );
}
```

### Supported Paper Formats

| Format       | Dimensions (mm) | Aspect Ratio |
| ------------ | --------------- | ------------ |
| A4           | 210 × 297       | ~1:1.414     |
| A3           | 297 × 420       | ~1:1.414     |
| A5           | 148 × 210       | ~1:1.414     |
| Letter       | 215.9 × 279.4   | ~1:1.294     |
| Legal        | 215.9 × 355.6   | ~1:1.647     |
| Tabloid      | 279.4 × 431.8   | ~1:1.545     |
| Presentation | 254 × 190.5     | 4:3          |
| Wide         | 320 × 180       | 16:9         |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Business Source License 1.1 (BSL).

See the [LICENSE](LICENSE) file for details.

## Related Projects

- [DeckSpeed](https://deckspeed.com) - The AI-powered presentation generator
  that embeds this template
- [CoreSpeed](https://corespeed.io) - The ultimate AI software delivery
  acceleration platform
