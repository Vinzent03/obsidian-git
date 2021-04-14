export interface Author {
    name: string;
    email: string;
}
export interface Status {
    changed: FileStatusResult[];
    staged: string[];
}
export interface FileStatusResult {
    path: string;
    index: string;
}
export interface DiffResult {
    path: string;
    type: "equal" | "modify" | "add" | "remove";
}