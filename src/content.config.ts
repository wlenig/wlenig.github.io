import { defineCollection, z } from "astro:content";
import { glob } from 'astro/loaders';

const blog = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/data/blog"}),
    schema: z.object({
        title: z.string(),
        publishDate: z.date()
    })
});

export const collections = { blog };
