import { FileResolveContext, Resolver } from '@comyata/fe/FileEngine'

export class TrieNode {
    /**
     * Map of character to child node
     */
    children: Map<string, TrieNode>
    resolver: null | Resolver | FileResolveContext

    constructor(resolver: TrieNode['resolver'] = null) {
        this.resolver = resolver
        this.children = new Map()
    }
}

export class Importers {
    root: TrieNode

    constructor(rootNode = new TrieNode()) {
        this.root = rootNode
    }

    use(resolver: Resolver) {
        resolver.scopes.forEach(scope => {
            this.insert(scope, resolver)
        })
        return this
    }

    insert(scope: string, resolver: Resolver | FileResolveContext) {
        let node = this.root
        for(let i = 0; i < scope.length; i++) {
            const char = scope[i]
            let nextNode = node.children.get(char)
            if(!nextNode) {
                nextNode = new TrieNode()
                node.children.set(char, nextNode)
            }
            node = nextNode
        }
        node.resolver = resolver
        return this
    }

    match(scope: string) {
        let node: TrieNode | undefined = this.root
        let lastMatchNode: TrieNode = node
        for(let i = 0; i < scope.length; i++) {
            const char = scope[i]
            node = node.children.get(char)
            if(!node) {
                break
            }
            lastMatchNode = node
        }

        return lastMatchNode.resolver
    }
}
