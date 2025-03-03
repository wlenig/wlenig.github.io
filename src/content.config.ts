import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';

const blog = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./data/blog"}),
    schema: z.object({
        title: z.string(),
        publishDate: z.date(),
        description: z.string(),
    })
});

export const collections = { blog };
