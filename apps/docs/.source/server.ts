// @ts-nocheck
import * as __fd_glob_13 from "../content/getting-started/quick-start.mdx?collection=docs"
import * as __fd_glob_12 from "../content/getting-started/installation.mdx?collection=docs"
import * as __fd_glob_11 from "../content/getting-started/configuration.mdx?collection=docs"
import * as __fd_glob_10 from "../content/developer/theme-development.mdx?collection=docs"
import * as __fd_glob_9 from "../content/developer/plugin-development.mdx?collection=docs"
import * as __fd_glob_8 from "../content/developer/api-reference.mdx?collection=docs"
import * as __fd_glob_7 from "../content/deployment/vercel.mdx?collection=docs"
import * as __fd_glob_6 from "../content/deployment/kubernetes.mdx?collection=docs"
import * as __fd_glob_5 from "../content/deployment/docker.mdx?collection=docs"
import * as __fd_glob_4 from "../content/index.mdx?collection=docs"
import { default as __fd_glob_3 } from "../content/getting-started/meta.json?collection=docs"
import { default as __fd_glob_2 } from "../content/developer/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/deployment/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content", {"meta.json": __fd_glob_0, "deployment/meta.json": __fd_glob_1, "developer/meta.json": __fd_glob_2, "getting-started/meta.json": __fd_glob_3, }, {"index.mdx": __fd_glob_4, "deployment/docker.mdx": __fd_glob_5, "deployment/kubernetes.mdx": __fd_glob_6, "deployment/vercel.mdx": __fd_glob_7, "developer/api-reference.mdx": __fd_glob_8, "developer/plugin-development.mdx": __fd_glob_9, "developer/theme-development.mdx": __fd_glob_10, "getting-started/configuration.mdx": __fd_glob_11, "getting-started/installation.mdx": __fd_glob_12, "getting-started/quick-start.mdx": __fd_glob_13, });