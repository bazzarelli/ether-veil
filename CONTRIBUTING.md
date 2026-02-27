# Contributing

Thanks for contributing to Shark Cosmic River.

## Development Setup

1. Install prerequisites:
- Node.js 20+
- npm 10+
- tshark (from Wireshark)

2. Clone and install:

```bash
git clone https://github.com/<your-org-or-user>/shark-cosmic-river.git
cd shark-cosmic-river
npm install
```

3. Start development:

Terminal 1:

```bash
npm run river:interfaces
npm run river:bridge -- --iface <your-interface>
```

Terminal 2:

```bash
npm run dev
```

## Code Style

- Use TypeScript where applicable.
- Keep components focused and readable.
- Run lint before opening a PR:

```bash
npm run lint
```

## Pull Requests

Include:
- What changed and why
- How you tested it
- Any screenshots/video for UI changes

## Security Notes

This project captures network metadata from local interfaces. Do not run packet capture on networks you are not authorized to monitor.
