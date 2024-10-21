import { DataFile } from '@comyata/fe/DataFile'
import { NodeComputeError } from '@comyata/run/Errors'
import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'node:url'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngine-File.test

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const mocksDir = path.join(__dirname, 'mocks')

describe('FileEngine-File', () => {

    it('FileEngine File', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const projectFile = fileEngine.fileRef('./project/project.yml', resolveContext)
        const [r] = await fileEngine.run(projectFile, {}) as [any, FileComputeStats, RuntimeContext]
        expect(r).toStrictEqual({
            name: 'Comyata',
            intro: {
                title: 'Intro',
                content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nDuis aute irure dolor in reprehenderit in voluptate.',
            },
        })
    })

    it('FileEngine different dir', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        // only testing that it resolved the files
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir, 'project')).href)
        const projectFile = fileEngine.fileRef('./project.yml', resolveContext)
        const [r1] = await fileEngine.run(projectFile, {}) as [any, FileComputeStats, RuntimeContext]
        expect(r1).toBeInstanceOf(Object)
        expect(fileEngine.files.has(url.pathToFileURL(path.join(mocksDir, 'project', 'project.yml')).href)).toBe(true)

        const pageFile = fileEngine.fileRef('../page.yml', resolveContext)
        const [r2] = await fileEngine.run(pageFile, {}) as [any, FileComputeStats, RuntimeContext]
        expect(r2).toBeInstanceOf(Object)
        expect(fileEngine.files.has(url.pathToFileURL(path.join(mocksDir, 'page.yml')).href)).toBe(true)
    })

    it('FileEngine files clear', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir, 'project')).href)
        const projectFile = fileEngine.fileRef('./project.yml', resolveContext)

        const [r1] = await fileEngine.run(projectFile, {}) as [any, FileComputeStats, RuntimeContext]
        expect(r1).toBeInstanceOf(Object)
        expect(fileEngine.files.has(url.pathToFileURL(path.join(mocksDir, 'project', 'project.yml')).href)).toBe(true)
        expect(fileEngine.files.has(url.pathToFileURL(path.join(mocksDir, 'project', 'intro.yml')).href)).toBe(true)
        const introFile = fileEngine.files.get(url.pathToFileURL(path.join(mocksDir, 'project', 'intro.yml')).href)
        expect(introFile).toBeInstanceOf(DataFile)

        fileEngine.files.clear()

        const [r2] = await fileEngine.run(projectFile, {}) as [any, FileComputeStats, RuntimeContext]
        expect(r2).toBeInstanceOf(Object)
        // todo: this assertion currently fails, as `fileRef` registers the file to `files`,
        //       yet `run` transiently uses it without assigning to `files` again / or checking if existing in it
        // expect(fileEngine.files.has(url.pathToFileURL(path.join(mocksDir, 'project', 'project.yml')).href)).toBe(true)
        expect(fileEngine.files.has(url.pathToFileURL(path.join(mocksDir, 'project', 'intro.yml')).href)).toBe(true)
        const introFile2 = fileEngine.files.get(url.pathToFileURL(path.join(mocksDir, 'project', 'intro.yml')).href)
        expect(introFile2).toBeInstanceOf(DataFile)
        expect(introFile2).not.toStrictEqual(introFile) // as cleared in between, the newly loaded DataFile is not the same as at `r1`
    })

    it('FileEngine File not existing', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const missingFile = fileEngine.fileRef('./missing.yml', resolveContext)
        await expect(fileEngine.run(missingFile, {})).rejects.toThrow(new Error(`ENOENT: no such file or directory, open '${path.join(mocksDir, './missing.yml')}'`))
    })

    it('FileEngine circular load', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const mainFile = fileEngine.fileRef('./circular/main.yml', resolveContext)
        const [r] = await fileEngine.run(mainFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r).toStrictEqual({
            title: 'Circular Load',
            loaded: {
                title: 'Circular Load',
                loaded: '${$import(\'./snippet_load.yml\')}',
            },
        })
    })

    it('FileEngine circular import', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const brokenImport = fileEngine.fileRef('./circular/broken_import.yml', resolveContext)

        const run = fileEngine.run(brokenImport, {})
        await expect(run).rejects.toThrow(NodeComputeError)
        await expect(run).rejects.toThrow(
            `Compute failure at "/imported" with "$".
Compute failure at "" with "$".
circular import: files load each other ${JSON.stringify(url.pathToFileURL(path.join(mocksDir, 'circular/broken_import.yml')).href)}`,
        )
    })

    it('FileEngine circular self', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const brokenSelf = fileEngine.fileRef('./circular/broken_self.yml', resolveContext)

        const run = fileEngine.run(brokenSelf, {})
        await expect(run).rejects.toThrow(NodeComputeError)
        await expect(run).rejects.toThrow(
            `Compute failure at "/self_loop" with "$".
circular import: file loads itself ${JSON.stringify(url.pathToFileURL(path.join(mocksDir, 'circular/broken_self.yml')).href)}`,
        )
    })

    it('FileEngine hierarchical data access', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const resolveContext = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)

        const [r] = await fileEngine.run(fileEngine.fileRef('./hierarchical.yml', resolveContext), {}) as [any, FileComputeStats, RuntimeContext]
        expect(r).toStrictEqual({
            name: 'Root',
            nameSelf: 'Root',
            nameRootA: 'Root',
            nested: {
                nameRootB: 'Root',
                nameParent0: 'Root',
                count: 111,
                countSelf: 111,
                countRootA: 111,
                deeper: {
                    countParent0: 111,
                    nameParent1: 'Root',
                    nameRootC: 'Root',
                    countRootB: 111,
                },
            },
        })
    })
})
