// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"index.mdx": () => import("../content/index.mdx?collection=docs"), "deployment/docker.mdx": () => import("../content/deployment/docker.mdx?collection=docs"), "deployment/kubernetes.mdx": () => import("../content/deployment/kubernetes.mdx?collection=docs"), "deployment/vercel.mdx": () => import("../content/deployment/vercel.mdx?collection=docs"), "developer/api-reference.mdx": () => import("../content/developer/api-reference.mdx?collection=docs"), "developer/plugin-development.mdx": () => import("../content/developer/plugin-development.mdx?collection=docs"), "developer/theme-development.mdx": () => import("../content/developer/theme-development.mdx?collection=docs"), "getting-started/configuration.mdx": () => import("../content/getting-started/configuration.mdx?collection=docs"), "getting-started/installation.mdx": () => import("../content/getting-started/installation.mdx?collection=docs"), "getting-started/quick-start.mdx": () => import("../content/getting-started/quick-start.mdx?collection=docs"), }),
};
export default browserCollections;