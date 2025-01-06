
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve, basename } from "node:path";
import { DefaultTheme } from "vitepress";

function generateSideBar(
  FolderName: string,
  FindDir: string,
  Collapsed?: boolean
): DefaultTheme.SidebarItem[] {
  const docs = resolve(__dirname, `../../${FolderName}`);
  const files = readdirSync(FindDir);
  const result: DefaultTheme.SidebarItem[] = [
    {
      text: getMdTitle(FindDir),
      items: [],
    },
  ];
  if (Collapsed) result[0].collapsed = true;
  for (const file of files) {
    const fullPath = resolve(FindDir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result[0].items?.push(
        { collapsed: false }
      )
      generateSideBar(FolderName, fullPath, true).forEach((item) => {
        result[0].items?.push(item)
      }
      );
    } else if (
      stat.isFile() &&
      file.endsWith(`.md`) &&
      !file.endsWith(`index.md`)
    ) {
      result[0].items?.push({
        text: getMdTitle(fullPath),
        link: fullPath.replace(docs, "").slice(1).replace(".md", ""),
      });
    }
  }
  return result;
}

const getMdTitle = (md: string) => {
  if (!md.endsWith(".md")) md = resolve(md, "./index.md");

  if (existsSync(md)) {
    const MdContent = readFileSync(md, "utf8");
    const titleMatch = MdContent.match(/^# (.*)$/m);
    return titleMatch ? titleMatch[1] : retrim(basename(md.replace(".md", "")));
  }

  return retrim(basename(resolve(md, `..`)));
};

export default function makeSidebar(FolderName: string) {
  return {
    base: `/${FolderName}/`,
    items: generateSideBar(
      `${FolderName}`,
      resolve(__dirname, `../../${FolderName}`)
    ),
  };
}

// console.log(makeSidebar("Nginx"));

const retrim = (str: string, chars?: string) => {
  chars = chars ? chars : "1234567890.-_";
  const charSet = new Set(chars);
  let pos = 0;
  while (pos < str.length && charSet.has(str[pos])) pos++;

  const dateCharSet = new Set("年月日");
  if (dateCharSet.has(str[pos])) pos--;

  const numSet = new Set("1234567890");
  while (pos > 0 && numSet.has(str[pos])) pos--;

  return str.slice(pos++);
}

// console.log(retrim("1-2.3.2024月yourname", " 1234567890-."));

