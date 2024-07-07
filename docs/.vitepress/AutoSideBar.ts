import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve } from "node:path";
import { DefaultTheme } from "vitepress";

function generateSideBar(
  FolderName: string,
  FindDir: string
): DefaultTheme.SidebarItem[] {
  const docs = resolve(__dirname, `../${FolderName}`);
  const files = readdirSync(FindDir);
  const result: DefaultTheme.SidebarItem[] = [];
  for (const file of files) {
    const fullPath = resolve(FindDir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push({
        text: getMdTitle(fullPath),
        items: generateSideBar(FolderName, fullPath),
      });
    } else if (
      stat.isFile() &&
      file.endsWith(`.md`) &&
      !file.endsWith(`index.md`)
    ) {
      result.push(
        {
          text: getMdTitle(fullPath),
          link: fullPath.replace(docs, "").slice(1).replace(".md", ""),
        },
      );
    }
  }
  return result;
}

const getMdTitle = (md: string) => {
  if (!md.endsWith(".md")) md = resolve(md, "./index.md");

  if (existsSync(md)) {
    const MdContent = readFileSync(md, "utf8");
    const titleMatch = MdContent.match(/^# (.*)$/m);
    return titleMatch ? titleMatch[1] : undefined;
  }
  return resolve(md).split(`\\`).reverse()[1];
};

export default function makeSidebar(FolderName: string) {
  return {
    base: `/${FolderName}/`,
    items: generateSideBar(
      `${FolderName}`,
      resolve(__dirname, `../${FolderName}`)
    ),
  };
}

