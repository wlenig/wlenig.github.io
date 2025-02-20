interface OpenGraphMeta {
    title: string;
    description?: string;
    image?: {
        url: string;
        width: number;
        height: number;
    },
    type?: "website" | "article" | "profile";
}