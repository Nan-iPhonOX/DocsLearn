import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "node:path";

const getMdTitle = (md: string) => {
  if (!md.endsWith(".md")) md = resolve(md, "./index.md");

  if (existsSync(md)) {
    const MdContent = readFileSync(md, "utf8");
    const titleMatch = MdContent.match(/^# (.*)$/m);
    return titleMatch ? titleMatch[1] : null;
  }
  return resolve(md).split(`\\`).reverse()[1];
};

function generateSideBar(
  directory: string,
  base: string,
) {
  const basePath = resolve(__dirname, `../${base}`);
  const sidebar: any = {
    text: getMdTitle(directory),
    items: [],
  };
  const child = sidebar.items;
  const folder = readdirSync(directory);
  for (const file of folder) {
    const fullPath =join(directory, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      child.push(generateSideBar(fullPath, base));
    }
    if (stat.isFile() && file.endsWith(".md") && file !== "index.md") {
      child.push({
        text: getMdTitle(fullPath),
        link: `${resolve(fullPath)
          .replace(basePath, "")
          .replace(".md", "")
          .slice(1)}`,
      });
    }
  }
  return sidebar;
}

export default function makeSidebar(FolderName: string) {
  return {
    base: `/${FolderName}/`,
    items: [generateSideBar(resolve(__dirname, `../${FolderName}`), `${FolderName}`)],
  };
}

console.log(
  makeSidebar(`Learn`).items[0].items[2]
);
