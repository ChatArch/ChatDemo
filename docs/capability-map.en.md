# Capability map

<div class="grid cards" markdown>

- **Demo catalog**

    Manage bundled demos and explicitly registered static roots; emit JSON metadata.

- **HTTP gallery**

    Bind to loopback by default and serve only gallery and registered roots.

- **Static export**

    Copy pages and dependencies into a self-contained, subpath-ready site.

</div>

| Capability | Scope |
| --- | --- |
| Three mechanical prototypes | Bundled Three.js; rotate, adjust speed, explode, pause and step |
| Custom pages | Already-built static directories with an index.html entry |
| Access boundaries | Reject traversal, hidden assets, symbolic links and directory listing |
| Configuration | Catalog is application data; no API key required; ChatEnv schema retained |
| Documentation gallery | Build hook exports bundled assets consistently for production and preview |

## Limits

The server is intended for local demos and trusted assets. It does not provide authentication, TLS, multi-user writes or backend execution. Keep credentials and private documents out of registered roots. Custom pages with absolute asset paths must be adapted for their target host; export does not rewrite scripts.

Mechanical pages require WebGL. They are visual prototypes, not manufactured or physically verified machines.
