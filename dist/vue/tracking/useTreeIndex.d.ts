import type { TreeNode, TreeIndexEntry } from "./types";
/**
 * Builds a flat index of all nodes in a tree for O(1) lookup with hierarchy metadata.
 */
export declare function useTreeIndex<T extends TreeNode>(roots: T[], options?: {
    getChildren?: (node: T) => T[] | undefined;
}): {
    index: Map<string, TreeIndexEntry<T>>;
    isActive: (id: string, activeId: string | null) => boolean;
    isInActiveChain: (id: string, activeId: string | null) => boolean;
    isDescendant: (childId: string, ancestorId: string) => boolean;
};
//# sourceMappingURL=useTreeIndex.d.ts.map