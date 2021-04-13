export interface Status {
    changed: string[];
    staged: string[];
}

export interface GitManager {

    status(): Promise<Status>;

}



