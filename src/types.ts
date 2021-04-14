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