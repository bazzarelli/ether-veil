This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

check your network interface id:
(often en0 if connected via ethernet)

```bash
npm run river:interfaces
```

run the tshark bridge:

```bash
npm run river:bridge -- --iface en1
```

run the development server:

```bash
npm run dev
```
