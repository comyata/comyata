# File Engine Server

Use comyata to easily build data APIs or data-to-data generators.

- [./data](./data) contains example data files
- [./data/api](./data/api) `.yaml` files in here are available as api endpoints `/api/:apiFile` (url is without extension)
- [./src/FileEngine/setupFileEngine.ts](./src/FileEngine/setupFileEngine.ts) contains the setup of `FileEngine` together with a file watcher and the API routes

> **todo: expand examples**
> - CLI example
> - redis importer
> - remote importer with auth
> - static file generator (data-to-data)
